const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

class ApkMirrorAPI {
 constructor() {
   this.proxy = "https://api.allorigins.win/raw?url=";
 }

 async search({ query, ...custom }) {
   try {
     const searchUrl = `https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${encodeURIComponent(query)}`;
     const { data } = await axios.get(`${this.proxy}${encodeURIComponent(searchUrl)}`, {
       headers: {
         "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
         Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
         "Accept-Language": "en-US,en;q=0.9",
         "Accept-Encoding": "gzip, deflate, br",
         Connection: "keep-alive",
         "Upgrade-Insecure-Requests": "1"
       },
       ...custom
     });

     const $ = cheerio.load(data);
     const results = [];

     $(".appRow").each((_, el) => {
       const $el = $(el);
       const info = $el.next(".infoSlide");
       
       const item = {
         image: "https://www.apkmirror.com" + ($el.find(".ellipsisText").attr("src") || ""),
         link: "https://www.apkmirror.com" + ($el.find(".appRowTitle a").attr("href") || ""),
         title: $el.find(".appRowTitle a").text().trim(),
         developer: $el.find(".byDeveloper").text().trim(),
         uploadDate: $el.find(".dateyear_utc").text().trim(),
         version: info.find("p:nth-child(1) .infoSlide-value").text().trim(),
         fileSize: info.find("p:nth-child(3) .infoSlide-value").text().trim(),
         downloads: info.find("p:nth-child(4) .infoSlide-value").text().trim()
       };

       if (Object.values(item).every(v => v)) {
         results.push(item);
       }
     });

     return results;
   } catch (error) {
     throw new Error(`Search failed: ${error.message}`);
   }
 }

 async detail({ url, ...custom }) {
   try {
     const { data } = await axios.get(`${this.proxy}${encodeURIComponent(url)}`, {
       headers: {
         "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
         Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
         "Accept-Language": "en-US,en;q=0.9",
         "Accept-Encoding": "gzip, deflate, br",
         Connection: "keep-alive",
         "Upgrade-Insecure-Requests": "1"
       },
       ...custom
     });

     const $ = cheerio.load(data);
     const dlBtn = $(".downloadButton").attr("href");
     const dlLink = dlBtn ? "https://www.apkmirror.com" + dlBtn : null;

     if (dlLink?.includes("#downloads")) {
       const ogUrl = $('meta[property="og:url"]').attr("content");
       const { data: varData } = await axios.get(`${this.proxy}${encodeURIComponent(ogUrl + "#downloads")}`, {
         headers: {
           "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
           Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
         },
         ...custom
       });

       const $v = cheerio.load(varData);
       const variants = [];

       $v(".variants-table .table-row.headerFont").each((i, row) => {
         if (i === 0) return;
         const $row = $v(row);
         const version = $row.find("a.accent_color").text().trim().split("\n")[0]?.trim();
         
         if (version) {
           variants.push({
             version: version,
             bundle: $row.find(".apkm-badge.success").eq(0).text().trim() || null,
             splits: $row.find(".apkm-badge.success").eq(1).text().trim() || null,
             apkUrl: "https://www.apkmirror.com" + ($row.find("a.accent_color").attr("href") || ""),
             downloadDate: $row.find(".dateyear_utc").data("utcdate"),
             architecture: $row.find(".table-cell.dowrap").eq(0).text().trim(),
             minVersion: $row.find(".table-cell.dowrap").eq(1).text().trim(),
             dpi: $row.find(".table-cell.dowrap").eq(2).text().trim()
           });
         }
       });

       let directLink = null;
       if (variants[0]?.apkUrl) {
         try {
           const { data: vData } = await axios.get(`${this.proxy}${encodeURIComponent(variants[0].apkUrl)}`, {
             headers: {
               "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
               Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
             },
             ...custom
           });
           
           const $d = cheerio.load(vData);
           const form = $d("#filedownload");
           const id = form.find('input[name="id"]').attr("value");
           const key = form.find('input[name="key"]').attr("value");
           const force = form.find('input[name="forcebaseapk"]').attr("value");
           
           directLink = `https://www.apkmirror.com/wp-content/themes/APKMirror/download.php?id=${id}&key=${key}${force ? `&forcebaseapk=${force}` : ""}`;
         } catch (err) {
           // Could not get direct link for variant
         }
       }

       return {
         title: $('meta[property="og:title"]').attr("content"),
         image: $('meta[property="og:image"]').attr("content"),
         link: url,
         linkdl: directLink,
         downloadText: $(".downloadButton").text().trim(),
         author: url.split("/")[4]?.toUpperCase() || null,
         info: $(".infoSlide").text().trim(),
         description: $("#description .notes").text().trim() || $(".notes.wrapText.collapsable.collapsed").text().trim(),
         variants: variants
       };
     } else {
       const specs = {};
       
       $(".apk-detail-table .appspec-row").each((_, el) => {
         const label = $(el).find("svg").attr("title")?.toLowerCase() || "";
         const value = $(el).find(".appspec-value").text().trim();
         
         if (label && value) {
           if (label.includes("apk file size")) specs.size = value;
           else if (label.includes("upload details")) specs.tanggal = $(el).find(".datetime_utc").attr("data-utcdate");
           else if (label.includes("app: ")) specs.versionInfo = value;
           else if (label.includes("android version")) {
             specs.minAndroidVersion = value.split("Min: ")[1]?.split("Target:")[0]?.trim();
             specs.targetAndroidVersion = value.split("Target: ")[1]?.trim();
           } else if (label.includes("supported architectures")) {
             const parts = value.split("\n").map(p => p.trim()).filter(p => p);
             specs.architecture = parts[0] || null;
             specs.dpi = parts[1] || null;
           } else if (label.includes("downloads")) {
             specs.downloads = value.replace("Downloads:", "").trim();
           }
         }
       });

       const fullDescElement = $('div[role="tabpanel"][class="tab-pane "]').filter((_, el) => $(el).find('a.doc-anchor[name="description"]').length > 0).find(".notes.wrapText");
       const fullDesc = fullDescElement.length ? cheerio.load(fullDescElement.html()).text().trim() : "";

       return {
         title: $('meta[property="og:title"]').attr("content"),
         image: $('meta[property="og:image"]').attr("content"),
         link: url,
         linkdl: dlLink,
         downloadText: $(".downloadButton").text().trim(),
         author: url.split("/")[4]?.toUpperCase() || null,
         info: $(".appspec-value").first().text().trim(),
         description: fullDesc,
         ...specs
       };
     }
   } catch (error) {
     throw new Error(`Detail fetch failed: ${error.message}`);
   }
 }

 async download({ url, ...custom }) {
   const detail = await this.detail({ url, ...custom });
   
   if (!detail?.linkdl) {
     return detail;
   }

   try {
     const { data } = await axios.get(`${this.proxy}${encodeURIComponent(detail.linkdl)}`, {
       headers: {
         "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
         Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
       },
       ...custom
     });

     const $ = cheerio.load(data);
     const finalUrl = $("#download-link").attr("href");

     if (finalUrl) {
       return {
         ...detail,
         finalDownloadUrl: `https://www.apkmirror.com${finalUrl}`
       };
     }

     return detail;
   } catch (error) {
     return detail;
   }
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

   const apk = new ApkMirrorAPI();
   const results = await apk.search({ query: q });

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

   const apk = new ApkMirrorAPI();
   const result = await apk.detail({ url });

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

router.get("/download", async (req, res) => {
 try {
   const { url } = req.query;

   if (!url) {
     return res.status(400).json({
       status: false,
       error: "Missing required parameter: url"
     });
   }

   const apk = new ApkMirrorAPI();
   const result = await apk.download({ url });

   if (!result) {
     return res.status(404).json({
       status: false,
       error: "Download information not found"
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
 path: "/api/apkmirror",
 name: "APKMirror App Search",
 type: "get",
 url: `${global.t || "http://localhost:3000"}/api/apkmirror/search?q=whatsapp`,
 logo: "https://www.apkmirror.com/favicon.ico",
 category: "search",
 info: "Search, get details, and download APK files from APKMirror",
 router
};

