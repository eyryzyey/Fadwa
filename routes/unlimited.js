const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

async function unlimitedAI(text) {
 const url = `https://super-fire.vercel.app/api/unlimited?text=${encodeURIComponent(text)}`;

 const headers = {
   "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
   "accept": "application/json, text/plain, */*",
   "accept-language": "en-US,en;q=0.9",
   "accept-encoding": "gzip, deflate, br",
   "referer": "https://super-fire.vercel.app/",
   "origin": "https://super-fire.vercel.app"
 };

 const { data } = await axios.get(url, { headers });

 if (!data.status || !data.reply) {
   throw new Error("Failed to get AI response");
 }

 return {
   reply: data.reply
 };
}

router.get("/chat", async (req, res) => {
 try {
   const { q, query, text } = req.query;

   const inputText = q || query || text;

   if (!inputText || typeof inputText !== "string" || inputText.trim().length === 0) {
     return res.status(400).json({
       status: false,
       error: "Missing or invalid parameter: 'q', 'query', or 'text' is required",
       example: `${global.t || "http://localhost:3000"}/api/unlimited/chat?q=hello`
     });
   }

   const result = await unlimitedAI(inputText.trim());

   return res.status(200).json({
     status: true,
     query: inputText.trim(),
     reply: result.reply
   });

 } catch (error) {
   return res.status(500).json({
     status: false,
     error: error.message || "Failed to get Unlimited AI response"
   });
 }
});

module.exports = {
 path: "/api/unlimited",
 name: "Unlimited AI Chat",
 type: "get",
 url: `${global.t || "http://localhost:3000"}/api/unlimited/chat?q=hello`,
 logo: "https://cdn-icons-png.flaticon.com/512/3659/3659956.png",
 category: "ai",
 info: "AI chat powered by UnlimitedAI",
 router
};

