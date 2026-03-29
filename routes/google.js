const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

// 🔎 Endpoint
router.get("/google", async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        status: false,
        error: "❌ خاصك دير ?q=keyword"
      });
    }

    const url = `https://www.google.com/search?q=${encodeURIComponent(q)}`;

    const { data } = await axios.get(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
      }
    });

    const $ = cheerio.load(data);

    const results = [];

    $("div.g").each((i, el) => {
      const title = $(el).find("h3").text();
      const link = $(el).find("a").attr("href");
      const snippet = $(el).find(".VwiC3b").text();

      if (title && link) {
        results.push({
          title,
          link,
          snippet
        });
      }
    });

    res.json({
      status: true,
      query: q,
      total: results.length,
      results
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      error: err.message
    });
  }
});

// 📦 Export
module.exports = {
  path: "/api/search",
  name: "Google Search",
  type: "get",
  url: `${global.t}/api/search/google?q=chatgpt`,
  logo: "https://www.google.com/favicon.ico",
  category: "search",
  info: "Google search scraping API",
  router
};
