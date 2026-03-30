const express = require("express");
const axios = require("axios");
const WebSocket = require("ws");

const router = express.Router();

class NHentai {
 constructor() {
   this.baseUrl = "https://nhentai.zip";
   this.result = null;
 }

 parseId(input) {
   if (!input || typeof input !== "string") {
     throw new Error("Input harus berupa string");
   }

   if (/^\d+$/.test(input)) {
     return input;
   }

   let match = input.match(/nhentai\.zip\/g\/(\d+)/);
   if (match) return match[1];

   match = input.match(/nhentai\.net\/g\/(\d+)/);
   if (match) return match[1];

   match = input.match(/\/g\/(\d+)/);
   if (match) return match[1];

   match = input.match(/nhentai\.(zip|net)\/g\/(\d+)/);
   if (match) return match[2];

   const numbers = input.match(/\d+/g);
   if (numbers && numbers.length > 0) {
     const longestNumber = numbers.reduce((a, b) => a.length > b.length ? a : b);
     return longestNumber;
   }

   throw new Error(`Tidak dapat mengekstrak ID dari: ${input}`);
 }

 validateId(id) {
   if (!id) {
     throw new Error("ID tidak boleh kosong");
   }
   if (!/^\d+$/.test(id)) {
     throw new Error(`ID harus berupa angka: ${id}`);
   }
   return true;
 }

 async download({ id: inputId }) {
   let extractedId;
   try {
     extractedId = this.parseId(inputId);
     this.validateId(extractedId);
   } catch (parseError) {
     const errorResult = {
       result: null,
       success: false,
       input: inputId,
       extractedId: null,
       status: "invalid_id",
       error: parseError.message
     };
     this.result = errorResult;
     return errorResult;
   }

   let ws;
   let timeoutId;

   try {
     const pageUrl = `${this.baseUrl}/g/${extractedId}`;
     const page = await axios.get(pageUrl, {
       headers: {
         "user-agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
         referer: this.baseUrl,
         accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
         "accept-language": "en-US,en;q=0.9",
         "accept-encoding": "gzip, deflate, br",
         connection: "keep-alive"
       },
       timeout: 10000
     });

     if (page.status !== 200) throw new Error("Halaman tidak ditemukan");

     const wsUrl = `wss://nhentai.zip/ws/g/${extractedId}`;
     ws = new WebSocket(wsUrl, {
       headers: {
         Origin: this.baseUrl,
         "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36"
       }
     });

     const result = await new Promise((resolve, reject) => {
       let done = false;
       const info = {
         input: inputId,
         id: extractedId,
         status: "pending",
         progress: {
           current: 0,
           total: 0
         },
         timestamp: new Date().toISOString()
       };

       const end = (data, isError = false) => {
         if (done) return;
         done = true;
         if (timeoutId) clearTimeout(timeoutId);
         if (ws && ws.readyState === WebSocket.OPEN) {
           try {
             ws.terminate();
           } catch (err) {}
         }
         if (isError) {
           reject(data);
         } else {
           resolve(data);
         }
       };

       timeoutId = setTimeout(() => {
         if (!done) {
           end({
             result: null,
             success: false,
             input: inputId,
             id: extractedId,
             status: "timeout",
             error: "Timeout 5 menit"
           }, true);
         }
       }, 300000);

       ws.on("open", () => {});
       ws.on("message", data => {
         try {
           const buf = Buffer.from(data);
           const type = buf[0];

           if (type === 0) {
             const current = buf.readUInt16BE(1);
             const total = buf.readUInt16BE(3);
             info.progress = { current, total };

             if (current === total && !done) {
               if (timeoutId) {
                 clearTimeout(timeoutId);
                 timeoutId = setTimeout(() => {
                   if (!done) {
                     end({
                       result: null,
                       success: false,
                       input: inputId,
                       id: extractedId,
                       status: "file_timeout",
                       error: "File tidak muncul setelah progress 100%"
                     }, true);
                   }
                 }, 30000);
               }
             }
           } else if (type === 32) {
             const path = buf.toString("utf8", 1).trim();
             info.status = "completed";
             info.downloadUrl = path;
             info.finalUrl = `${this.baseUrl}${path}`;
             end({
               result: info.finalUrl,
               success: true,
               ...info
             });
           }
         } catch (err) {
           end({
             result: null,
             success: false,
             input: inputId,
             id: extractedId,
             status: "parse_error",
             error: err.message
           }, true);
         }
       });

       ws.on("error", err => {
         end({
           result: null,
           success: false,
           input: inputId,
           id: extractedId,
           status: "error",
           error: err.message
         }, true);
       });

       ws.on("close", (code, reason) => {
         if (!done) {
           end({
             result: null,
             success: false,
             input: inputId,
             id: extractedId,
             status: "ws_closed",
             error: `WebSocket closed unexpectedly: ${code} ${reason || ""}`
           }, true);
         }
       });
     });

     this.result = result;
     return result;
   } catch (err) {
     const errorResult = {
       result: null,
       success: false,
       input: inputId,
       id: extractedId,
       status: "failed",
       error: err.message
     };
     this.result = errorResult;
     return errorResult;
   } finally {
     if (timeoutId) clearTimeout(timeoutId);
     if (ws) {
       try {
         if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
           ws.terminate();
         }
       } catch (err) {}
     }
   }
 }

 getLastResult() {
   return this.result;
 }
}

router.get("/download", async (req, res) => {
 try {
   const { id } = req.query;

   if (!id) {
     return res.status(400).json({
       status: false,
       error: "Missing required parameter: id"
     });
   }

   const api = new NHentai();
   const response = await api.download({ id });

   if (!response.success) {
     return res.status(400).json({
       status: false,
       error: response.error || "Download failed",
       details: response
     });
   }

   return res.status(200).json({
     status: true,
     id: response.id,
     downloadUrl: response.result,
     finalUrl: response.finalUrl,
     progress: response.progress,
     timestamp: response.timestamp
   });

 } catch (error) {
   return res.status(500).json({
     status: false,
     error: error.message || "Internal Server Error"
   });
 }
});

module.exports = {
 path: "/api/nhentai",
 name: "NHentai Downloader",
 type: "get",
 url: `${global.t || "http://localhost:3000"}/api/nhentai/download?id=123456`,
 logo: "https://nhentai.net/favicon.ico",
 category: "download",
 info: "Download manga from NHentai via WebSocket",
 router
};
