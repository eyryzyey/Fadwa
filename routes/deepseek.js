const express = require("express");
const axios = require("axios");

const router = express.Router();

class DeepSeekHelper {
 constructor(apiKey = "937e9831-d15e-4674-8bd3-a30be3e148e9") {
   this.apiKey = apiKey;
   this.baseURL = "https://ark.cn-beijing.volces.com/api/v3";
 }

 getHeaders() {
   return {
     "Authorization": `Bearer ${this.apiKey}`,
     "Content-Type": "application/json",
     "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
     "Accept": "application/json, text/plain, */*",
     "Accept-Language": "en-US,en;q=0.9",
     "Accept-Encoding": "gzip, deflate, br",
     "Connection": "keep-alive"
   };
 }

 async chat(prompt, options = {}) {
   const messages = options.messages || [];
   const model = options.model || "deepseek-v3-1-250821";

   messages.push({
     role: "user",
     content: prompt || ""
   });

   const payload = {
     model: model,
     messages: messages,
     max_tokens: options.max_tokens || 1024,
     temperature: options.temperature ?? 0.1
   };

   const { data } = await axios.post(`${this.baseURL}/chat/completions`, payload, {
     headers: this.getHeaders(),
     timeout: 60000
   });

   const result = data?.choices?.[0]?.message?.content || "";

   if (result) {
     messages.push({
       role: "assistant",
       content: result
     });
   }

   return {
     result: result,
     history: messages,
     info: {
       id: data?.id,
       usage: data?.usage,
       model: data?.model
     }
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
       example: "/api/deepseek/ask?q=hi"
     });
   }

   const helper = new DeepSeekHelper();

   const options = {
     messages: [],
     model: "deepseek-v3-1-250821",
     max_tokens: 1024,
     temperature: 0.1
   };

   const response = await helper.chat(userPrompt, options);

   return res.status(200).json({
     status: true,
     question: userPrompt,
     answer: response.result,
     info: response.info
   });

 } catch (error) {
   console.error("DeepSeek Error:", error.message);
   return res.status(500).json({
     status: false,
     error: error?.response?.data?.error?.message || error.message || "Internal server error"
   });
 }
});

module.exports = {
 path: "/api/deepseek",
 name: "DeepSeek AI Chat",
 type: "get",
 url: `${global.t || "http://localhost:3000"}/api/deepseek/ask?q=hi`,
 logo: "https://www.deepseek.com/favicon.ico",
 category: "ai",
 info: "Chat with DeepSeek AI via Volces API",
 router
};

