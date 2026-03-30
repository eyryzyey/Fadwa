const express = require("express");
const axios = require("axios");
const { wrapper } = require("axios-cookiejar-support");
const { CookieJar } = require("tough-cookie");
const cheerio = require("cheerio");

const router = express.Router();

class SoundCloud {
constructor() {
 this.jar = new CookieJar();
 this.base = "https://soundcloudmp3.org";
 this.api = wrapper(axios.create({
   jar: this.jar,
   withCredentials: true,
   baseURL: this.base,
   headers: {
     "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
     Accept: "application/json, text/javascript, */*; q=0.01",
     "Accept-Language": "id-ID",
     "Accept-Encoding": "gzip, deflate, br",
     Referer: "https://soundcloudmp3.org/",
     "X-Requested-With": "XMLHttpRequest",
     "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
     Connection: "keep-alive"
   }
 }));
}

async init() {
 try {
   const { data } = await this.api.get("/");
   const $ = cheerio.load(data);
   const token = $('meta[name="csrf-token"]')?.attr("content") || null;
   if (!token) throw new Error("Token tidak ditemukan");
   return token;
 } catch (e) {
   throw new Error(`Failed to initialize: ${e.message}`);
 }
}

async meta(url, token) {
 try {
   const form = new URLSearchParams();
   form.append("_token", token);
   form.append("url", url);
   const res = await this.api.post("/api/fetch-track", form);
   if (res.data?.status !== "success") throw new Error("Gagal fetch track");
   return res.data.track;
 } catch (e) {
   throw new Error(`Failed to fetch metadata: ${e.message}`);
 }
}

async start(track, token) {
 try {
   const form = new URLSearchParams();
   form.append("_token", token);
   form.append("soundcloud_id", track.soundcloud_id);
   form.append("tier", 1);
   form.append("download_id", Math.floor(Math.random() * 1000000));
   await this.api.post("/api/start-download", form);
 } catch (e) {
   // Continue to polling
 }
}

async poll(track) {
 const server = track.server_url ? track.server_url : "https://dl4.soundcloudmp3.org";
 const endpoint = `${server}/api/progress`;
 const form = new URLSearchParams();
 form.append("v", track.soundcloud_id);
 form.append("tier", 1);

 for (let i = 0; i < 60; i++) {
   try {
     await new Promise(r => setTimeout(r, 3000));
     const { data } = await this.api.post(endpoint, form);
     if (data?.cdn_url) {
       return data.cdn_url;
     }
   } catch (e) {
     // Continue polling
   }
 }
 throw new Error("Timeout polling download");
}

async download({ url, ...rest }) {
 const start = Date.now();
 try {
   const token = await this.init();
   const track = await this.meta(url, token);
   await this.start(track, token);
   const downloadUrl = await this.poll(track);
   
   return {
     status: true,
     title: track?.title,
     artist: track?.artist,
     duration: track?.length,
     image: track?.image,
     download: downloadUrl,
     input_url: url,
     time: `${(Date.now() - start) / 1000}s`,
     ...rest
   };
 } catch (error) {
   return {
     status: false,
     error: error?.message || "Error Unknown",
     input_url: url
   };
 }
}
}

router.get("/download", async (req, res) => {
try {
 const { url } = req.query;

 if (!url) {
   return res.status(400).json({
     status: false,
     error: "Missing required parameter: url"
   });
 }

 const api = new SoundCloud();
 const data = await api.download({ url });

 if (!data.status) {
   return res.status(400).json({
     status: false,
     error: data.error || "Download failed"
   });
 }

 return res.status(200).json({
   status: true,
   title: data.title,
   artist: data.artist,
   duration: data.duration,
   image: data.image,
   download: data.download,
   input_url: data.input_url,
   time: data.time
 });

} catch (error) {
 return res.status(500).json({
   status: false,
   error: error.message || "Internal server error"
 });
}
});

module.exports = {
path: "/api/soundcloud",
name: "SoundCloud Downloader",
type: "get",
url: `${global.t || "http://localhost:3000"}/api/soundcloud/download?url=https://soundcloud.com/artist/track`,
logo: "https://soundcloud.com/favicon.ico",
category: "download",
info: "Download tracks from SoundCloud as MP3",
router
};

