const express = require("express");
const axios = require("axios");

const router = express.Router();

class AptoideDirectHelper {
  static getHeaders() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive"
    };
  }

  static async searchAndGetFirst(query) {
    const url = `http://ws75.aptoide.com/api/7/apps/search/query=${encodeURIComponent(query)}/limit=1`;
    
    const { data } = await axios.get(url, {
      headers: this.getHeaders(),
      timeout: 30000
    });

    if (!data.datalist || !data.datalist.list || !data.datalist.list.length) {
      throw new Error("No APK found for your query");
    }

    const app = data.datalist.list[0];
    const sizeMB = app.size ? (app.size / (1024 * 1024)).toFixed(2) : "Unknown";

    return {
      name: app.name || "Unknown",
      package_id: app.package || "",
      version: app.file?.vername || "N/A",
      size_mb: sizeMB,
      size_bytes: app.size || 0,
      updated: app.updated || "Unknown",
      icon: app.icon || null,
      download_url: app.file?.path_alt || app.file?.path || null,
      developer: app.store?.name || "Unknown",
      downloads: app.stats?.downloads || 0,
      rating: app.stats?.rating || 0
    };
  }
}

router.get("/download", async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: q",
        example: "/api/aptoide2/download?q=instagram"
      });
    }

    const result = await AptoideDirectHelper.searchAndGetFirst(q);

    if (!result.download_url) {
      return res.status(404).json({
        status: false,
        error: "Download link not available for this application"
      });
    }

    return res.status(200).json({
      status: true,
      app: result
    });

  } catch (error) {
    console.error("Aptoide2 Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal server error"
    });
  }
});

module.exports = {
  path: "/api/aptoide2",
  name: "Aptoide Direct APK",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/aptoide2/download?q=instagram`,
  logo: "https://aptoide.com/favicon.ico",
  category: "download",
  info: "Get direct APK download from Aptoide (first result only)",
  router
};

