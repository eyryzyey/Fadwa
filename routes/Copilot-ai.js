const express = require("express");
const axios = require("axios");

const router = express.Router();

class CopilotHelper {
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
   const url = `https://takamura.site/api/copilot/ask?text=${encodeURIComponent(question)}`;
   
   const { data } = await axios.get(url, {
     headers: this.getHeaders(),
     timeout: 60000
   });

   if (!data || data.status !== "success") {
     throw new Error("No answer received from API");
   }

   return {
     answer: data.answer || "No answer",
     status: data.status
   };
 }
}

router.get("/ask", async (req, res) => {
 try {
   const { text } = req.query;

   if (!text) {
     return res.status(400).json({
       status: false,
       error: "Missing required parameter: text",
       example: "/api/copilot/ask?text=what+is+javascript"
     });
   }

   const result = await CopilotHelper.ask(text);

   return res.status(200).json({
     status: true,
     question: text,
     answer: result.answer
   });

 } catch (error) {
   console.error("Copilot Error:", error.message);
   return res.status(500).json({
     status: false,
     error: error.message || "Internal server error"
   });
 }
});

module.exports = {
 path: "/api/copilot",
 name: "Copilot AI Chat",
 type: "get",
 url: `${global.t || "http://localhost:3000"}/api/copilot/ask?text=what+is+javascript`,
 logo: "https://copilot.microsoft.com/favicon.ico",
 category: "ai",
 info: "Chat with Copilot AI via Takamura API",
 router
};

