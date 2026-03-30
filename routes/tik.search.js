const express = require("express");
const axios = require("axios");

const router = express.Router();

class TikTokSearchHelper {
  static getHeaders() {
    return {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Cookie": "current_language=en",
      "Origin": "https://tikwm.com",
      "Referer": "https://tikwm.com/"
    };
  }

  static async search(query, count = 12) {
    const payload = new URLSearchParams({
      keywords: query,
      count: count.toString(),
      cursor: "0",
      web: "1",
      hd: "1"
    });

    const { data } = await axios.post("https://tikwm.com/api/feed/search", payload, {
      headers: this.getHeaders(),
      timeout: 30000
    });

    if (!data.data?.videos?.length) {
      throw new Error("No results found");
    }

    return data.data.videos.map((video, index) => ({
      position: index + 1,
      id: video.id || video.video_id || "",
      title: video.title || "No title",
      author: {
        nickname: video.author?.nickname || "Unknown",
        username: video.author?.unique_id || "",
        avatar: video.author?.avatar ? "https://tikwm.com" + video.author.avatar : null
      },
      duration: video.duration || 0,
      views: video.play_count || 0,
      likes: video.digg_count || 0,
      comments: video.comment_count || 0,
      shares: video.share_count || 0,
      thumbnail: video.cover ? "https://tikwm.com" + video.cover : null,
      video_url: video.hdplay ? "https://tikwm.com" + video.hdplay : 
                 video.play ? "https://tikwm.com" + video.play : null,
      sd_video_url: video.play ? "https://tikwm.com" + video.play : null,
      hd_video_url: video.hdplay ? "https://tikwm.com" + video.hdplay : null,
      music: video.music_info ? {
        title: video.music_info.title || "",
        author: video.music_info.author || "",
        url: video.music_info.play ? "https://tikwm.com" + video.music_info.play : null
      } : null
    }));
  }
}

const searchCache = {};

router.get("/search", async (req, res) => {
  try {
    const { q, limit, session_id } = req.query;

    if (!q) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: q",
        example: "/api/ttsearch/search?q=cat&limit=12"
      });
    }

    const searchLimit = parseInt(limit) || 12;
    if (searchLimit < 1 || searchLimit > 30) {
      return res.status(400).json({
        status: false,
        error: "Limit must be between 1 and 30"
      });
    }

    const results = await TikTokSearchHelper.search(q, searchLimit);

    const newSessionId = session_id || Date.now().toString(36) + Math.random().toString(36).substr(2);
    searchCache[newSessionId] = {
      query: q,
      results: results,
      timestamp: Date.now()
    };

    return res.status(200).json({
      status: true,
      query: q,
      session_id: newSessionId,
      total: results.length,
      videos: results
    });

  } catch (error) {
    console.error("TikTok Search Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal server error"
    });
  }
});

router.get("/video", async (req, res) => {
  try {
    const { session_id, number } = req.query;

    if (!session_id) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: session_id"
      });
    }

    if (!number || isNaN(number)) {
      return res.status(400).json({
        status: false,
        error: "Missing or invalid parameter: number",
        example: "/api/ttsearch/video?session_id=abc123&number=1"
      });
    }

    const cache = searchCache[session_id];
    if (!cache) {
      return res.status(404).json({
        status: false,
        error: "Session not found or expired. Please search first."
      });
    }

    const videoIndex = parseInt(number) - 1;
    const video = cache.results[videoIndex];

    if (!video) {
      return res.status(404).json({
        status: false,
        error: "Invalid video number",
        total_available: cache.results.length
      });
    }

    return res.status(200).json({
      status: true,
      query: cache.query,
      position: parseInt(number),
      video: video
    });

  } catch (error) {
    console.error("TikTok Video Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal server error"
    });
  }
});

module.exports = {
  path: "/api/ttsearch",
  name: "TikTok Video Search",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/ttsearch/search?q=cat&limit=12`,
  logo: "https://www.tiktok.com/favicon.ico",
  category: "search",
  info: "Search TikTok videos via tikwm.com API with session support",
  router
};

