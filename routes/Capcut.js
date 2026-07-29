const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

const API_URL = "https://3bic.com/api/download";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Content-Type": "application/json",
  "Origin": "https://3bic.com",
  "Referer": "https://3bic.com/",
  "Connection": "keep-alive",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache"
};

class CapCutDownloader {
  constructor() {
    this.client = axios.create({
      timeout: 30000,
      headers: HEADERS
    });
  }

  async download(url) {
    const { data } = await this.client.post(API_URL, { url: url });

    if (!data || !data.originalVideoUrl) {
      throw new Error("Failed to fetch data from CapCut API");
    }

    const base64url = data.originalVideoUrl.split("/api/cdn/")[1];
    if (!base64url) {
      throw new Error("Failed to extract video CDN path");
    }

    const video = Buffer.from(base64url, "base64").toString();

    return {
      status: true,
      title: data.title || "",
      author: data.authorName || "",
      thumbnail: data.coverUrl || "",
      video: video,
      originalUrl: url
    };
  }
}

function isCapCutUrl(url) {
  const regex = /^https?:\/\/(www\.)?(capcut\.com|capcut\.net|ssccut\.com)\//i;
  return regex.test(url);
}

router.get("/download", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || url.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'url' is required",
        example: `${global.t || "http://localhost:3000"}/api/capcut/download?url=https://www.capcut.net/sharevideo?template_id=xxxx`,
        usage: "Download CapCut template videos",
        supportedFormats: [
          "https://www.capcut.com/...",
          "https://www.capcut.net/...",
          "https://ssccut.com/..."
        ]
      });
    }

    const trimmedUrl = url.trim();

    if (!isCapCutUrl(trimmedUrl)) {
      return res.status(400).json({
        status: false,
        error: "Invalid CapCut URL format",
        example: "https://www.capcut.net/sharevideo?template_id=7446548553788411141",
        supportedDomains: ["capcut.com", "capcut.net", "ssccut.com"]
      });
    }

    const downloader = new CapCutDownloader();
    const result = await downloader.download(trimmedUrl);

    return res.status(200).json(result);

  } catch (error) {
    console.error("CapCut Download API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error",
      message: "Failed to download CapCut video"
    });
  }
});

router.post("/download", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || url.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'url' is required in request body",
        example: {
          url: "https://www.capcut.net/sharevideo?template_id=7446548553788411141"
        }
      });
    }

    const trimmedUrl = url.trim();

    if (!isCapCutUrl(trimmedUrl)) {
      return res.status(400).json({
        status: false,
        error: "Invalid CapCut URL format",
        example: "https://www.capcut.net/sharevideo?template_id=7446548553788411141"
      });
    }

    const downloader = new CapCutDownloader();
    const result = await downloader.download(trimmedUrl);

    return res.status(200).json(result);

  } catch (error) {
    console.error("CapCut Download API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error"
    });
  }
});

module.exports = {
  path: "/api/capcut",
  name: "CapCut Downloader",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/capcut/download?url=https://www.capcut.com/template-detail/Trending-Instagram/7649800881449258261`,
  logo: "https://www.capcut.com/favicon.ico",
  category: "download",
  info: "Download CapCut template videos with title, author, thumbnail and direct video URL extraction",
  router
};
