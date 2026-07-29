const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

const API_BASE = "https://engez.a7a.online/api/v1/download/terabox";

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

class TeraboxDownloader {
  constructor() {
    this.client = axios.create({
      timeout: 60000,
      headers: HEADERS,
      responseType: "json"
    });
  }

  async fetchData(url) {
    const { data } = await this.client.get(API_BASE, {
      params: { url: url }
    });

    if (!data?.success) {
      throw new Error(data?.error || data?.message || "فشل جلب البيانات");
    }

    if (!data.files || !Array.isArray(data.files) || data.files.length === 0) {
      throw new Error("لا توجد ملفات في هذا الرابط");
    }

    return data;
  }

  formatSize(bytes) {
    if (!bytes) return "0 B";
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }

  getExtension(filename) {
    if (!filename) return ".bin";
    const ext = require("path").extname(filename).toLowerCase();
    return ext || ".bin";
  }

  getMimeType(ext) {
    const mimeTypes = {
      ".mp4": "video/mp4",
      ".mkv": "video/x-matroska",
      ".avi": "video/x-msvideo",
      ".mov": "video/quicktime",
      ".pdf": "application/pdf",
      ".doc": "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".xls": "application/vnd.ms-excel",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".ppt": "application/vnd.ms-powerpoint",
      ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ".txt": "text/plain",
      ".zip": "application/zip",
      ".rar": "application/x-rar-compressed",
      ".7z": "application/x-7z-compressed",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav"
    };
    return mimeTypes[ext] || "application/octet-stream";
  }

  detectType(ext) {
    if ([".mp4", ".mkv", ".avi", ".mov", ".webm"].includes(ext)) return "video";
    if ([".mp3", ".wav", ".ogg", ".m4a"].includes(ext)) return "audio";
    if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"].includes(ext)) return "image";
    if ([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt"].includes(ext)) return "document";
    if ([".zip", ".rar", ".7z", ".tar", ".gz"].includes(ext)) return "archive";
    return "file";
  }

  formatFiles(files) {
    return files.map((file, index) => {
      const ext = this.getExtension(file.name);
      const sizeBytes = file.size || 0;
      return {
        index: index,
        name: file.name || "unknown",
        sizeBytes: sizeBytes,
        sizeFormatted: file.sizeFormatted || this.formatSize(sizeBytes),
        type: file.type || this.detectType(ext),
        extension: ext,
        mimeType: this.getMimeType(ext),
        downloadUrl: file.downloadUrl || null,
        duration: file.duration || null,
        quality: file.quality || null
      };
    });
  }

  async proxyFile(fileUrl, res) {
    const response = await axios.get(fileUrl, {
      responseType: "stream",
      timeout: 300000,
      maxRedirects: 5,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "*/*",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive"
      }
    });

    const contentType = response.headers["content-type"] || "application/octet-stream";
    const contentLength = response.headers["content-length"];
    const disposition = response.headers["content-disposition"];

    res.setHeader("Content-Type", contentType);
    if (contentLength) res.setHeader("Content-Length", contentLength);
    if (disposition) res.setHeader("Content-Disposition", disposition);

    response.data.pipe(res);
  }
}

function isTeraboxUrl(url) {
  const regex = /^https?:\/\/(www\.)?(1024terabox|terabox)\.[a-z]+/i;
  return regex.test(url);
}

router.get("/download", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || url.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'url' is required",
        example: `${global.t || "http://localhost:3000"}/api/terabox/download?url=https://1024terabox.com/s/xxx`,
        usage: "Get Terabox file metadata and download links",
        supportedDomains: ["1024terabox.com", "terabox.com", "terabox.app"]
      });
    }

    const trimmedUrl = url.trim();

    if (!isTeraboxUrl(trimmedUrl)) {
      return res.status(400).json({
        status: false,
        error: "Invalid Terabox URL format",
        example: "https://1024terabox.com/s/1xxxxxxxxxxxx",
        supportedDomains: ["1024terabox.com", "terabox.com", "terabox.app"]
      });
    }

    const downloader = new TeraboxDownloader();
    const data = await downloader.fetchData(trimmedUrl);
    const files = downloader.formatFiles(data.files);

    return res.status(200).json({
      status: true,
      totalFiles: files.length,
      files: files
    });

  } catch (error) {
    console.error("Terabox API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error",
      message: "Failed to fetch Terabox data"
    });
  }
});

router.post("/download", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || url.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'url' is required in request body",
        example: {
          url: "https://1024terabox.com/s/1xxxxxxxxxxxx"
        }
      });
    }

    const trimmedUrl = url.trim();

    if (!isTeraboxUrl(trimmedUrl)) {
      return res.status(400).json({
        status: false,
        error: "Invalid Terabox URL format",
        example: "https://1024terabox.com/s/1xxxxxxxxxxxx"
      });
    }

    const downloader = new TeraboxDownloader();
    const data = await downloader.fetchData(trimmedUrl);
    const files = downloader.formatFiles(data.files);

    return res.status(200).json({
      status: true,
      totalFiles: files.length,
      files: files
    });

  } catch (error) {
    console.error("Terabox API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error"
    });
  }
});

router.get("/file", async (req, res) => {
  try {
    const { url, index = 0 } = req.query;

    if (!url || url.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'url' is required",
        example: `${global.t || "http://localhost:3000"}/api/terabox/file?url=https://1024terabox.com/s/xxx&index=0`,
        usage: "Proxy download a specific file from Terabox"
      });
    }

    const trimmedUrl = url.trim();
    const fileIndex = parseInt(index);

    if (!isTeraboxUrl(trimmedUrl)) {
      return res.status(400).json({
        status: false,
        error: "Invalid Terabox URL format"
      });
    }

    if (isNaN(fileIndex) || fileIndex < 0) {
      return res.status(400).json({
        status: false,
        error: "Invalid index parameter (must be a positive number)"
      });
    }

    const downloader = new TeraboxDownloader();
    const data = await downloader.fetchData(trimmedUrl);
    const files = downloader.formatFiles(data.files);

    if (fileIndex >= files.length) {
      return res.status(400).json({
        status: false,
        error: `File index out of range. Available: 0 to ${files.length - 1}`
      });
    }

    const targetFile = files[fileIndex];

    if (!targetFile.downloadUrl) {
      return res.status(404).json({
        status: false,
        error: "Download URL not available for this file"
      });
    }

    await downloader.proxyFile(targetFile.downloadUrl, res);

  } catch (error) {
    console.error("Terabox File Proxy Error:", error.message);
    if (!res.headersSent) {
      return res.status(500).json({
        status: false,
        error: error.message || "Internal Server Error",
        message: "Failed to proxy file download"
      });
    }
  }
});

router.get("/info", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || url.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'url' is required",
        example: `${global.t || "http://localhost:3000"}/api/terabox/info?url=https://1024terabox.com/s/xxx`
      });
    }

    const trimmedUrl = url.trim();

    if (!isTeraboxUrl(trimmedUrl)) {
      return res.status(400).json({
        status: false,
        error: "Invalid Terabox URL format"
      });
    }

    const downloader = new TeraboxDownloader();
    const data = await downloader.fetchData(trimmedUrl);
    const files = downloader.formatFiles(data.files);

    return res.status(200).json({
      status: true,
      totalFiles: files.length,
      files: files.map(f => ({
        index: f.index,
        name: f.name,
        sizeFormatted: f.sizeFormatted,
        type: f.type,
        extension: f.extension,
        mimeType: f.mimeType,
        downloadUrl: f.downloadUrl
      }))
    });

  } catch (error) {
    console.error("Terabox Info API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error"
    });
  }
});

module.exports = {
  path: "/api/terabox",
  name: "Terabox Downloader",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/terabox/download?url=https://teraboxshare.com/s/1LNr3tyl5pI5KUM8BecGtyQ`,
  logo: "https://cdn-icons-png.flaticon.com/512/2926/2926319.png",
  category: "download",
  info: "Fetch metadata and download links from Terabox URLs with file type detection and proxy streaming support",
  router
};

