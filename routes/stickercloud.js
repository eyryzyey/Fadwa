const express = require("express");
const axios = require("axios");

const router = express.Router();

class StickerCloud {
  constructor() {
    this.api = "https://api.stickers.cloud/v1/packs";
    this.headers = {
      authority: "api.stickers.cloud",
      accept: "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.9",
      origin: "https://stickers.cloud",
      "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
      connection: "keep-alive"
    };
  }

  async fetchData(endpoint, params = {}) {
    const url = new URL(`${this.api}${endpoint}`);
    url.search = new URLSearchParams(params).toString();

    try {
      const response = await axios.get(url.toString(), {
        headers: this.headers
      });

      const data = response.data;

      if (!data.success || (Array.isArray(data.result) && data.result.length === 0)) {
        return {
          status: false,
          result: {
            message: "Sticker nya gak ada. Coba pake keyword lain dahh."
          }
        };
      }

      return {
        status: true,
        ...data
      };
    } catch (error) {
      const message = error.code === "ECONNREFUSED" || error.code === "ENOTFOUND" 
        ? "Page nya gak ada woy, coba kurangi lagi input nya." 
        : "Error euy.";
      
      return {
        status: false,
        result: {
          message: message
        }
      };
    }
  }

  async search(query, page = 1) {
    return await this.fetchData("/search", {
      query: query,
      page: page
    });
  }

  async pack(slug) {
    return await this.fetchData(`/slug/${slug}`);
  }
}

router.get("/search", async (req, res) => {
  try {
    const { q, page } = req.query;

    if (!q) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: q"
      });
    }

    const stickerCloud = new StickerCloud();
    const result = await stickerCloud.search(q, page || 1);

    return res.status(200).json({
      status: result.status,
      query: q,
      page: parseInt(page) || 1,
      result: result.result || result
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message
    });
  }
});

router.get("/pack", async (req, res) => {
  try {
    const { slug } = req.query;

    if (!slug) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: slug"
      });
    }

    const stickerCloud = new StickerCloud();
    const result = await stickerCloud.pack(slug);

    return res.status(200).json({
      status: result.status,
      slug: slug,
      result: result.result || result
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message
    });
  }
});

module.exports = {
  path: "/api/stickercloud",
  name: "Sticker Cloud Search",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/stickercloud/search?q=cat`,
  logo: "https://stickers.cloud/favicon.ico",
  category: "search",
  info: "Search and get sticker packs from Sticker Cloud",
  router
};

