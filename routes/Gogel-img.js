const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

class GoogleImageHelper {
  static getHeaders() {
    return {
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1"
    };
  }

  static async searchImages(query, limit = 20) {
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&sclient=mobile-gws-wiz-img&udm=2`;
    
    const { data: html } = await axios.get(url, {
      headers: this.getHeaders(),
      timeout: 30000
    });

    const $ = cheerio.load(html);
    const imageUrls = [];

    const selectors = [
      "img.DS1iW",
      "img.gs-image",
      "img.rg_i",
      "img.Q4LuWd",
      "img[data-src]",
      "img[src^='http']"
    ];

    for (const selector of selectors) {
      $(selector).each((i, el) => {
        const imgUrl = $(el).attr("src") || $(el).attr("data-src");
        if (imgUrl && imgUrl.startsWith("http") && !imageUrls.includes(imgUrl)) {
          imageUrls.push(imgUrl);
        }
      });
      if (imageUrls.length >= limit) break;
    }

    return imageUrls.slice(0, limit);
  }
}

router.get("/search", async (req, res) => {
  try {
    const { q, limit } = req.query;

    if (!q) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: q",
        example: "/api/googleimg/search?q=naruto&limit=10"
      });
    }

    const searchLimit = parseInt(limit) || 10;
    if (searchLimit < 1 || searchLimit > 50) {
      return res.status(400).json({
        status: false,
        error: "Limit must be between 1 and 50"
      });
    }

    const images = await GoogleImageHelper.searchImages(q, searchLimit);

    if (images.length === 0) {
      return res.status(404).json({
        status: false,
        error: "No images found, try another keyword"
      });
    }

    return res.status(200).json({
      status: true,
      query: q,
      total: images.length,
      images: images
    });

  } catch (error) {
    console.error("Google Image Search Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal server error"
    });
  }
});

module.exports = {
  path: "/api/googleimg",
  name: "Google Image Search",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/googleimg/search?q=naruto&limit=10`,
  logo: "https://www.google.com/favicon.ico",
  category: "search",
  info: "Search Google Images and get direct image URLs",
  router
};

