const express = require("express");
const axios = require("axios");

const router = express.Router();

const API_CONFIG = {
  DOMAIN_KOYEB: process.env.DOMAIN_KOYEB || "api.example.com"
};

class MediafireDownloader {
  constructor() {
    this.apiUrl = `https://${API_CONFIG.DOMAIN_KOYEB}/mediafire?url=`;
  }

  async fetchMediafireData(url) {
    try {
      const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Referer": "https://mediafire.com/"
      };

      const { data } = await axios.get(`${this.apiUrl}${encodeURIComponent(url)}`, { headers });

      const {
        fileName = "N/A",
        downloadLink = "N/A",
        fileSize = "N/A",
        meta
      } = data;

      const {
        app_id,
        type,
        site_name,
        locale,
        title,
        image,
        card,
        site
      } = meta || {};

      return {
        fileName: fileName,
        downloadLink: downloadLink,
        fileSize: fileSize,
        meta: {
          appId: app_id || "N/A",
          type: type || "N/A",
          siteName: site_name || "N/A",
          locale: locale || "N/A",
          url: url || "N/A",
          title: title || "N/A",
          image: image || "N/A",
          card: card || "N/A",
          site: site || "N/A"
        }
      };
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch MediaFire data");
    }
  }
}

router.get("/download", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        status: false,
        error: "URL parameter is required. Example: ?url=https://www.mediafire.com/file/..."
      });
    }

    const mediafireUrlPattern = /^https?:\/\/(www\.)?mediafire\.com\/file\/.+/i;
    if (!mediafireUrlPattern.test(url)) {
      return res.status(400).json({
        status: false,
        error: "Invalid MediaFire URL format"
      });
    }

    const downloader = new MediafireDownloader();
    const result = await downloader.fetchMediafireData(url);

    return res.status(200).json({
      status: true,
      ...result
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message || "Internal server error"
    });
  }
});

router.post("/download", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        status: false,
        error: "URL is required in request body"
      });
    }

    const mediafireUrlPattern = /^https?:\/\/(www\.)?mediafire\.com\/file\/.+/i;
    if (!mediafireUrlPattern.test(url)) {
      return res.status(400).json({
        status: false,
        error: "Invalid MediaFire URL format"
      });
    }

    const downloader = new MediafireDownloader();
    const result = await downloader.fetchMediafireData(url);

    return res.status(200).json({
      status: true,
      ...result
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message || "Internal server error"
    });
  }
});

module.exports = {
  path: "/api/mediafire",
  name: "MediaFire Downloader",
  type: "get/post",
  url: `${global.t || "http://localhost:3000"}/api/mediafire/download?url=https://www.mediafire.com/file/...`,
  logo: "https://www.mediafire.com/images/logos/mf_logo.png",
  category: "download",
  info: "Fetch direct download links and metadata from MediaFire file URLs",
  router
};

