const express = require("express");
const axios = require("axios");

const router = express.Router();

class ClaudeAIHelper {
 static getHeaders() {
   return {
     "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
     "Accept": "application/json, text/plain, */*",
     "Accept-Language": "en-US,en;q=0.9",
     "Accept-Encoding": "gzip, deflate, br",
     "Connection": "keep-alive"
   };
 }

 static async ask(question) {
   const url = `https://takamura.site/api/ai/claude?mode=chat&q=${encodeURIComponent(question)}`;
   
   const { data } = await axios.get(url, {
     headers: this.getHeaders(),
     timeout: 60000
   });

   if (!data || !data.result) {
     throw new Error("No answer received from Claude AI");
   }

   return {
     question: question,
     answer: data.result,
     timestamp: new Date().toISOString()
   };
 }
}

router.get("/chat", async (req, res) => {
 try {
   const { q, question } = req.query;
   const userQuestion = q || question;

   if (!userQuestion) {
     return res.status(400).json({
       status: false,
       error: "Missing required parameter: q or question",
       example: "/api/claude/chat?q=hi or /api/claude/chat?question=hi"
     });
   }

   const result = await ClaudeAIHelper.ask(userQuestion);

   return res.status(200).json({
     status: true,
     question: result.question,
     answer: result.answer,
     timestamp: result.timestamp
   });

 } catch (error) {
   console.error("Claude AI Error:", error.message);
   return res.status(500).json({
     status: false,
     error: error.message || "Internal server error"
   });
 }
});

router.post("/chat", async (req, res) => {
 try {
   const { q, question } = req.body;
   const userQuestion = q || question;

   if (!userQuestion) {
     return res.status(400).json({
       status: false,
       error: "Missing required parameter: q or question",
       example: "POST /api/claude/chat with body: { \"q\": \"hi\" }"
     });
   }

   const result = await ClaudeAIHelper.ask(userQuestion);

   return res.status(200).json({
     status: true,
     question: result.question,
     answer: result.answer,
     timestamp: result.timestamp
   });

 } catch (error) {
   console.error("Claude AI Error:", error.message);
   return res.status(500).json({
     status: false,
     error: error.message || "Internal server error"
   });
 }
});

module.exports = {
 path: "/api/claude",
 name: "Claude AI Chat",
 type: "get",
 url: `${global.t || "http://localhost:3000"}/api/claude/chat?q=hi`,
 logo: "https://claude.ai/favicon.ico",
 category: "ai",
 info: "Chat with Claude AI via Takamura API",
 router
};
