const express = require("express");
const axios = require("axios");

const router = express.Router();

class AptoideSearchHelper {
  static getHeaders() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive"
    };
  }

  static formatSize(bytes) {
    if (!bytes || bytes === 0) return "Unknown";
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + " " + sizes[i];
  }

  static async search(query, limit = 25) {
    const url = `http://ws75.aptoide.com/api/7/apps/search/query=${encodeURIComponent(query)}/limit=${limit}`;
    
    const { data } = await axios.get(url, {
      headers: this.getHeaders(),
      timeout: 30000
    });

    if (!data.datalist || !data.datalist.list || !data.datalist.list.length) {
      throw new Error("No apps found");
    }

    return {
      info: {
        status: data.info?.status || "OK",
        time: data.info?.time || {}
      },
      total: data.datalist.total || 0,
      count: data.datalist.count || 0,
      apps: data.datalist.list.map((app, index) => ({
        position: index + 1,
        id: app.id,
        name: app.name,
        package: app.package,
        developer: app.developer?.name || "Unknown",
        size: this.formatSize(app.size),
        size_bytes: app.size,
        version: app.file?.vername || "Unknown",
        version_code: app.file?.vercode,
        icon: app.icon,
        graphic: app.graphic,
        updated: app.updated,
        added: app.added,
        modified: app.modified,
        rating: {
          avg: app.stats?.rating?.avg || 0,
          total: app.stats?.rating?.total || 0
        },
        downloads: app.stats?.downloads || 0,
        malware_rank: app.file?.malware?.rank || "UNKNOWN",
        download_url: app.file?.path_alt || app.file?.path || null,
        obb: app.obb ? {
          filename: app.obb.main?.filename,
          size: this.formatSize(app.obb.main?.filesize),
          url: app.obb.main?.path
        } : null,
        store: {
          name: app.store?.name,
          avatar: app.store?.avatar
        }
      }))
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
        example: "/api/aptoide-search/search?q=free+fire&limit=25"
      });
    }

    const searchLimit = parseInt(limit) || 25;
    if (searchLimit < 1 || searchLimit > 100) {
      return res.status(400).json({
        status: false,
        error: "Limit must be between 1 and 100"
      });
    }

    const result = await AptoideSearchHelper.search(q, searchLimit);

    return res.status(200).json({
      status: true,
      query: q,
      total_results: result.total,
      returned_count: result.count,
      info: result.info,
      apps: result.apps
    });

  } catch (error) {
    console.error("Aptoide Search Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal server error"
    });
  }
});

module.exports = {
  path: "/api/aptoide-search",
  name: "Aptoide App Search",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/aptoide-search/search?q=free+fire&limit=25`,
  logo: "https://aptoide.com/favicon.ico",
  category: "download",
  info: "Search Android apps from Aptoide store with full details",
  router
};
