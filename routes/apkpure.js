const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

class ApkPure {
 constructor() {
   this.baseHtml = "https://api.allorigins.win/raw?url=";
 }

 async search(query) {
   try {
     const url = `https://apkpure.com/id/search?q=${encodeURIComponent(query)}`;
     const response = await axios.get(`${this.baseHtml}${encodeURIComponent(url)}`, {
       headers: {
         "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
         Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
         "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
         "Accept-Encoding": "gzip, deflate, br",
         Connection: "keep-alive",
         "Upgrade-Insecure-Requests": "1"
       }
     });
     
     const $ = cheerio.load(response.data);
     const results = [];
     
     $("#search-app-list .search-res li").each((_, el) => {
       results.push({
         title: $(el).find(".p1").text().trim(),
         developer: $(el).find(".p2").text().trim(),
         rating: $(el).find(".star").text().trim(),
         link: $(el).find("a.dd").attr("href"),
         thumb: $(el).find("img").attr("src")
       });
     });

     return results;
   } catch (error) {
     throw new Error(`Search failed: ${error.message}`);
   }
 }

 async detail(url) {
   try {
     const response = await axios.get(`${this.baseHtml}${encodeURIComponent(url)}`, {
       headers: {
         "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
         Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
         "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
         "Accept-Encoding": "gzip, deflate, br",
         Connection: "keep-alive",
         "Upgrade-Insecure-Requests": "1"
       }
     });

     const $ = cheerio.load(response.data);
     const main = $("main.dt-details-new-box");
     const downloadLink = main.find(".download_apk_news").attr("href");
     const meta = this.extractMeta($);
     
     let media = null;
     if (downloadLink) {
       media = await this.getDownloadData(downloadLink);
     }

     return {
       title: main.find("h1").text().trim(),
       developer: main.find(".developer a").text().trim(),
       version: main.find(".version-name span").text().trim(),
       rating: main.find(".stars").text().trim(),
       updateDate: main.find(".dev-partnership-head-info li").eq(1).find(".head").text().trim(),
       androidOS: main.find(".dev-partnership-head-info li").eq(2).find(".head").text().trim(),
       downloadLink: downloadLink || "Tidak tersedia",
       media: media,
       ...meta
     };
   } catch (error) {
     throw new Error(`Detail fetch failed: ${error.message}`);
   }
 }

 async getDownloadData(link) {
   try {
     const response = await axios.get(`${this.baseHtml}${encodeURIComponent(link)}`, {
       headers: {
         "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
         Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
         "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
         "Accept-Encoding": "gzip, deflate, br",
         Connection: "keep-alive",
         "Upgrade-Insecure-Requests": "1"
       }
     });

     const $ = cheerio.load(response.data);
     const meta = this.extractMeta($);
     const variants = [];

     $("#version-list .apk").each((_, el) => {
       variants.push({
         version: $(el).find(".info-top .name").text().trim(),
         code: $(el).find(".info-top .code").text().trim(),
         size: $(el).find(".info-bottom .size").text().trim(),
         sdk: $(el).find(".info-bottom .sdk").text().trim(),
         link: $(el).find(".download-btn").attr("href")
       });
     });

     return {
       title: $(".download-process-box .download-content h2").text().trim() || "Status tidak tersedia",
       link: $(".download-fallback a#download_link").attr("href") || "",
       variants: variants,
       ...meta
     };
   } catch (error) {
     throw new Error(`Download data fetch failed: ${error.message}`);
   }
 }

 extractMeta($) {
   const meta = {};
   $("meta").each((_, el) => {
     const name = $(el).attr("name") || $(el).attr("property");
     if (name) {
       meta[name] = $(el).attr("content");
     }
   });
   return meta;
 }
}

router.get("/search", async (req, res) => {
 try {
   const { q } = req.query;

   if (!q) {
     return res.status(400).json({
       status: false,
       error: "Missing required parameter: q"
     });
   }

   const apk = new ApkPure();
   const results = await apk.search(q);

   return res.status(200).json({
     status: true,
     query: q,
     results: results,
     count: results.length
   });

 } catch (error) {
   return res.status(500).json({
     status: false,
     error: error.message
   });
 }
});

router.get("/detail", async (req, res) => {
 try {
   const { url } = req.query;

   if (!url) {
     return res.status(400).json({
       status: false,
       error: "Missing required parameter: url"
     });
   }

   const apk = new ApkPure();
   const result = await apk.detail(url);

   if (!result) {
     return res.status(404).json({
       status: false,
       error: "App not found or failed to fetch details"
     });
   }

   return res.status(200).json({
     status: true,
     data: result
   });

 } catch (error) {
   return res.status(500).json({
     status: false,
     error: error.message
   });
 }
});

module.exports = {
 path: "/api/apkpure",
 name: "APKPure App Search",
 type: "get",
 url: `${global.t || "http://localhost:3000"}/api/apkpure/search?q=whatsapp`,
 logo: "https://apkpure.com/favicon.ico",
 category: "search",
 info: "Search and get details of Android apps from APKPure",
 router
};

