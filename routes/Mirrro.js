const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const FormData = require("form-data");

const router = express.Router();

class AIMirrorHelper {
 static BASE_URL = "https://be.aimirror.fun";
 
 static getHeaders(uid) {
   return {
     "User-Agent": "AIMirror/6.8.4+179 (android)",
     "store": "googleplay",
     "uid": uid,
     "env": "PRO",
     "accept-language": "en",
     "accept-encoding": "gzip",
     "package-name": "com.ai.polyverse.mirror",
     "host": "be.aimirror.fun",
     "content-type": "application/json",
     "app-version": "6.8.4+179"
   };
 }

 static sha1FromString(str) {
   return crypto.createHash("sha1").update(str, "utf8").digest("hex");
 }

 static withExt(hexHash, ext = ".jpg") {
   return `${hexHash}${ext}`;
 }

 static generateRandomHash() {
   const hexChars = "0123456789abcdef";
   return Array.from({ length: 16 }, () => hexChars[Math.floor(Math.random() * hexChars.length)]).join("");
 }

 static async fetchAppToken(hash, uid) {
   const url = `${this.BASE_URL}/app_token/v2`;
   const params = {
     cropped_image_hash: this.withExt(hash),
     uid: uid
   };
   const res = await axios.get(url, {
     params,
     headers: this.getHeaders(uid)
   });
   return res.data;
 }

 static async uploadPhoto(payload, hash, uid) {
   const body = new FormData();
   body.append("name", payload.name);
   body.append("key", payload.key);
   body.append("policy", payload.policy);
   body.append("OSSAccessKeyId", payload.OSSAccessKeyId);
   body.append("success_action_status", payload.success_action_status);
   body.append("signature", payload.signature);
   body.append("backend_type", payload.backend_type);
   body.append("region", payload.region);
   body.append("file", payload.file, {
     filename: this.withExt(hash),
     contentType: "application/octet-stream"
   });

   const headers = { ...body.getHeaders(), "User-Agent": "Dart/3.6 (dart:io)" };
   await axios.post(payload.upload_host, body, { headers });
 }

 static async requestDraw(imageKey, uid, payload = {}) {
   const url = `${this.BASE_URL}/draw?uid=${uid}`;
   const data = {
     model_id: payload.model_id || 271,
     cropped_image_key: imageKey,
     cropped_height: payload.cropped_height || 1024,
     cropped_width: payload.cropped_width || 768,
     package_name: "com.ai.polyverse.mirror",
     ext_args: {
       imagine_value2: payload.imagine_value2 || 50,
       custom_prompt: payload.custom_prompt || ""
     },
     version: "6.8.4",
     force_default_pose: payload.force_default_pose || false,
     is_free_trial: payload.is_free_trial !== false
   };
   const res = await axios.post(url, data, {
     headers: this.getHeaders(uid)
   });
   return res.data;
 }

 static async waitForDraw(draw_request_id, uid, delaySec = 7) {
   const url = `${this.BASE_URL}/draw/process`;
   while (true) {
     const res = await axios.get(url, {
       headers: this.getHeaders(uid),
       params: { draw_request_id, uid: uid }
     });
     const data = res.data;
     if (data.draw_status === "SUCCEED") return data.generated_image_addresses;
     if (data.draw_status === "FAILED") throw new Error("Draw failed");
     await new Promise(r => setTimeout(r, delaySec * 1000));
   }
 }

 static async processImage(imageBuffer, options = {}) {
   const uid = this.generateRandomHash();
   const hash = this.sha1FromString(crypto.randomUUID());

   const appToken = await this.fetchAppToken(hash, uid);
   const imageKey = appToken.key;
   appToken.file = imageBuffer;
   await this.uploadPhoto(appToken, hash, uid);

   const hyperParameter = {
     model_id: options.model_id || 271,
     cropped_height: options.cropped_height || 1024,
     cropped_width: options.cropped_width || 768,
     imagine_value2: options.imagine_value2 || 50,
     custom_prompt: options.custom_prompt || "",
     force_default_pose: options.force_default_pose || false,
     is_free_trial: options.is_free_trial !== false
   };

   const generate = await this.requestDraw(imageKey, uid, hyperParameter);
   const result = await this.waitForDraw(generate.draw_request_id, uid, 7);

   return result;
 }
}

router.get("/aiedit", async (req, res) => {
 try {
   const { url, model_id, cropped_height, cropped_width, imagine_value2, custom_prompt } = req.query;

   if (!url) {
     return res.status(400).json({
       status: false,
       error: "Missing required parameter: url",
       example: "/api/tools/aiedit?url=https://example.com/image.jpg"
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

   const options = {
     model_id: parseInt(model_id) || 271,
     cropped_height: parseInt(cropped_height) || 1024,
     cropped_width: parseInt(cropped_width) || 768,
     imagine_value2: parseInt(imagine_value2) || 50,
     custom_prompt: custom_prompt || "",
     force_default_pose: false,
     is_free_trial: true
   };

   const result = await AIMirrorHelper.processImage(imageBuffer, options);

   if (!result || result.length === 0) {
     return res.status(500).json({
       status: false,
       error: "Failed to generate image"
     });
   }

   return res.status(200).json({
     status: true,
     source_url: url,
     images: result,
     count: result.length
   });

 } catch (error) {
   console.error("AI Edit Error:", error.message);
   return res.status(500).json({
     status: false,
     error: error.message || "Internal server error"
   });
 }
});

module.exports = {
 path: "/api/tools",
 name: "AI Mirror Image Editor",
 type: "get",
 url: `${global.t || "http://localhost:3000"}/api/tools/aiedit?url=https://example.com/image.jpg`,
 logo: "https://be.aimirror.fun/favicon.ico",
 category: "ai",
 info: "Transform photos using AI Mirror - AI-powered image style transfer via URL",
 router
};

