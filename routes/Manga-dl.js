const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

const API_BASE = "https://engez.a7a.online/api/v1/anime/manga";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Referer": "https://engez.a7a.online/",
  "Origin": "https://engez.a7a.online"
};

class MangaAPI {
  constructor() {
    this.client = axios.create({
      timeout: 60000,
      headers: HEADERS
    });
  }

  async search(query) {
    const params = new URLSearchParams();
    params.append("action", "بحث");
    params.append("q", query);

    const { data } = await this.client.get(`${API_BASE}?${params.toString()}`);

    if (!data?.success) {
      throw new Error(data?.error || data?.message || "Search failed");
    }

    const results = data.results || [];

    return {
      query: query,
      totalResults: results.length,
      results: results.map((item, index) => ({
        index: index,
        id: item.id || null,
        title: item.title || "Unknown",
        summary: item.summary || null,
        cover: item.cover || item.thumbnail || null,
        url: item.url || null
      }))
    };
  }

  async chapters(mangaId) {
    const params = new URLSearchParams();
    params.append("action", "فصول");
    params.append("mangaId", mangaId);

    const { data } = await this.client.get(`${API_BASE}?${params.toString()}`);

    if (!data?.success) {
      throw new Error(data?.error || data?.message || "Failed to fetch chapters");
    }

    const chapters = data.chapters || [];

    return {
      mangaId: mangaId,
      title: data.title || "Unknown",
      total: data.total || chapters.length,
      chapters: chapters.map((ch, index) => ({
        index: index,
        id: ch.id || null,
        title: ch.title || `Chapter ${index + 1}`,
        order: ch.order || null,
        url: ch.url || null
      }))
    };
  }

  async images(mangaId, chapterId) {
    const params = new URLSearchParams();
    params.append("action", "صور");
    params.append("mangaId", mangaId);
    params.append("chapterId", chapterId);

    const { data } = await this.client.get(`${API_BASE}?${params.toString()}`);

    if (!data?.success) {
      throw new Error(data?.error || data?.message || "Failed to fetch images");
    }

    const images = data.images || [];

    return {
      mangaId: mangaId,
      chapterId: chapterId,
      totalImages: images.length,
      images: images.map((url, index) => ({
        index: index,
        page: index + 1,
        url: url
      }))
    };
  }

  async downloadImage(url) {
    const { data } = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 60000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "ar,en;q=0.9",
        "Referer": "https://mangamello.com/",
        "Connection": "keep-alive"
      }
    });
    return Buffer.from(data);
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
        example: `${global.t || "http://localhost:3000"}/api/manga/search?q=naruto`,
        usage: "Search for manga by title"
      });
    }

    if (searchQuery.length > 200) {
      return res.status(400).json({
        status: false,
        error: "Query too long (max 200 characters)"
      });
    }

    const api = new MangaAPI();
    const result = await api.search(searchQuery.trim());

    return res.status(200).json({
      status: true,
      ...result
    });

  } catch (error) {
    console.error("Manga Search API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error",
      message: "Failed to search manga"
    });
  }
});

router.get("/chapters", async (req, res) => {
  try {
    const { id, mangaId } = req.query;
    const targetId = id || mangaId;

    if (!targetId || targetId.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'id' or 'mangaId' is required",
        example: `${global.t || "http://localhost:3000"}/api/manga/chapters?id=420`,
        usage: "Get chapters list for a specific manga"
      });
    }

    const api = new MangaAPI();
    const result = await api.chapters(targetId.trim());

    return res.status(200).json({
      status: true,
      ...result
    });

  } catch (error) {
    console.error("Manga Chapters API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error",
      message: "Failed to fetch chapters"
    });
  }
});

router.get("/images", async (req, res) => {
  try {
    const { mangaId, chapterId, id, chapter } = req.query;
    const targetMangaId = mangaId || id;
    const targetChapterId = chapterId || chapter;

    if (!targetMangaId || targetMangaId.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'mangaId' or 'id' is required",
        example: `${global.t || "http://localhost:3000"}/api/manga/images?mangaId=420&chapterId=677116`,
        usage: "Get chapter images by manga ID and chapter ID"
      });
    }

    if (!targetChapterId || targetChapterId.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'chapterId' or 'chapter' is required",
        example: `${global.t || "http://localhost:3000"}/api/manga/images?mangaId=420&chapterId=677116`
      });
    }

    const api = new MangaAPI();
    const result = await api.images(targetMangaId.trim(), targetChapterId.trim());

    return res.status(200).json({
      status: true,
      ...result
    });

  } catch (error) {
    console.error("Manga Images API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error",
      message: "Failed to fetch chapter images"
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
          q: "naruto"
        }
      });
    }

    const api = new MangaAPI();
    const result = await api.search(searchQuery.trim());

    return res.status(200).json({
      status: true,
      ...result
    });

  } catch (error) {
    console.error("Manga Search API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error"
    });
  }
});

router.post("/chapters", async (req, res) => {
  try {
    const { id, mangaId } = req.body;
    const targetId = id || mangaId;

    if (!targetId) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'id' or 'mangaId' is required in request body",
        example: {
          id: "420"
        }
      });
    }

    const api = new MangaAPI();
    const result = await api.chapters(targetId.trim());

    return res.status(200).json({
      status: true,
      ...result
    });

  } catch (error) {
    console.error("Manga Chapters API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error"
    });
  }
});

router.post("/images", async (req, res) => {
  try {
    const { mangaId, chapterId, id, chapter } = req.body;
    const targetMangaId = mangaId || id;
    const targetChapterId = chapterId || chapter;

    if (!targetMangaId) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'mangaId' or 'id' is required in request body",
        example: {
          mangaId: "420",
          chapterId: "677116"
        }
      });
    }

    if (!targetChapterId) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'chapterId' or 'chapter' is required in request body"
      });
    }

    const api = new MangaAPI();
    const result = await api.images(targetMangaId.trim(), targetChapterId.trim());

    return res.status(200).json({
      status: true,
      ...result
    });

  } catch (error) {
    console.error("Manga Images API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error"
    });
  }
});

module.exports = {
  path: "/api/manga",
  name: "Manga download",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/manga/search?q=naruto`,
  logo: "https://cdn-icons-png.flaticon.com/512/3145/3145765.png",
  category: "download",
  info: "downloader manga, list chapters, and get chapter images for online manga reading",
  router
};

