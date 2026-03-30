const express = require("express");
const axios = require("axios");
const ytSearch = require("yt-search");

const router = express.Router();

class YouTubeSearchHelper {
  static async search(query) {
    try {
      const results = await ytSearch(query);
      return results.all || [];
    } catch (error) {
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  static formatDuration(timestamp) {
    if (!timestamp) return "N/A";
    return timestamp;
  }

  static formatViews(views) {
    if (!views) return "0";
    return views.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
}

router.get("/search", async (req, res) => {
  try {
    const { q, limit } = req.query;

    if (!q) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: q",
        example: "/api/youtube/search?q=noureddine+ouafy&limit=10"
      });
    }

    const searchLimit = parseInt(limit) || 10;
    
    if (searchLimit < 1 || searchLimit > 50) {
      return res.status(400).json({
        status: false,
        error: "Limit must be between 1 and 50"
      });
    }

    const allResults = await YouTubeSearchHelper.search(q);
    
    const videos = allResults
      .filter(item => item.type === "video")
      .slice(0, searchLimit)
      .map((video, index) => ({
        position: index + 1,
        title: video.title || "",
        url: video.url || "",
        videoId: video.videoId || "",
        thumbnail: video.thumbnail || "",
        duration: YouTubeSearchHelper.formatDuration(video.timestamp),
        published: video.ago || "",
        views: YouTubeSearchHelper.formatViews(video.views),
        author: video.author ? {
          name: video.author.name || "",
          channelId: video.author.channelId || "",
          url: video.author.url || ""
        } : null
      }));

    if (!videos.length) {
      return res.status(404).json({
        status: false,
        error: "No videos found for this query"
      });
    }

    return res.status(200).json({
      status: true,
      query: q,
      total: videos.length,
      videos: videos
    });

  } catch (error) {
    console.error("YouTube Search Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal server error"
    });
  }
});

module.exports = {
  path: "/api/youtube",
  name: "YouTube Search",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/youtube/search?q=nodejs+tutorial&limit=10`,
  logo: "https://www.youtube.com/favicon.ico",
  category: "search",
  info: "Search YouTube videos and get video links with metadata",
  router
};

