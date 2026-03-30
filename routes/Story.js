const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const router = express.Router();

class LulaStoryClient {
  constructor() {
    this.host = "https://storywav4.lulaservice.web.id";
    this.ua = "okhttp/3.12.0";
    this.pkg = "com.storywa.vidstatus.videostatus";
    this.devId = crypto.randomBytes(16).toString("hex");
    this.headers = {
      "User-Agent": this.ua,
      "Content-Type": "application/json",
      Accept: "application/json",
      Connection: "keep-alive"
    };
  }

  makeUrl(file, type) {
    if (!file) return null;
    const base = "https://storywav4.lulaservice.web.id/status/NewUploads";
    const filename = file.split("/").pop();
    const encoded = encodeURIComponent(filename);
    
    switch (type) {
      case "video":
        return `${base}/mojly/${encoded}`;
      case "thumb":
        return `${base}/mojly/thumbs/${encoded}`;
      case "profile":
        return `${base}/profile/${encoded}`;
      default:
        if (file.startsWith("http://") || file.startsWith("https://")) return file;
        if (file.startsWith("//")) return `https:${file}`;
        if (file.includes(".")) return `https://${file}`;
        return file;
    }
  }

  async req(method, path, data = {}) {
    const isGet = method === "GET";
    const queryString = isGet ? "?" + new URLSearchParams(data).toString() : "";
    const url = `${this.host}/${path}${queryString}`;
    const body = isGet ? undefined : {
      app: this.pkg,
      ...data
    };

    try {
      const { data: res, status } = await axios({
        method: method,
        url: url,
        data: body,
        headers: this.headers,
        timeout: 10000
      });

      return res?.msg || res || [];
    } catch (err) {
      throw new Error(`${method} ${path} failed: ${err.message}`);
    }
  }

  async search({ query, page = 1 }) {
    const raw = await this.req("POST", "getdatacategorywise1.php", {
      search: query || "cinta",
      page: page
    });
    return raw;
  }

  async by_cats({ cat = "Latest", page = 1 }) {
    const raw = await this.req("POST", "getdatacategorywise1.php", {
      cat: cat,
      page: page
    });
    return raw;
  }

  async cats({ cat = "Latest" }) {
    const raw = await this.req("POST", "getallcategory.php", {
      cat: cat
    });
    return raw;
  }

  async music() {
    const raw = await this.req("POST", "getAllMusicList.php", {});
    return raw;
  }

  async status({ page = 1, type = 0, lang = 0 } = {}) {
    const raw = await this.req("GET", "status/default.php", {
      page: page,
      "device-id": this.devId,
      type: type,
      lang: lang
    });

    return Array.isArray(raw) ? raw.map(item => ({
      id: item?.id ?? "0",
      title: item?.video_url?.replace(".mp4", "") || "Untitled",
      category: item?.cat_name || "Unknown",
      video: this.makeUrl(item?.video_url, "video"),
      thumb: this.makeUrl(item?.thumb_image, "thumb"),
      stats: {
        downloads: parseInt(item?.downloads) || 0,
        likes: parseInt(item?.likes) || 0,
        shares: parseInt(item?.shares) || 0
      },
      uploaded: item?.uploaded_on || null,
      isLiked: item?.is_liked || false
    })) : [];
  }

  async status_cats() {
    const raw = await this.req("GET", "status/default.php", {
      type: "category"
    });
    return raw;
  }

  async download({ id: videoId }) {
    const raw = await this.req("GET", "status/addDownloads.php", {
      id: videoId
    });

    if (Array.isArray(raw) && raw[0]) {
      const item = raw[0];
      return {
        id: item?.id,
        category: item?.cat_name,
        video: this.makeUrl(item?.video_url, "video"),
        thumb: this.makeUrl(item?.video_thumb, "thumb"),
        stats: {
          downloads: parseInt(item?.downloads) || 0,
          likes: parseInt(item?.likes) || 0,
          shares: parseInt(item?.shares) || 0
        },
        uploaded: item?.uploaded_on
      };
    }
    return null;
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

    const api = new LulaStoryClient();
    const response = await api.search({ query: q, page: page || 1 });

    return res.status(200).json({
      status: true,
      query: q,
      page: parseInt(page) || 1,
      result: response
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message
    });
  }
});

router.get("/by-category", async (req, res) => {
  try {
    const { cat, page } = req.query;

    if (!cat) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: cat"
      });
    }

    const api = new LulaStoryClient();
    const response = await api.by_cats({ cat, page: page || 1 });

    return res.status(200).json({
      status: true,
      category: cat,
      page: parseInt(page) || 1,
      result: response
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message
    });
  }
});

router.get("/categories", async (req, res) => {
  try {
    const { cat } = req.query;
    const api = new LulaStoryClient();
    const response = await api.cats({ cat: cat || "Latest" });

    return res.status(200).json({
      status: true,
      result: response
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message
    });
  }
});

router.get("/music", async (req, res) => {
  try {
    const api = new LulaStoryClient();
    const response = await api.music();

    return res.status(200).json({
      status: true,
      result: response
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message
    });
  }
});

router.get("/status", async (req, res) => {
  try {
    const { page, type, lang } = req.query;
    const api = new LulaStoryClient();
    const response = await api.status({ 
      page: parseInt(page) || 1, 
      type: parseInt(type) || 0, 
      lang: parseInt(lang) || 0 
    });

    return res.status(200).json({
      status: true,
      page: parseInt(page) || 1,
      count: response.length,
      result: response
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message
    });
  }
});

router.get("/status-categories", async (req, res) => {
  try {
    const api = new LulaStoryClient();
    const response = await api.status_cats();

    return res.status(200).json({
      status: true,
      result: response
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message
    });
  }
});

router.get("/download", async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: id"
      });
    }

    const api = new LulaStoryClient();
    const response = await api.download({ id });

    if (!response) {
      return res.status(404).json({
        status: false,
        error: "Video not found"
      });
    }

    return res.status(200).json({
      status: true,
      result: response
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message
    });
  }
});

module.exports = {
  path: "/api/lulastory",
  name: "Lula Story Video Status",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/lulastory/search?q=love`,
  logo: "https://storywav4.lulaservice.web.id/favicon.ico",
  category: "download",
  info: "Search and download WhatsApp video status from Lula Story",
  router
};

