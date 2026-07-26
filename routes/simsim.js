const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

class SimsimiAI {
 constructor() {
   this.baseURL = "https://engez.a7a.online/api/v1/ai/ai/simsimi";
   this.headers = {
     "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
     "Accept": "application/json, text/plain, */*",
     "Accept-Language": "ar-SA,ar;q=0.9,en-US;q=0.8,en;q=0.7",
     "Accept-Encoding": "gzip, deflate, br",
     "Connection": "keep-alive",
     "Cache-Control": "no-cache",
     "Pragma": "no-cache",
     "Referer": "https://engez.a7a.online/",
     "Origin": "https://engez.a7a.online"
   };
 }

 async chat(message) {
   try {
     const { data } = await axios.get(this.baseURL, {
       params: {
         action: "تكلم",
         message: message
       },
       timeout: 15000,
       headers: this.headers,
       responseType: "json"
     });

     if (!data) {
       throw new Error("No response received from API");
     }

     if (data.success && data.response?.reply) {
       return {
         status: true,
         reply: data.response.reply,
         raw: data.response,
         metadata: {
           action: "تكلم",
           timestamp: new Date().toISOString()
         }
       };
     }

     throw new Error(data.error || data.message || "No reply found in response");

   } catch (error) {
     if (error.response) {
       const status = error.response.status;
       const apiMessage = error.response.data?.error || error.response.data?.message;
       throw new Error(`API error (${status}): ${apiMessage || error.message}`);
     } else if (error.request) {
       throw new Error("API did not respond within timeout");
     } else {
       throw new Error(error.message || "Unknown error occurred");
     }
   }
 }
}

// Endpoint GET /chat
router.get("/chat", async (req, res) => {
 try {
   const { message, text, msg } = req.query;
   const userMessage = message || text || msg;

   // Validation du paramètre message
   if (!userMessage || userMessage.trim().length === 0) {
     return res.status(400).json({
       status: false,
       error: "Parameter 'message' or 'text' is required",
       example: `${global.t || "http://localhost:3000"}/api/simsimi/chat?message=كيف%20حالك؟`,
       usage: "Chat with Simsimi AI bot",
       supportedParams: {
         message: "Your message to Simsimi (primary)",
         text: "Alternative parameter name",
         msg: "Alternative parameter name"
       }
     });
   }

   // Validation de la longueur
   if (userMessage.length > 500) {
     return res.status(400).json({
       status: false,
       error: "Message too long (max 500 characters)"
     });
   }

   const simsimi = new SimsimiAI();
   const result = await simsimi.chat(userMessage.trim());

   return res.status(200).json(result);

 } catch (error) {
   console.error("Simsimi API Error:", error.message);
   return res.status(500).json({
     status: false,
     error: error.message || "Internal Server Error",
     message: "Failed to get response from Simsimi AI"
   });
 }
});

// Endpoint POST /chat (pour les messages longs ou spéciaux)
router.post("/chat", async (req, res) => {
 try {
   const { message, text, msg } = req.body;
   const userMessage = message || text || msg;

   if (!userMessage || userMessage.trim().length === 0) {
     return res.status(400).json({
       status: false,
       error: "Parameter 'message' or 'text' is required in request body",
       example: {
         message: "كيف حالك؟"
       }
     });
   }

   if (userMessage.length > 500) {
     return res.status(400).json({
       status: false,
       error: "Message too long (max 500 characters)"
     });
   }

   const simsimi = new SimsimiAI();
   const result = await simsimi.chat(userMessage.trim());

   return res.status(200).json(result);

 } catch (error) {
   console.error("Simsimi API Error:", error.message);
   return res.status(500).json({
     status: false,
     error: error.message || "Internal Server Error"
   });
 }
});

module.exports = {
 path: "/api/simsimi",
 name: "Simsimi AI Chat",
 type: "get",
 url: `${global.t || "http://localhost:3000"}/api/simsimi/chat?message=كيف%20حالك؟`,
 logo: "https://cdn-icons-png.flaticon.com/512/742/742751.png",
 category: "ai",
 info: "Fun chatbot powered by Simsimi AI - Arabic friendly conversational bot",
 router
};

