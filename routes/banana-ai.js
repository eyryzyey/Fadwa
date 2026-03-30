const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const router = express.Router();

class BananaAIHelper {
 constructor() {
   this.AES_KEY = "ai-enhancer-web__aes-key";
   this.AES_IV = "aienhancer-aesiv";
 }

 encryptSettings(obj) {
   const key = crypto.createHash("sha256").update(this.AES_KEY).digest();
   const iv = Buffer.from(this.AES_IV.padEnd(16, " ").slice(0, 16));
   
   const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
   let encrypted = cipher.update(JSON.stringify(obj), "utf8", "base64");
   encrypted += cipher.final("base64");
   return encrypted;
 }

 getHeaders() {
   return {
     "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
     "Content-Type": "application/json",
     "Origin": "https://aienhancer.ai",
     "Referer": "https://aienhancer.ai/ai-image-editor",
     "Accept": "application/json, text/plain, */*",
     "Accept-Language": "en-US,en;q=0.9"
   };
 }

 async enhanceImage(base64Image, prompt) {
   const settings = this.encryptSettings({
     prompt: prompt,
     aspect_ratio: "match_input_image",
     output_format: "png",
     max_images: 1,
     sequential_image_generation: "disabled"
   });

   const create = await axios.post(
     "https://aienhancer.ai/api/v1/r/image-enhance/create",
     {
       model: 2,
       image: `data:image/jpeg;base64,${base64Image}`,
       settings: settings
     },
     {
       headers: this.getHeaders(),
       timeout: 60000
     }
   );

   const taskId = create.data?.data?.id;
   if (!taskId) {
     throw new Error("Failed to create enhancement task");
   }

   const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

   for (let i = 0; i < 60; i++) {
     const result = await axios.post(
       "https://aienhancer.ai/api/v1/r/image-enhance/result",
       { task_id: taskId },
       {
         headers: this.getHeaders(),
         timeout: 30000
       }
     );

     const status = result.data?.data?.status;
     const output = result.data?.data?.output;

     if (status === "succeeded" && output) {
       return output;
     }

     if (status === "failed") {
       throw new Error("Image enhancement failed");
     }

     await delay(3000);
   }

   throw new Error("Timeout waiting for enhancement result");
 }
}

router.get("/banana-ai", async (req, res) => {
 try {
   const { url, prompt } = req.query;

   if (!url) {
     return res.status(400).json({
       status: false,
       error: "Missing required parameter: url",
       example: "/api/tools/banana-ai?url=https://example.com/image.jpg&prompt=improve+quality"
     });
   }

   if (!prompt) {
     return res.status(400).json({
       status: false,
       error: "Missing required parameter: prompt",
       example: "/api/tools/banana-ai?url=https://example.com/image.jpg&prompt=improve+quality"
     });
   }

   let imageBuffer;

   if (url.startsWith("http://") || url.startsWith("https://")) {
     const imageResponse = await axios.get(url, {
       responseType: "arraybuffer",
       timeout: 30000,
       headers: {
         "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
       }
     });
     imageBuffer = Buffer.from(imageResponse.data);
   } else {
     return res.status(400).json({
       status: false,
       error: "Invalid URL format. URL must start with http:// or https://"
     });
   }

   if (imageBuffer.length > 10 * 1024 * 1024) {
     return res.status(400).json({
       status: false,
       error: "Image too large. Max 10MB allowed"
     });
   }

   const base64Image = imageBuffer.toString("base64");
   const helper = new BananaAIHelper();
   const resultUrl = await helper.enhanceImage(base64Image, prompt);

   return res.status(200).json({
     status: true,
     source_url: url,
     prompt: prompt,
     result_url: resultUrl
   });

 } catch (error) {
   console.error("Banana AI Error:", error.message);
   return res.status(500).json({
     status: false,
     error: error.message || "Internal server error"
   });
 }
});

module.exports = {
 path: "/api/tools",
 name: "Banana AI Image Enhancer",
 type: "get",
 url: `${global.t || "http://localhost:3000"}/api/tools/banana-ai?url=https://example.com/image.jpg&prompt=improve+quality`,
 logo: "https://aienhancer.ai/favicon.ico",
 category: "ai",
 info: "Enhance images using AI Enhancer with custom prompts via URL",
 router
};

