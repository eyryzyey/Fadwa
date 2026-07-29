const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

const YT_REGEX = /(?:youtube\.com\/(?:watch\?v=|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/;
const API_INIT = "https://hub.convert1s.com/api/download";
const MAX_ATTEMPTS = 20;
const POLL_INTERVAL = 1500;

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Content-Type": "application/json",
  "Origin": "https://ssvid.cc",
  "Referer": "https://ssvid.cc/",
  "Connection": "keep-alive",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache"
};

class YTMP3Downloader {
  constructor() {
    this.client = axios.create({
      timeout: 30000,
      headers: HEADERS
    });
  }

  formatDuration(seconds) {
    if (!seconds) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  async download(ytUrl) {
    const initRes = await this.client.post(API_INIT, {
      url: ytUrl,
      audio: { bitrate: "128k" },
      output: { type: "audio", format: "mp3" }
    });

    const { statusUrl, title, duration } = initRes.data;

    if (!statusUrl) {
      throw new Error("Failed to get statusUrl from server");
    }

    let downloadData = null;
    let attempts = 0;

    while (!downloadData) {
      if (++attempts > MAX_ATTEMPTS) {
        throw new Error("Conversion timed out, please try again");
      }

      const statusRes = await this.client.get(statusUrl);

      if (statusRes.data.status === "completed") {
        downloadData = statusRes.data;
      } else if (statusRes.data.status === "error" || statusRes.data.status === "failed") {
        throw new Error("Conversion failed on the server side");
      } else {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
      }
    }

    if (!downloadData.downloadUrl) {
      throw new Error("No downloadUrl returned by the server");
    }

    return {
      title: downloadData.title || title || "Unknown",
      duration: downloadData.duration || duration || 0,
      durationFormatted: this.formatDuration(downloadData.duration || duration),
      downloadUrl: downloadData.downloadUrl,
      quality: "128k",
      format: "mp3",
      attempts: attempts,
      metadata: {
        timestamp: new Date().toISOString()
      }
    };
  }
}

function isYouTubeUrl(url) {
  return YT_REGEX.test(url);
}

function extractVideoId(url) {
  const match = url.match(YT_REGEX);
  return match ? match[1] : null;
}

router.get("/download", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || url.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'url' is required",
        example: `${global.t || "http://localhost:3000"}/api/ytmp3/download?url=https://youtu.be/NJMEtaDTVtA`,
        usage: "Download YouTube video as MP3 audio",
        supportedFormats: [
          "https://www.youtube.com/watch?v=xxxxx",
          "https://youtu.be/xxxxx",
          "https://www.youtube.com/shorts/xxxxx",
          "https://www.youtube.com/live/xxxxx"
        ]
      });
    }

    const trimmedUrl = url.trim();

    if (!isYouTubeUrl(trimmedUrl)) {
      return res.status(400).json({
        status: false,
        error: "Invalid YouTube URL format",
        example: "https://youtu.be/NJMEtaDTVtA",
        supportedFormats: [
          "youtube.com/watch?v=...",
          "youtu.be/...",
          "youtube.com/shorts/...",
          "youtube.com/live/..."
        ]
      });
    }

    const downloader = new YTMP3Downloader();
    const result = await downloader.download(trimmedUrl);

    return res.status(200).json({
      status: true,
      videoId: extractVideoId(trimmedUrl),
      ...result
    });

  } catch (error) {
    console.error("YTMP3 API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error",
      message: "Failed to download YouTube audio"
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
          url: "https://youtu.be/NJMEtaDTVtA"
        }
      });
    }

    const trimmedUrl = url.trim();

    if (!isYouTubeUrl(trimmedUrl)) {
      return res.status(400).json({
        status: false,
        error: "Invalid YouTube URL format",
        example: "https://youtu.be/NJMEtaDTVtA"
      });
    }

    const downloader = new YTMP3Downloader();
    const result = await downloader.download(trimmedUrl);

    return res.status(200).json({
      status: true,
      videoId: extractVideoId(trimmedUrl),
      ...result
    });

  } catch (error) {
    console.error("YTMP3 API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error"
    });
  }
});

router.get("/info", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || url.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'url' is required",
        example: `${global.t || "http://localhost:3000"}/api/ytmp3/info?url=https://youtu.be/NJMEtaDTVtA`
      });
    }

    const trimmedUrl = url.trim();

    if (!isYouTubeUrl(trimmedUrl)) {
      return res.status(400).json({
        status: false,
        error: "Invalid YouTube URL format"
      });
    }

    const downloader = new YTMP3Downloader();
    const result = await downloader.download(trimmedUrl);

    return res.status(200).json({
      status: true,
      videoId: extractVideoId(trimmedUrl),
      title: result.title,
      duration: result.duration,
      durationFormatted: result.durationFormatted,
      quality: result.quality,
      format: result.format,
      downloadUrl: result.downloadUrl
    });

  } catch (error) {
    console.error("YTMP3 Info API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error"
    });
  }
});

module.exports = {
  path: "/api/ytmp3",
  name: "YouTube MP3 Downloader",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/ytmp3/download?url=https://youtu.be/NJMEtaDTVtA`,
  logo: "https://www.youtube.com/favicon.ico",
  category: "download",
  info: "Download YouTube videos as MP3 audio (128k) with status polling and progress tracking",
  router
};
