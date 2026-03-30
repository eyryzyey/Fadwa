const express = require("express");
const axios = require("axios");
const FormData = require("form-data");

const router = express.Router();

class TikTokSearchHelper {
  static async searchVideos(query, count = 3) {
    try {
      const form = new FormData();
      form.append("keywords", query);
      form.append("count", count);
      form.append("cursor", 0);
      form.append("web", 1);
      form.append("hd", 1);

      const headers = {
        ...form.getHeaders(),
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Origin": "https://tikwm.com",
        "Referer": "https://tikwm.com/"
      };

      const { data } = await axios.post("https://tikwm.com/api/feed/search", form, {
        headers,
        timeout: 30000
      });

      if (!data.data || !data.data.videos || !Array.isArray(data.data.videos)) {
        return [];
      }

      const baseURL = "https://tikwm.com";
      
      return data.data.videos.map(video => ({
        title: video.title || "",
        play: baseURL + video.play,
        cover: video.cover ? baseURL + video.cover : null,
        author: video.author ? {
          username: video.author.unique_id || "",
          nickname: video.author.nickname || "",
          avatar: video.author.avatar ? baseURL + video.author.avatar : null
        } : null,
        duration: video.duration || 0,
        views: video.play_count || 0,
        likes: video.digg_count || 0,
        comments: video.comment_count || 0,
        shares: video.share_count || 0,
        created_at: video.create_time || null,
        region: video.region || ""
      }));
    } catch (error) {
      console.error("TikTok Search Error:", error.message);
      return [];
    }
  }
}

router.get("/search", async (req, res) => {
  try {
    const { q, count } = req.query;

    if (!q) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: q",
        example: "/api/tiktok/search?q=dance&count=5"
      });
    }

    const videoCount = parseInt(count) || 3;
    
    if (videoCount < 1 || videoCount > 20) {
      return res.status(400).json({
        status: false,
        error: "Count must be between 1 and 20"
      });
    }

    const videos = await TikTokSearchHelper.searchVideos(q, videoCount);

    if (!videos.length) {
      return res.status(404).json({
        status: false,
        error: "No videos found, try another keyword"
      });
    }

    return res.status(200).json({
      status: true,
      query: q,
      count: videos.length,
      videos: videos
    });

  } catch (error) {
    console.error("API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal server error"
    });
  }
});

module.exports = {
  path: "/api/tiktok",
  name: "TikTok Search",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/tiktok/search?q=dance&count=5`,
  logo: "https://www.tiktok.com/favicon.ico",
  category: "search",
  info: "Search TikTok videos via tikwm.com API",
  router
};

