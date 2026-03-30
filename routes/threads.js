const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

class ThreadsDownloaderHelper {
 static getHeaders(cookie = "", csrf = "") {
   const headers = {
     "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
     "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
     "Accept-Language": "en-US,en;q=0.9",
     "Accept-Encoding": "gzip, deflate, br",
     "Connection": "keep-alive",
     "Upgrade-Insecure-Requests": "1",
     "Origin": "https://sssthreads.net",
     "Referer": "https://sssthreads.net/"
   };

   if (cookie) headers["Cookie"] = cookie;
   if (csrf) headers["X-CSRF-TOKEN"] = csrf;

   return headers;
 }

 static async getSession() {
   const { data, headers } = await axios.get("https://sssthreads.net/", {
     headers: this.getHeaders(),
     timeout: 30000
   });

   const cookies = headers["set-cookie"];
   if (!cookies || !cookies.length) {
     throw new Error("Failed to get session cookies");
   }

   const cookieString = cookies.map(v => v.split(";")[0]).join("; ");
   const $ = cheerio.load(data);
   const csrf = $('meta[name="csrf-token"]').attr("content");

   if (!csrf) {
     throw new Error("Failed to get CSRF token");
   }

   return { cookies: cookieString, csrf };
 }

 static async fetchData(url, cookies, csrf) {
   const res = await axios.post(
     "https://sssthreads.net/fetch-data",
     { url },
     {
       headers: {
         ...this.getHeaders(cookies, csrf),
         "Content-Type": "application/json"
       },
       timeout: 30000
     }
   );

   const $ = cheerio.load(res.data.html);

   const authorNameSelectors = [".author-name", ".username", ".user-name", "h1", "h2"];
   let authorName = "";
   for (const selector of authorNameSelectors) {
     authorName = $(selector).first().text().trim();
     if (authorName) break;
   }

   const avatarSelectors = [".author-avatar", ".avatar img", ".user-avatar", "img.avatar"];
   let avatar = "";
   for (const selector of avatarSelectors) {
     avatar = $(selector).first().attr("src");
     if (avatar) break;
   }

   const captionSelectors = [".post-description", ".caption", ".description", ".content p"];
   let caption = "";
   for (const selector of captionSelectors) {
     caption = $(selector).first().text().trim();
     if (caption) break;
   }

   const author = {
     username: authorName || null,
     avatar: avatar || null,
     caption: caption || null
   };

   const media = [];
   const mediaSelectors = [".media-item", ".download-item", ".media", ".post-media"];

   for (const selector of mediaSelectors) {
     $(selector).each((_, el) => {
       const thumbSelectors = [".thumbnail-img", ".thumb img", "img.thumbnail", ".preview img"];
       let thumb = "";
       for (const thumbSel of thumbSelectors) {
         thumb = $(el).find(thumbSel).attr("data-src") || $(el).find(thumbSel).attr("src");
         if (thumb) break;
       }

       const linkSelectors = [".download-link", "a.download", "a[href]", ".link"];
       const links = $(el).find(linkSelectors.join(", "));

       let video = null;
       let mp3 = null;
       let image = null;

       links.each((__, a) => {
         const href = $(a).attr("href");
         const text = $(a).text().toLowerCase();

         if (!href) return;

         if (text.includes("video") || href.includes("video")) video = href;
         else if (text.includes("mp3") || href.includes("mp3")) mp3 = href;
         else if (text.includes("photo") || text.includes("image") || href.includes("image")) image = href;
       });

       if (video || image) {
         media.push({
           type: video ? "video" : "image",
           thumbnail: thumb,
           download: video || image,
           mp3: mp3
         });
       }
     });

     if (media.length > 0) break;
   }

   return { author, media };
 }

 static async download(url) {
   if (!/threads\.net|threads\.com/.test(url)) {
     throw new Error("Invalid Threads URL");
   }

   const { cookies, csrf } = await this.getSession();
   const result = await this.fetchData(url, cookies, csrf);

   if (!result.media.length) {
     throw new Error("No media found in this Threads post");
   }

   return result;
 }
}

router.get("/download", async (req, res) => {
 try {
   const { url } = req.query;

   if (!url) {
     return res.status(400).json({
       status: false,
       error: "Missing required parameter: url",
       example: "/api/threads/download?url=https://www.threads.net/@username/post/xxxxx"
     });
   }

   if (!/threads\.net|threads\.com/.test(url)) {
     return res.status(400).json({
       status: false,
       error: "Invalid Threads URL"
     });
   }

   const result = await ThreadsDownloaderHelper.download(url);

   return res.status(200).json({
     status: true,
     url: url,
     author: result.author,
     total_media: result.media.length,
     media: result.media
   });

 } catch (error) {
   console.error("Threads Download Error:", error.message);
   return res.status(500).json({
     status: false,
     error: error.message || "Internal server error"
   });
 }
});

module.exports = {
 path: "/api/threads",
 name: "Threads Downloader",
 type: "get",
 url: `${global.t || "http://localhost:3000"}/api/threads/download?url=https://www.threads.net/@username/post/xxxxx`,
 logo: "https://www.threads.net/favicon.ico",
 category: "download",
 info: "Download media from Threads posts via sssthreads.net",
 router
};

