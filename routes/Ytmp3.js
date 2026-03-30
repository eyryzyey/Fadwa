const express = require("express");
const axios = require("axios");

const router = express.Router();

class YouTubePlayHelper {
  static getHeaders() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive"
    };
  }

  static async searchAndDownload(query) {
    const url = `https://api.nexray.web.id/downloader/ytplay?q=${encodeURIComponent(query)}`;
    
    const { data } = await axios.get(url, {
      headers: this.getHeaders(),
      timeout: 60000
    });

    if (!data.status || !data.result?.download_url) {
      throw new Error("No results found");
    }

    const result = data.result;

    return {
      title: result.title || "Unknown Song",
      thumbnail: result.thumbnail || null,
      duration: result.duration || "Unknown",
      views: result.views || "0",
      channel: result.channel || "Unknown",
      source_url: result.url || null,
      download_url: result.download_url,
      audio_url: result.download_url,
      format: "mp3",
      type: "audio"
    };
  }
}

router.get("/play", async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: q",
        example: "/api/ytplay/play?q=funk+universo"
      });
    }

    if (q.length > 100) {
      return res.status(400).json({
        status: false,
        error: "Query too long! Max 100 characters"
      });
    }

    const result = await YouTubePlayHelper.searchAndDownload(q);

    return res.status(200).json({
      status: true,
      query: q,
      title: result.title,
      thumbnail: result.thumbnail,
      duration: result.duration,
      views: result.views,
      channel: result.channel,
      source_url: result.source_url,
      download_url: result.download_url,
      format: result.format,
      type: result.type
    });

  } catch (error) {
    console.error("YouTube Play Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal server error"
    });
  }
});

module.exports = {
  path: "/api/ytplay",
  name: "YouTube Audio Downloader",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/ytplay/play?q=https://www.youtube.com/watch?v=cbfpiuPhaP8`,
  logo: "https://www.youtube.com/favicon.ico",
  category: "download",
  info: "Search YouTube and get audio download links via NexRay API",
  router
};

