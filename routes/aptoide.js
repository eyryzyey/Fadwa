const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

async function searchAptoide(query) {
  const url = `https://maroccan-api.vercel.app/api/apk/aptoide?query=${encodeURIComponent(query)}`;
  
  const headers = {
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "accept": "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9",
    "accept-encoding": "gzip, deflate, br",
    "referer": "https://maroccan-api.vercel.app/",
    "origin": "https://maroccan-api.vercel.app"
  };

  const { data } = await axios.get(url, { headers });

  if (!data.success || !data.result.apps || data.result.apps.length === 0) {
    throw new Error("No apps found");
  }

  return data.result.apps.map(app => ({
    name: app.name,
    developer: app.developer,
    rating: app.rating,
    size: Math.round(app.size / 1024 / 1024),
    sizeUnit: "MB",
    icon: app.icon,
    downloadUrl: app.apk
  }));
}

router.get("/search", async (req, res) => {
  try {
    const { q, query } = req.query;

    const searchQuery = q || query;

    if (!searchQuery || typeof searchQuery !== "string" || searchQuery.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Missing or invalid parameter: 'q' or 'query' is required",
        example: `${global.t || "http://localhost:3000"}/api/aptoide/search?q=whatsapp`
      });
    }

    const results = await searchAptoide(searchQuery.trim());

    return res.status(200).json({
      status: true,
      query: searchQuery.trim(),
      total: results.length,
      results: results
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message || "Failed to search Aptoide"
    });
  }
});

module.exports = {
  path: "/api/aptoide",
  name: "Aptoide APK Search",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/aptoide/search?q=whatsapp`,
  logo: "https://cdn-icons-png.flaticon.com/512/888/888857.png",
  category: "download",
  info: "Search and download Android APK files from Aptoide",
  router
};

