const express = require("express");
const axios = require("axios");

const router = express.Router();

class BlackboxAIHelper {
 static getHeaders() {
   return {
     "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
     "Accept": "application/json, text/plain, */*",
     "Accept-Language": "en-US,en;q=0.9",
     "Accept-Encoding": "gzip, deflate, br",
     "Content-Type": "application/json",
     "Origin": "https://www.blackbox.ai",
     "Referer": "https://www.blackbox.ai/"
   };
 }

 static async ask(question) {
   const payload = {
     messages: [
       {
         id: Date.now().toString(),
         content: question,
         role: "user"
       }
     ],
     id: Date.now().toString(),
     previewToken: null,
     userId: null,
     codeModelMode: true,
     agentMode: {},
     trendingAgentMode: {},
     isMicMode: false,
     isChromeExt: false,
     githubToken: null
   };

   const { data } = await axios.post("https://www.blackbox.ai/api/chat", payload, {
     headers: this.getHeaders(),
     timeout: 60000
   });

   let answer = "";
   if (typeof data === "string") {
     const lines = data.split("\n").filter(line => line.trim());
     for (const line of lines) {
       try {
         const parsed = JSON.parse(line);
         if (parsed && parsed.content) {
           answer += parsed.content;
         }
       } catch (e) {
         answer += line;
       }
     }
   } else if (data && data.content) {
     answer = data.content;
   }

   if (!answer) {
     throw new Error("No answer received from Blackbox AI");
   }

   return {
     question: question,
     answer: answer.trim(),
     length: answer.trim().length,
     timestamp: new Date().toISOString()
   };
 }
}

router.get("/ask", async (req, res) => {
 try {
   const { q, question } = req.query;
   const userQuestion = q || question;

   if (!userQuestion) {
     return res.status(400).json({
       status: false,
       error: "Missing required parameter: q or question",
       example: "/api/blackbox/ask?q=hi or /api/blackbox/ask?question=hi"
     });
   }

   const result = await BlackboxAIHelper.ask(userQuestion);

   return res.status(200).json({
     status: true,
     message: "✅ تم الحصول على الإجابة من Blackbox AI",
     question: result.question,
     answer: result.answer,
     length: result.length,
     timestamp: result.timestamp
   });

 } catch (error) {
   console.error("Blackbox AI Error:", error.message);
   return res.status(500).json({
     status: false,
     error: error.message || "Internal server error"
   });
 }
});

router.post("/ask", async (req, res) => {
 try {
   const { q, question } = req.body;
   const userQuestion = q || question;

   if (!userQuestion) {
     return res.status(400).json({
       status: false,
       error: "Missing required parameter: q or question",
       example: "POST /api/blackbox/ask with body: { \"q\": \"hi\" }"
     });
   }

   const result = await BlackboxAIHelper.ask(userQuestion);

   return res.status(200).json({
     status: true,
     message: "✅ تم الحصول على الإجابة من Blackbox AI",
     question: result.question,
     answer: result.answer,
     length: result.length,
     timestamp: result.timestamp
   });

 } catch (error) {
   console.error("Blackbox AI Error:", error.message);
   return res.status(500).json({
     status: false,
     error: error.message || "Internal server error"
   });
 }
});

module.exports = {
 path: "/api/blackbox",
 name: "Blackbox AI Chat",
 type: "get",
 url: `${global.t || "http://localhost:3000"}/api/blackbox/ask?q=hi`,
 logo: "https://www.blackbox.ai/favicon.ico",
 category: "ai",
 info: "Chat with Blackbox AI - Get answers to your questions",
 router
};
