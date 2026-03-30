const express = require("express");
const axios = require("axios");

const router = express.Router();

class Videy {
  constructor() {
    this.h = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      Referer: "https://videy.co/",
      Origin: "https://videy.co",
      Connection: "keep-alive"
    };
    this.cdn = "https://cdn.videy.co";
  }

  sz(b) {
    const i = b > 0 ? Math.floor(Math.log(b) / Math.log(1024)) : 0;
    return `${(b / Math.pow(1024, i)).toFixed(2)} ${"BKMGTPY"[i]}${i > 0 ? "B" : ""}`;
  }

  l(d) {
    return !d || d.length === 8 || (d.length === 9 && d.endsWith("1")) ? "mp4" : (d.length === 9 && d.endsWith("2")) ? "mov" : "mp4";
  }

  pid(u) {
    const s = u?.trim() || "";
    const q = s.match(/[?&]id=([^&]+)/)?.[1];
    return q || s.split("/").filter(Boolean).pop()?.split(".")[0] || "";
  }

  async download({ url, ...rest }) {
    try {
      const i = this.pid(url);
      if (!i || i.length < 5) throw new Error("ID_NOT_FOUND");
      
      const ext = this.l(i);
      const dl = `${this.cdn}/${i}.${ext}`;
      
      const res = await axios.head(dl, {
        headers: this.h,
        timeout: 10000,
        ...rest
      });

      const h = res?.headers || {};
      const b = parseInt(h["content-length"] || 0, 10);

      return {
        status: true,
        result: dl,
        id: i,
        ext: ext,
        type: h["content-type"] || `video/${ext}`,
        size: this.sz(b),
        bytes: b,
        meta: {
          server: h["server"] || "N/A",
          etag: h["etag"]?.replace(/"/g, "") || null,
          last_mod: h["last-modified"] || null,
          status: res?.status || 200
        },
        at: new Date().toISOString()
      };
    } catch (e) {
      return {
        status: false,
        result: null,
        ok: false,
        status: e?.response?.status || 500,
        error: e?.message || "ERROR"
      };
    }
  }
}

router.get("/download", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: url"
      });
    }

    const api = new Videy();
    const data = await api.download({ url });

    if (!data.status) {
      return res.status(data.status || 400).json({
        status: false,
        error: data.error || "Download failed"
      });
    }

    return res.status(200).json({
      status: true,
      downloadUrl: data.result,
      id: data.id,
      extension: data.ext,
      type: data.type,
      size: data.size,
      bytes: data.bytes,
      meta: data.meta,
      timestamp: data.at
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message || "Internal server error"
    });
  }
});

module.exports = {
  path: "/api/videy",
  name: "Videy Downloader",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/videy/download?url=https://videy.co/v/abc123`,
  logo: "https://videy.co/favicon.ico",
  category: "download",
  info: "Get direct download links for Videy.co videos",
  router
};

