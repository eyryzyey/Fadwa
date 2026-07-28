const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

const PINTEREST_API = "https://www.pinterest.com/resource/BaseSearchResource/get/";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Referer": "https://www.pinterest.com/",
  "Origin": "https://www.pinterest.com",
  "screen-dpr": "4",
  "x-pinterest-pws-handler": "www/search/[scope].js"
};

class PinterestSearch {
  constructor() {
    this.client = axios.create({
      timeout: 20000,
      maxRedirects: 5,
      decompress: true
    });
  }

  async search(query) {
    const dataParam = encodeURIComponent(
      JSON.stringify({ options: { query: query } })
    );

    const response = await this.client.head(PINTEREST_API, {
      params: { data: dataParam },
      headers: HEADERS,
      validateStatus: () => true
    });

    if (response.status < 200 || response.status >= 400) {
      throw new Error(`Connection error: ${response.status} ${response.statusText}`);
    }

    const linkHeader = response.headers["link"];
    if (!linkHeader) {
      throw new Error(`No results found for: ${query}`);
    }

    const links = [];
    const regex = /<(.*?)>/gm;
    let match;
    while ((match = regex.exec(linkHeader)) !== null) {
      if (match[1] && !links.includes(match[1])) {
        links.push(match[1]);
      }
    }

    if (links.length === 0) {
      throw new Error(`No results found for: ${query}`);
    }

    return links.map((url, index) => ({
      index: index,
      url: url,
      type: this.detectType(url)
    }));
  }

  detectType(url) {
    if (/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url)) return "image";
    if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return "video";
    return "link";
  }
}

router.get("/search", async (req, res) => {
  try {
    const { q, query } = req.query;
    const searchQuery = q || query;

    if (!searchQuery || searchQuery.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'q' or 'query' is required",
        example: `${global.t || "http://localhost:3000"}/api/pinterest/search?q=furina`,
        usage: "Search for images on Pinterest"
      });
    }

    if (searchQuery.length > 200) {
      return res.status(400).json({
        status: false,
        error: "Query too long (max 200 characters)"
      });
    }

    const pinterest = new PinterestSearch();
    const results = await pinterest.search(searchQuery.trim());

    return res.status(200).json({
      status: true,
      query: searchQuery.trim(),
      totalResults: results.length,
      results: results
    });

  } catch (error) {
    console.error("Pinterest Search API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error",
      message: "Failed to search Pinterest"
    });
  }
});

router.post("/search", async (req, res) => {
  try {
    const { q, query } = req.body;
    const searchQuery = q || query;

    if (!searchQuery || searchQuery.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'q' or 'query' is required in request body",
        example: {
          q: "furina"
        }
      });
    }

    if (searchQuery.length > 200) {
      return res.status(400).json({
        status: false,
        error: "Query too long (max 200 characters)"
      });
    }

    const pinterest = new PinterestSearch();
    const results = await pinterest.search(searchQuery.trim());

    return res.status(200).json({
      status: true,
      query: searchQuery.trim(),
      totalResults: results.length,
      results: results
    });

  } catch (error) {
    console.error("Pinterest Search API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error"
    });
  }
});

module.exports = {
  path: "/api/pinterest",
  name: "Pinterest Image Search",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/pinterest/search?q=furina`,
  logo: "https://www.pinterest.com/favicon.ico",
  category: "search",
  info: "Search Pinterest for images and media by keyword using Pinterest internal API",
  router
};
