const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

const BASE_URL = "https://id.pinterest.com";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0",
  "Accept": "application/json, text/javascript, */*, q=0.01",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "X-Requested-With": "XMLHttpRequest",
  "X-App-Version": "6d51d5a",
  "X-Pinterest-Appstate": "active",
  "X-Pinterest-Pws-Handler": "www/search/[scope].js",
  "Referer": "https://id.pinterest.com/"
};

class PinterestSearch {
  constructor() {
    this.client = axios.create({
      timeout: 30000,
      maxRedirects: 5,
      decompress: true
    });
  }

  async getSession() {
    const res = await this.client.get(BASE_URL + "/", {
      headers: {
        ...HEADERS,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
      }
    });

    const rawCookies = res.headers["set-cookie"] || [];
    const cookies = rawCookies.map(c => c.split(";")[0]).join("; ");

    let csrf = "";
    const csrfCookie = rawCookies.find(c => c.startsWith("csrftoken="));
    if (csrfCookie) {
      const match = csrfCookie.match(/csrftoken=([^;]+)/);
      if (match) csrf = match[1];
    }

    return { cookies, csrf };
  }

  async search(query, options = {}) {
    const { limit = 5, scope = "pins", bookmark = null } = options;
    const session = await this.getSession();

    const data = {
      options: {
        query,
        scope,
        page_size: limit,
        refine_search_with_filters: true,
        ...(bookmark ? { bookmarks: [bookmark] } : {})
      },
      context: {}
    };

    const sourceUrl = `/search/${scope}/?q=${encodeURIComponent(query)}`;
    const url = `${BASE_URL}/resource/BaseSearchResource/get/?source_url=${encodeURIComponent(sourceUrl)}&data=${encodeURIComponent(JSON.stringify(data))}&_=${Date.now()}`;

    const res = await this.client.get(url, {
      headers: {
        ...HEADERS,
        "Referer": `${BASE_URL}${sourceUrl}`,
        "X-Pinterest-Source-Url": sourceUrl,
        ...(session.csrf ? { "X-Csrftoken": session.csrf } : {}),
        ...(session.cookies ? { "Cookie": session.cookies } : {})
      }
    });

    const json = res.data;
    const payload = json?.resource_response?.data;

    if (!payload) {
      throw new Error("No data returned from Pinterest API");
    }

    const arr = Array.isArray(payload) ? payload : payload.results || [];

    const results = arr.filter(x => x?.id).map((pin, index) => ({
      index: index,
      id: pin.id,
      title: pin.title || pin.grid_title || "",
      image: pin.images?.orig?.url || pin.images?.["736x"]?.url || pin.images?.["474x"]?.url || null,
      video: pin.videos?.video_list?.V_HLSV4?.url
        || pin.videos?.video_list?.V_EXP7?.url
        || pin.videos?.video_list?.V_720P?.url
        || pin.videos?.video_list?.V_360P?.url
        || null,
      username: pin.pinner?.username || null,
      fullName: pin.pinner?.full_name || null,
      pinUrl: `https://id.pinterest.com/pin/${pin.id}/`
    }));

    return {
      query,
      count: results.length,
      bookmark: payload.bookmark || null,
      hasMore: !!payload.bookmark,
      results
    };
  }
}

router.get("/search", async (req, res) => {
  try {
    const { q, query, limit = 5, scope = "pins", bookmark = null } = req.query;
    const searchQuery = q || query;

    if (!searchQuery || searchQuery.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'q' or 'query' is required",
        example: `${global.t || "http://localhost:3000"}/api/pinterest/search?q=aesthetic%20wallpaper&limit=5`,
        usage: "Search Pinterest for pins, images and videos",
        optionalParams: {
          limit: "Number of results (default: 5, max: 50)",
          scope: "Search scope (default: pins)",
          bookmark: "Pagination token for next page"
        }
      });
    }

    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      return res.status(400).json({
        status: false,
        error: "Invalid limit parameter (must be between 1 and 50)"
      });
    }

    const pinterest = new PinterestSearch();
    const result = await pinterest.search(searchQuery.trim(), {
      limit: limitNum,
      scope: scope || "pins",
      bookmark: bookmark || null
    });

    return res.status(200).json({
      status: true,
      ...result
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
    const { q, query, limit = 5, scope = "pins", bookmark = null } = req.body;
    const searchQuery = q || query;

    if (!searchQuery || searchQuery.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'q' or 'query' is required in request body",
        example: {
          q: "aesthetic wallpaper",
          limit: 5,
          scope: "pins"
        }
      });
    }

    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      return res.status(400).json({
        status: false,
        error: "Invalid limit parameter (must be between 1 and 50)"
      });
    }

    const pinterest = new PinterestSearch();
    const result = await pinterest.search(searchQuery.trim(), {
      limit: limitNum,
      scope: scope || "pins",
      bookmark: bookmark || null
    });

    return res.status(200).json({
      status: true,
      ...result
    });

  } catch (error) {
    console.error("Pinterest Search API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error"
    });
  }
});

router.get("/next", async (req, res) => {
  try {
    const { q, query, bookmark, limit = 5, scope = "pins" } = req.query;
    const searchQuery = q || query;

    if (!searchQuery || searchQuery.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'q' or 'query' is required"
      });
    }

    if (!bookmark || bookmark.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'bookmark' is required for pagination",
        usage: "Use the 'bookmark' value from previous search response"
      });
    }

    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      return res.status(400).json({
        status: false,
        error: "Invalid limit parameter"
      });
    }

    const pinterest = new PinterestSearch();
    const result = await pinterest.search(searchQuery.trim(), {
      limit: limitNum,
      scope: scope || "pins",
      bookmark: bookmark.trim()
    });

    return res.status(200).json({
      status: true,
      ...result
    });

  } catch (error) {
    console.error("Pinterest Next API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error"
    });
  }
});

module.exports = {
  path: "/api/pinterest",
  name: "Pinterest Search",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/pinterest/search?q=aesthetic%20wallpaper&limit=5`,
  logo: "https://www.pinterest.com/favicon.ico",
  category: "search",
  info: "Search Pinterest pins with images and videos using Pinterest internal API with session management and pagination support",
  router
};

