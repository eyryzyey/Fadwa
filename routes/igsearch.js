const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

const CX = "e500c3a7a523b49df";
const CSE_BASE = "https://cse.google.com";
const RURL = Buffer.from("aHR0cHM6Ly9yZWVsc2ZpbmRlci5zYXRpc2h5YWRhdi5jb20v", "base64").toString();

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Linux; Android 16; SM-F966B Build) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  "X-Client-Data": "CJDjygE=",
  "Accept": "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Referer": "https://reelsfinder.satishyadav.com/",
  "Origin": "https://reelsfinder.satishyadav.com"
};

class ReelsFinder {
  constructor() {
    this.client = axios.create({
      headers: HEADERS,
      timeout: 30000,
      responseType: "text",
      decompress: true
    });
    this.configCache = null;
    this.configExpiry = 0;
  }

  async getCseConfig() {
    if (this.configCache && Date.now() < this.configExpiry) {
      return this.configCache;
    }

    const { data } = await this.client.get(`${CSE_BASE}/cse.js`, {
      params: { cx: CX }
    });

    const cfgMatch = data.match(/}\)\(({[\s\S]*?})\);/);
    if (!cfgMatch || !cfgMatch[1]) {
      throw new Error("Failed to extract CSE config from response");
    }

    const cfg = JSON.parse(cfgMatch[1]);
    this.configCache = cfg;
    this.configExpiry = Date.now() + 5 * 60 * 1000;

    return cfg;
  }

  async search(query, num = 10) {
    const cfg = await this.getCseConfig();

    const params = {
      rsz: "filtered_cse",
      num: Math.min(Math.max(parseInt(num) || 10, 1), 20),
      hl: "id",
      source: "gcsc",
      cselibv: cfg.cselibVersion,
      cx: CX,
      q: query,
      safe: "off",
      cse_tok: cfg.cse_token,
      lr: "",
      cr: "",
      gl: "id",
      filter: 0,
      sort: "",
      as_oq: "",
      as_sitesearch: "",
      exp: "cc,apo",
      oq: "",
      callback: "google.search.cse.api11171",
      rurl: RURL
    };

    const { data: rawData } = await this.client.get(`${CSE_BASE}/cse/element/v1`, { params });

    const jsonStart = rawData.indexOf("{");
    const jsonEnd = rawData.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error("Failed to locate JSON in CSE response");
    }

    const jsonString = rawData.slice(jsonStart, jsonEnd + 1);
    const jsonData = JSON.parse(jsonString);

    if (!jsonData.results || !Array.isArray(jsonData.results)) {
      throw new Error("No results array found in CSE response");
    }

    const results = jsonData.results
      .filter(item => item?.richSnippet?.metatags)
      .map((item, index) => {
        const meta = item.richSnippet.metatags;
        const thumb = item.pagemap?.cse_thumbnail?.[0]?.src || null;

        return {
          index: index,
          title: meta.ogTitle || item.title || "No Title",
          description: meta.ogDescription || item.snippet || "No Description",
          url: item.url || item.link || null,
          image: meta.ogImage || thumb || null,
          site: item.visibleUrl || item.formattedUrl || null
        };
      });

    return {
      totalResults: results.length,
      query: query,
      results: results
    };
  }
}

router.get("/search", async (req, res) => {
  try {
    const { q, query, num = 10 } = req.query;
    const searchQuery = q || query;

    if (!searchQuery || searchQuery.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'q' or 'query' is required",
        example: `${global.t || "http://localhost:3000"}/api/reels/search?q=funny%20cats&num=10`,
        usage: "Search for Instagram Reels via Google CSE",
        optionalParams: {
          num: "Number of results (1-20, default: 10)"
        }
      });
    }

    if (searchQuery.length > 200) {
      return res.status(400).json({
        status: false,
        error: "Query too long (max 200 characters)"
      });
    }

    const numInt = parseInt(num);
    if (isNaN(numInt) || numInt < 1 || numInt > 20) {
      return res.status(400).json({
        status: false,
        error: "Invalid num parameter (must be between 1 and 20)"
      });
    }

    const finder = new ReelsFinder();
    const data = await finder.search(searchQuery.trim(), numInt);

    return res.status(200).json({
      status: true,
      ...data
    });

  } catch (error) {
    console.error("Reels Search API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error",
      message: "Failed to search Instagram Reels"
    });
  }
});

router.post("/search", async (req, res) => {
  try {
    const { q, query, num = 10 } = req.body;
    const searchQuery = q || query;

    if (!searchQuery || searchQuery.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'q' or 'query' is required in request body",
        example: {
          q: "funny cats",
          num: 10
        }
      });
    }

    if (searchQuery.length > 200) {
      return res.status(400).json({
        status: false,
        error: "Query too long (max 200 characters)"
      });
    }

    const numInt = parseInt(num);
    if (isNaN(numInt) || numInt < 1 || numInt > 20) {
      return res.status(400).json({
        status: false,
        error: "Invalid num parameter (must be between 1 and 20)"
      });
    }

    const finder = new ReelsFinder();
    const data = await finder.search(searchQuery.trim(), numInt);

    return res.status(200).json({
      status: true,
      ...data
    });

  } catch (error) {
    console.error("Reels Search API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error"
    });
  }
});

module.exports = {
  path: "/api/reels",
  name: "Instagram Reels Search",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/reels/search?q=funny%20cats&num=10`,
  logo: "https://www.instagram.com/favicon.ico",
  category: "search",
  info: "Search Instagram Reels via Google Custom Search Engine with title, description, URL and thumbnail extraction",
  router
};

