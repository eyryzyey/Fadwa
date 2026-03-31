const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

async function simSimiChat(message) {
 const url = `https://takamura.site/api/ai/simsimi?message=${encodeURIComponent(message)}`;
 
 const headers = {
   "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
   "accept": "application/json, text/plain, */*",
   "accept-language": "en-US,en;q=0.9",
   "accept-encoding": "gzip, deflate, br",
   "referer": "https://takamura.site/",
   "origin": "https://takamura.site"
 };

 const { data } = await axios.get(url, { headers });

 if (!data || !data.reply || !data.reply.sentence) {
   throw new Error("No response from SimSimi");
 }

 return {
   message: message,
   reply: data.reply.sentence,
   source: "SimSimi AI"
 };
}

router.get("/chat", async (req, res) => {
 try {
   const { q, query, message } = req.query;

   const chatMessage = q || query || message;

   if (!chatMessage || typeof chatMessage !== "string" || chatMessage.trim().length === 0) {
     return res.status(400).json({
       status: false,
       error: "Missing or invalid parameter: 'q', 'query', or 'message' is required",
       example: "/api/simsimi/chat?q=hello"
     });
   }

   const result = await simSimiChat(chatMessage.trim());

   return res.status(200).json({
     status: true,
     ...result
   });

 } catch (error) {
   return res.status(500).json({
     status: false,
     error: error.message || "Failed to get response from SimSimi"
   });
 }
});

module.exports = {
 path: "/api/simsimi",
 name: "SimSimi AI Chat",
 type: "get",
 url: `${global.t || "http://localhost:3000"}/api/simsimi/chat?q=hello`,
 logo: "https://cdn-icons-png.flaticon.com/512/4712/4712139.png",
 category: "ai",
 info: "Chat with SimSimi AI chatbot",
 router
};
