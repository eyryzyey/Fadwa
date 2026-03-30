const express = require("express");
const axios = require("axios");

const router = express.Router();

class AptoideSimpleHelper {
 static getHeaders() {
   return {
     "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
     "Accept": "application/json, text/plain, */*",
     "Accept-Language": "en-US,en;q=0.9",
     "Accept-Encoding": "gzip, deflate, br",
     "Connection": "keep-alive"
   };
 }

 static formatSize(bytes) {
   if (!bytes || bytes === 0) return "Unknown";
   const sizes = ["Bytes", "KB", "MB", "GB"];
   const i = Math.floor(Math.log(bytes) / Math.log(1024));
   return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + " " + sizes[i];
 }

 static async search(query, limit = 25) {
   const url = `http://ws75.aptoide.com/api/7/apps/search/query=${encodeURIComponent(query)}/limit=${limit}`;
   
   const { data } = await axios.get(url, {
     headers: this.getHeaders(),
     timeout: 30000
   });

   if (!data.datalist || !data.datalist.list || data.datalist.list.length === 0) {
     throw new Error("No apps found");
   }

   const apps = data.datalist.list.map(app => ({
     id: app.id,
     name: app.name,
     package: app.package,
     size: app.size,
     size_formatted: this.formatSize(app.size),
     icon: app.icon,
     developer: app.developer?.name || "Unknown",
     version: app.file?.vername || "Unknown",
     filesize: app.file?.filesize || 0,
     filesize_formatted: this.formatSize(app.file?.filesize),
     rating: app.stats?.rating?.avg || 0,
     downloads: app.stats?.downloads || 0,
     apk: app.file?.path_alt || app.file?.path || null,
     obb: app.obb?.main?.path || null
   }));

   return {
     total: data.datalist.total || 0,
     count: data.datalist.count || apps.length,
     apps: apps
   };
 }
}

router.get("/search", async (req, res) => {
 try {
   const { q, limit } = req.query;

   if (!q) {
     return res.status(400).json({
       status: false,
       error: "Missing required parameter: q",
       example: "/api/aptoide-simple/search?q=free+fire&limit=25"
     });
   }

   const searchLimit = parseInt(limit) || 25;
   if (searchLimit < 1 || searchLimit > 100) {
     return res.status(400).json({
       status: false,
       error: "Limit must be between 1 and 100"
     });
   }

   const result = await AptoideSimpleHelper.search(q, searchLimit);

   return res.status(200).json({
     status: true,
     query: q,
     total: result.total,
     count: result.count,
     apps: result.apps
   });

 } catch (error) {
   console.error("Aptoide Simple Error:", error.message);
   return res.status(500).json({
     status: false,
     error: error.message || "Internal server error"
   });
 }
});

module.exports = {
 path: "/api/aptoide-simple",
 name: "Aptoide Simple Search",
 type: "get",
 url: `${global.t || "http://localhost:3000"}/api/aptoide-simple/search?q=free+fire&limit=25`,
 logo: "https://aptoide.com/favicon.ico",
 category: "search",
 info: "Simple Aptoide app search with formatted results",
 router
};

