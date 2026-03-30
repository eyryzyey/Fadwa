const express = require("express");
const axios = require("axios");

const router = express.Router();

class InstagramDownloader {
  static async fastdl(url) {
    try {
      url = url.split("?")[0];

      const headers = {
        accept: "*/*",
        "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
        referer: "https://fastdl.cc/",
        "accept-language": "en-US,en;q=0.9",
        "accept-encoding": "gzip, deflate, br",
        origin: "https://fastdl.cc",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin"
      };

      let endpoint;
      let referer;

      if (url.includes("/reel/")) {
        endpoint = "reels/download";
        referer = "https://fastdl.cc/reels";
      } else if (url.includes("/stories/")) {
        endpoint = "story/download";
        referer = "https://fastdl.cc/story";
      } else {
        endpoint = "img/download";
        referer = "https://fastdl.cc/photo";
      }

      headers.referer = referer;

      const { data } = await axios.get(
        `https://fastdl.cc/${endpoint}?url=${encodeURIComponent(url)}`,
        { headers, timeout: 30000 }
      );

      if (!data.success) throw new Error("Media not found");

      let media = [];

      if (data.images && Array.isArray(data.images)) {
        media = data.images.map(v => v.url);
      } else if (data.url) {
        media = [data.url];
      }

      return {
        status: true,
        type: data.type || "unknown",
        media: media,
        count: media.length
      };

    } catch (error) {
      return {
        status: false,
        error: error.message || "Failed to download media"
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
        error: "Missing required parameter: url",
        example: "/api/instagram/download?url=https://www.instagram.com/p/XXXXXXXXX/"
      });
    }

    if (!url.includes("instagram.com")) {
      return res.status(400).json({
        status: false,
        error: "Invalid URL. Please provide a valid Instagram link"
      });
    }

    const result = await InstagramDownloader.fastdl(url);

    if (!result.status) {
      return res.status(404).json({
        status: false,
        error: result.error,
        message: "Make sure the link is correct and the account is public"
      });
    }

    if (!result.media || result.media.length === 0) {
      return res.status(404).json({
        status: false,
        error: "No media found in that link"
      });
    }

    return res.status(200).json({
      status: true,
      platform: "instagram",
      type: result.type,
      count: result.count,
      media: result.media
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message || "Internal server error"
    });
  }
});

module.exports = {
  path: "/api/instagram",
  name: "Instagram Downloader",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/instagram/download?url=https://www.instagram.com/reel/DSDfYQXk-xK/?igsh=enZyNWF1OXB3ZDVo`,
  logo: "https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png",
  category: "download",
  info: "Download Instagram posts, reels, and stories via FastDL.cc",
  router
};
