const express = require("express");
const axios = require("axios");

const router = express.Router();

class GeminiHelper {
 static async getNewCookie() {
   const url = "https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=maGuAc&source-path=%2F&bl=boq_assistant-bard-web-server_20250814.06_p1&f.sid=-7816331052118000090&hl=en-US&_reqid=173780&rt=c";
   
   const headers = {
     "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
     "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
     "Accept": "*/*",
     "Accept-Language": "en-US,en;q=0.9",
     "Accept-Encoding": "gzip, deflate, br",
     "Origin": "https://gemini.google.com",
     "Referer": "https://gemini.google.com/"
   };

   const response = await axios.post(url, "f.req=%5B%5B%5B%22maGuAc%22%2C%22%5B0%5D%22%2Cnull%2C%22generic%22%5D%5D%5D&", {
     headers,
     timeout: 30000
   });

   const cookieHeader = response.headers["set-cookie"];
   if (!cookieHeader || !cookieHeader.length) {
     throw new Error("Could not find set-cookie header in the response");
   }

   return cookieHeader[0].split(";")[0];
 }

 static async ask(prompt, previousId = null) {
   if (typeof prompt !== "string" || !prompt.trim().length) {
     throw new Error("Invalid prompt provided");
   }

   let resumeArray = null;
   let cookie = null;

   if (previousId) {
     try {
       const decoded = Buffer.from(previousId, "base64").toString("utf-8");
       const parsed = JSON.parse(decoded);
       resumeArray = parsed.newResumeArray;
       cookie = parsed.cookie;
     } catch (e) {
       console.error("Failed to parse previousId, starting new conversation");
     }
   }

   const headers = {
     "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
     "x-goog-ext-525001261-jspb": "[1,null,null,null,\"9ec249fc9ad08861\",null,null,null,[4]]",
     "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
     "Accept": "*/*",
     "Accept-Language": "en-US,en;q=0.9",
     "Accept-Encoding": "gzip, deflate, br",
     "Origin": "https://gemini.google.com",
     "Referer": "https://gemini.google.com/",
     "Cookie": cookie || await this.getNewCookie()
   };

   const b = [[prompt], ["en-US"], resumeArray];
   const a = [null, JSON.stringify(b)];
   const body = new URLSearchParams({ "f.req": JSON.stringify(a) });

   const url = "https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?bl=boq_assistant-bard-web-server_20250729.06_p0&f.sid=4206607810970164620&hl=en-US&_reqid=2813378&rt=c";

   const response = await axios.post(url, body.toString(), {
     headers,
     timeout: 60000,
     responseType: "text"
   });

   const data = response.data;
   const match = data.matchAll(/^\d+\n(.+?)\n/gm);
   const chunks = Array.from(match, m => m[1]);

   let text = null;
   let newResumeArray = null;
   let found = false;

   for (const chunk of chunks.reverse()) {
     try {
       const realArray = JSON.parse(chunk);
       const parse1 = JSON.parse(realArray[0][2]);

       if (parse1 && parse1[4] && parse1[4][0] && parse1[4][0][1] && typeof parse1[4][0][1][0] === "string") {
         newResumeArray = [...parse1[1], parse1[4][0][0]];
         text = parse1[4][0][1][0].replace(/\*\*(.+?)\*\*/g, "*$1*");
         found = true;
         break;
       }
     } catch (e) {
       continue;
     }
   }

   if (!found) {
     throw new Error("Could not parse the response from the API");
   }

   const sessionData = { newResumeArray, cookie: headers.Cookie };
   const id = Buffer.from(JSON.stringify(sessionData)).toString("base64");

   return { text, id };
 }
}

const sessions = {};

router.get("/ask", async (req, res) => {
 try {
   const { q, prompt, question, session_id, reset } = req.query;

   if (reset === "true") {
     if (session_id && sessions[session_id]) {
       delete sessions[session_id];
     }
     return res.status(200).json({
       status: true,
       message: "Conversation history has been reset"
     });
   }

   const userPrompt = q || prompt || question;

   if (!userPrompt) {
     return res.status(400).json({
       status: false,
       error: "Missing required parameter: q, prompt or question",
       example: "/api/gemini/ask?q=hi"
     });
   }

   const previousId = session_id ? sessions[session_id] : null;
   const result = await GeminiHelper.ask(userPrompt, previousId);

   const newSessionId = session_id || Date.now().toString(36) + Math.random().toString(36).substr(2);
   sessions[newSessionId] = result.id;

   return res.status(200).json({
     status: true,
     question: userPrompt,
     answer: result.text,
     session_id: newSessionId,
     has_history: !!previousId
   });

 } catch (error) {
   console.error("Gemini Error:", error.message);
   return res.status(500).json({
     status: false,
     error: error.message || "Internal server error"
   });
 }
});

module.exports = {
 path: "/api/gemini",
 name: "Gemini AI Chat",
 type: "get",
 url: `${global.t || "http://localhost:3000"}/api/gemini/ask?q=hi`,
 logo: "https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg",
 category: "ai",
 info: "Chat with Google Gemini AI with conversation memory",
 router
};

