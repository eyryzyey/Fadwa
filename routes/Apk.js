const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

async function searchApk(appName) {
  const apiUrl = "https://api.nexoracle.com/downloader/apk";
  const params = {
    apikey: "free_key@maher_apis",
    q: appName
  };

  const headers = {
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "accept": "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9",
    "accept-encoding": "gzip, deflate, br",
    "referer": "https://api.nexoracle.com/",
    "origin": "https://api.nexoracle.com"
  };

  const { data } = await axios.get(apiUrl, { params, headers });

  if (!data || data.status !== 200 || !data.result) {
    throw new Error("Application not found");
  }

  return {
    name: data.result.name,
    lastUpdate: data.result.lastup,
    package: data.result.package,
    size: data.result.size,
    icon: data.result.icon,
    downloadUrl: data.result.dllink
  };
}

router.get("/search", async (req, res) => {
  try {
    const { q, query, app } = req.query;

    const appName = q || query || app;

    if (!appName || typeof appName !== "string" || appName.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Missing or invalid parameter: 'q', 'query', or 'app' is required",
        example: "/api/apk/search?q=whatsapp"
      });
    }

    const result = await searchApk(appName.trim());

    return res.status(200).json({
      status: true,
      name: result.name,
      lastUpdate: result.lastUpdate,
      package: result.package,
      size: result.size,
      icon: result.icon,
      downloadUrl: result.downloadUrl
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message || "Failed to search for APK"
    });
  }
});

module.exports = {
  path: "/api/apk",
  name: "APK Downloader",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/apk/search?q=whatsapp`,
  logo: "https://cdn-icons-png.flaticon.com/512/888/888857.png",
  category: "download",
  info: "Search and download Android APK files",
  router
};
