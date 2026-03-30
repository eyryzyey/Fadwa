const express = require("express");
const axios = require("axios");

const router = express.Router();

class GPT35Helper {
 static getHeaders() {
   return {
     "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
     "Accept": "application/json, text/plain, */*",
     "Accept-Language": "en-US,en;q=0.9",
     "Accept-Encoding": "gzip, deflate, br",
     "Connection": "keep-alive"
   };
 }

 static async ask(prompt) {
   const url = `https://takamura.site/api/ai/gpt-3.5?prompt=${encodeURIComponent(prompt)}`;
   
   const { data } = await axios.get(url, {
     headers: this.getHeaders(),
     timeout: 60000
   });

   if (!data.status || !data.result || !data.result.choices?.length) {
     throw new Error("No answer received from GPT-3.5");
   }

   const answer = data.result.choices[0].message.content;

   return {
     prompt: prompt,
     answer: answer,
     model: data.result.model || "gpt-3.5-turbo",
     timestamp: new Date().toISOString()
   };
 }
}

router.get("/ask", async (req, res) => {
 try {
   const { q, prompt, question } = req.query;
   const userPrompt = q || prompt || question;

   if (!userPrompt) {
     return res.status(400).json({
       status: false,
       error: "Missing required parameter: q, prompt or question",
       example: "/api/gpt3/ask?q=hi or /api/gpt3/ask?prompt=hi"
     });
   }

   const result = await GPT35Helper.ask(userPrompt);

   return res.status(200).json({
     status: true,
     prompt: result.prompt,
     answer: result.answer,
     model: result.model,
     timestamp: result.timestamp
   });

 } catch (error) {
   console.error("GPT-3.5 Error:", error.message);
   return res.status(500).json({
     status: false,
     error: error.message || "Internal server error"
   });
 }
});

router.post("/ask", async (req, res) => {
 try {
   const { q, prompt, question } = req.body;
   const userPrompt = q || prompt || question;

   if (!userPrompt) {
     return res.status(400).json({
       status: false,
       error: "Missing required parameter: q, prompt or question",
       example: "POST /api/gpt3/ask with body: { \"q\": \"hi\" }"
     });
   }

   const result = await GPT35Helper.ask(userPrompt);

   return res.status(200).json({
     status: true,
     prompt: result.prompt,
     answer: result.answer,
     model: result.model,
     timestamp: result.timestamp
   });

 } catch (error) {
   console.error("GPT-3.5 Error:", error.message);
   return res.status(500).json({
     status: false,
     error: error.message || "Internal server error"
   });
 }
});

module.exports = {
 path: "/api/gpt3",
 name: "GPT-3.5 AI Chat",
 type: "get",
 url: `${global.t || "http://localhost:3000"}/api/gpt3/ask?q=hi`,
 logo: "https://chat.openai.com/favicon.ico",
 category: "ai",
 info: "Chat with GPT-3.5 AI via Takamura API",
 router
};

