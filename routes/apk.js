const express = require("express");
const axios = require("axios");

const router = express.Router();

class AptoideHelper {
  static getHeaders() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive"
    };
  }

  static async search(query, limit = 10) {
    const url = `https://ws75.aptoide.com/api/7/apps/search?query=${encodeURIComponent(query)}&limit=${limit}`;
    
    const { data } = await axios.get(url, {
      headers: this.getHeaders(),
      timeout: 30000
    });

    if (!data.datalist || !data.datalist.list || data.datalist.list.length === 0) {
      return [];
    }

    return data.datalist.list.map((app, index) => ({
      position: index + 1,
      name: app.name || "Unknown",
      package_id: app.package || "",
      size: app.size || "Unknown",
      version: app.file?.vername || "N/A",
      downloads: app.stats?.downloads || 0,
      rating: app.stats?.rating || 0,
      icon: app.icon || null,
      store: app.store?.name || "Unknown"
    }));
  }

  static async getDownloadInfo(packageId) {
    const url = `https://ws75.aptoide.com/api/7/apps/search?query=${encodeURIComponent(packageId)}&limit=1`;
    
    const { data } = await axios.get(url, {
      headers: this.getHeaders(),
      timeout: 30000
    });

    if (!data.datalist || !data.datalist.list || data.datalist.list.length === 0) {
      throw new Error("Application not found");
    }

    const app = data.datalist.list[0];

    return {
      name: app.name || "Unknown",
      package_id: app.package || "",
      developer: app.store?.name || "Unknown",
      version: app.file?.vername || "N/A",
      size: app.size || "Unknown",
      icon: app.icon || null,
      download_url: app.file?.path || null,
      downloads: app.stats?.downloads || 0,
      rating: app.stats?.rating || 0,
      description: app.description || ""
    };
  }
}

router.get("/search", async (req, res) => {
  try {
    const { q, limit } = req.query;

    if (!q) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: q",
        example: "/api/aptoide/search?q=facebook&limit=10"
      });
    }

    const searchLimit = parseInt(limit) || 10;
    if (searchLimit < 1 || searchLimit > 50) {
      return res.status(400).json({
        status: false,
        error: "Limit must be between 1 and 50"
      });
    }

    const results = await AptoideHelper.search(q, searchLimit);

    if (!results.length) {
      return res.status(404).json({
        status: false,
        error: "No results found for your search"
      });
    }

    return res.status(200).json({
      status: true,
      query: q,
      total: results.length,
      apps: results
    });

  } catch (error) {
    console.error("Aptoide Search Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal server error"
    });
  }
});

router.get("/download", async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: id (package name)",
        example: "/api/aptoide/download?id=com.facebook.katana"
      });
    }

    const result = await AptoideHelper.getDownloadInfo(id);

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
    console.error("Aptoide Download Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal server error"
    });
  }
});

module.exports = {
  path: "/api/aptoide",
  name: "Aptoide APK Search",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/aptoide/search?q=facebook&limit=10`,
  logo: "https://aptoide.com/favicon.ico",
  category: "download",
  info: "Search and download Android APKs from Aptoide store",
  router
};

