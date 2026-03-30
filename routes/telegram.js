const express = require("express");
const axios = require("axios");

const router = express.Router();

class Telegram {
 constructor() {
   this.http = axios.create({
     baseURL: "https://api.apps.web.id",
     headers: {
       accept: "*/*",
       "accept-language": "id-ID",
       "accept-encoding": "gzip, deflate, br",
       "cache-control": "no-cache",
       origin: "https://afianf.vercel.app",
       pragma: "no-cache",
       referer: "https://afianf.vercel.app/",
       "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
       connection: "keep-alive"
     }
   });
 }

 async download({ url, ...rest }) {
   try {
     const { data } = await this.http.get("/telegram/detail", {
       params: {
         url: url,
         ...rest
       }
     });
     return data;
   } catch (e) {
     throw new Error(e?.message || "Download failed");
   }
 }
}

router.get("/download", async (req, res) => {
 try {
   const { url } = req.query;

   if (!url) {
     return res.status(400).json({
       status: false,
       error: "Missing required parameter: url"
     });
   }

   const api = new Telegram();
   const data = await api.download({ url });

   return res.status(200).json({
     status: true,
     ...data
   });

 } catch (error) {
   return res.status(500).json({
     status: false,
     error: error.message || "Internal server error"
   });
 }
});

module.exports = {
 path: "/api/telegram",
 name: "Telegram Downloader",
 type: "get",
 url: `${global.t || "http://localhost:3000"}/api/telegram/download?url=https://t.me/channel/123`,
 logo: "https://telegram.org/favicon.ico",
 category: "download",
 info: "Download media from Telegram posts and channels",
 router
};

