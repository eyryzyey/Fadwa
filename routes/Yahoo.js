const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

async function searchYahoo(query) {
  const url = `https://api.joanimi-world.online/api/yahoo?q=${encodeURIComponent(query)}`;

  const headers = {
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "accept": "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9",
    "accept-encoding": "gzip, deflate, br",
    "referer": "https://api.joanimi-world.online/",
    "origin": "https://api.joanimi-world.online"
  };

  const { data } = await axios.get(url, { headers });

  if (data.status !== "true" || !data.results || data.results.length === 0) {
    throw new Error("No results found");
  }

  return {
    link: data.link,
    results: data.results.map(item => ({
      title: item.title,
      link: item.link,
      description: item.description,
      favicon: item.favicon
    }))
  };
}

router.get("/search", async (req, res) => {
  try {
    const { q, query } = req.query;

    const searchQuery = q || query;

    if (!searchQuery || typeof searchQuery !== "string" || searchQuery.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Missing or invalid parameter: 'q' or 'query' is required",
        example: `${global.t || "http://localhost:3000"}/api/yahoo/search?q=egypt`
      });
    }

    const result = await searchYahoo(searchQuery.trim());

    return res.status(200).json({
      status: true,
      query: searchQuery.trim(),
      searchUrl: result.link,
      total: result.results.length,
      results: result.results
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message || "Failed to search Yahoo"
    });
  }
});

module.exports = {
  path: "/api/yahoo",
  name: "Yahoo Search",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/yahoo/search?q=egypt`,
  logo: "https://cdn-icons-png.flaticon.com/512/732/732223.png",
  category: "search",
  info: "Search the web using Yahoo",
  router
};

