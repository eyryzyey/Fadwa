const express = require("express");
const axios = require("axios");

const router = express.Router();

class UgoiraDownloader {
  constructor() {
    this.client = axios.create({
      baseURL: "https://ugoira.com",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "id-ID",
        "Accept-Encoding": "gzip, deflate, br",
        "Content-Type": "application/json",
        Origin: "https://ugoira.com",
        Priority: "u=1, i",
        Referer: "https://ugoira.com/",
        "Sec-Ch-Ua": '"Chromium";v="127", "Not)A;Brand";v="99", "Microsoft Edge Simulate";v="127", "Lemur";v="127"',
        "Sec-Ch-Ua-Mobile": "?1",
        "Sec-Ch-Ua-Platform": '"Android"',
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
        Connection: "keep-alive"
      },
      timeout: 30000,
      validateStatus: status => status >= 200 && status < 500
    });
  }

  parseIds(input) {
    try {
      let result = {
        illust: [],
        author: [],
        novel: []
      };

      if (!input || (typeof input !== "string" && typeof input !== "number")) {
        return result;
      }

      const text = String(input)
        .replace(/-_-/g, " ")
        .replace(/www\./gi, "")
        .replace(/pixiv\.net\//gi, "https://pixiv.net/")
        .replace(/https:\/\/https:\/\//gi, "https://")
        .replace(/http:\/\//gi, "https://")
        .replace(/https:\/\//gi, "\nhttps://")
        .replace(/ {2}/g, " ")
        .replace(/\+/g, " ")
        .replace(/\-/g, " ")
        .replace(/ /g, "\n")
        .replace(/\/en/gi, "");

      const lines = text.split("\n");

      lines.forEach(line => {
        if (!line.trim()) return;

        try {
          const url = new URL(line);
          if (url.hostname !== "pixiv.net") return;
          const path = url.pathname;

          if (path.startsWith("/artworks/") || path.startsWith("/i/")) {
            const parts = path.split("/");
            const id = parseInt(parts[parts.length - 1]);
            if (!isNaN(id)) result.illust.push(id);
            return;
          } else if (path.startsWith("/member_illust.php")) {
            const illustId = parseInt(url.searchParams.get("illust_id"));
            if (!isNaN(illustId)) result.illust.push(illustId);
            return;
          } else if (path.startsWith("/novel/show.php")) {
            const novelId = parseInt(url.searchParams.get("id"));
            if (!isNaN(novelId)) result.novel.push(novelId);
            return;
          } else if (path.startsWith("/users/") || path.startsWith("/u/")) {
            const parts = path.split("/");
            const userId = parseInt(parts[parts.length - 1]);
            if (!isNaN(userId)) result.author.push(userId);
            return;
          }
        } catch (error) {
          // Not a valid URL
        }

        const cleanLine = line.replace("#", "").replace("id=", "").replace("id", "").replace("=", "");
        if ((cleanLine.length === 8 || cleanLine.length === 9) && !isNaN(Number(cleanLine))) {
          const id = Number(cleanLine);
          result.illust.push(id);
        }
      });

      return result;
    } catch (error) {
      return {
        illust: [],
        author: [],
        novel: []
      };
    }
  }

  async download({ url, limit = 5, ...rest } = {}) {
    try {
      const inputText = url || rest.text || rest.id;
      if (!inputText) {
        throw new Error("Input teks atau URL diperlukan");
      }

      const ids = this.parseIds(inputText);
      if (ids.illust.length === 0) {
        throw new Error("Tidak ada ID illust yang valid ditemukan");
      }

      const illustIds = limit ? ids.illust.slice(0, limit) : ids.illust;

      const response = await this.client.post("/api/illusts/queue", {
        text: illustIds.join(" ")
      });

      if (!response.data) {
        throw new Error("Tidak ada data yang diterima dari server");
      }

      if (response.data?.ok === false) {
        throw new Error(`Server mengembalikan error: ${response.data.message || "Tidak diketahui"}`);
      }

      const result = { ...response.data };
      delete result.ok;

      return result;
    } catch (error) {
      if (error.code === "ECONNABORTED") {
        throw new Error(`Timeout: Permintaan melebihi batas waktu (${error.message})`);
      }
      if (error.response?.status) {
        throw new Error(`HTTP Error ${error.response.status}: ${error.message}`);
      }
      throw error;
    }
  }
}

router.post("/download", async (req, res) => {
  try {
    const { url, limit, text, id } = req.body;

    const input = url || text || id;
    if (!input) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: url, text, or id"
      });
    }

    const downloader = new UgoiraDownloader();
    const result = await downloader.download({ url, limit: limit || 5, text, id });

    return res.status(200).json({
      status: true,
      ...result
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error"
    });
  }
});

module.exports = {
  path: "/api/ugoira",
  name: "Ugoira Pixiv Downloader",
  type: "post",
  url: `${global.t || "http://localhost:3000"}/api/ugoira/download`,
  logo: "https://ugoira.com/favicon.ico",
  category: "download",
  info: "Download animated illustrations (ugoira) from Pixiv",
  router
};

