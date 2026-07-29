const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const multer = require("multer");
const FormData = require("form-data");
const { fileTypeFromBuffer } = require("file-type");

const router = express.Router();

const API_BASE = "https://engez.a7a.online/api/v1";
const UGUU_URL = "https://uguu.se/upload.php";

const SOURCES = {
  "1": "uguu",
  "2": "quax",
  "3": "ezgif",
  "4": "top4top",
  "5": "postimages",
  "6": "videy",
  "7": "8upload",
  "8": "litterbox",
  "9": "tmpfiles"
};

const SOURCE_NAMES = {
  uguu: "Uguu",
  quax: "Quax",
  ezgif: "Ezgif",
  top4top: "Top4Top",
  postimages: "PostImages",
  videy: "Videy",
  "8upload": "8Upload",
  litterbox: "Litterbox",
  tmpfiles: "TmpFiles"
};

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache"
};

const upload = multer({ storage: multer.memoryStorage() });

class FileUploader {
  constructor() {
    this.client = axios.create({
      timeout: 60000,
      headers: HEADERS
    });
  }

  formatSize(bytes) {
    if (!bytes || bytes === 0) return "0 B";
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }

  async uploadToUguu(buffer, filename) {
    const form = new FormData();
    form.append("files[]", buffer, filename);

    const { data } = await this.client.post(UGUU_URL, form, {
      headers: {
        ...form.getHeaders()
      }
    });

    if (!data?.files?.[0]?.url) {
      throw new Error("Failed to upload file to Uguu");
    }

    return data.files[0].url;
  }

  async mirrorToSource(fileUrl, source) {
    const params = new URLSearchParams();
    params.append("fileUrl", fileUrl);
    params.append("source", source);

    const { data } = await this.client.get(`${API_BASE}/tools/upload?${params.toString()}`, {
      timeout: 30000
    });

    if (!data?.success) {
      throw new Error(data?.error || data?.message || "Failed to mirror file");
    }

    return data.response;
  }

  detectSource(mimeType, userChoice) {
    if (userChoice && SOURCES[userChoice]) {
      return SOURCES[userChoice];
    }

    if (mimeType.startsWith("image/")) return "postimages";
    if (mimeType.startsWith("video/")) return "videy";
    return "uguu";
  }
}

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({
        status: false,
        error: "No file uploaded",
        usage: "Send a multipart/form-data request with field name 'file'",
        example: "curl -X POST -F 'file=@image.jpg' -F 'source=5' http://localhost:3000/api/upload/upload",
        supportedSources: Object.keys(SOURCES).map(k => ({ id: k, key: SOURCES[k], name: SOURCE_NAMES[SOURCES[k]] })),
        autoDetect: {
          images: "postimages",
          videos: "videy",
          others: "uguu"
        }
      });
    }

    const fileBuffer = req.file.buffer;
    const originalName = req.file.originalname || "file";
    const userSource = req.body?.source || req.body?.src || null;

    const fileInfo = await fileTypeFromBuffer(fileBuffer);
    const mimeType = fileInfo?.mime || req.file.mimetype || "application/octet-stream";
    const ext = fileInfo?.ext || req.file.originalname?.split(".").pop() || "bin";
    const filename = `file.${ext}`;

    const uploader = new FileUploader();
    const source = uploader.detectSource(mimeType, userSource);

    const uguuUrl = await uploader.uploadToUguu(fileBuffer, filename);
    const result = await uploader.mirrorToSource(uguuUrl, source);

    return res.status(200).json({
      status: true,
      originalName: originalName,
      mimeType: mimeType,
      sizeBytes: fileBuffer.length,
      sizeFormatted: uploader.formatSize(fileBuffer.length),
      source: {
        id: Object.keys(SOURCES).find(k => SOURCES[k] === source),
        key: source,
        name: SOURCE_NAMES[source] || source
      },
      url: result?.url || null,
      fileName: result?.fileName || null,
      mirroredUrl: result?.url || null,
      uguuUrl: uguuUrl,
      metadata: {
        ext: ext,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("Upload API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error",
      message: "Failed to upload and mirror file"
    });
  }
});

router.get("/sources", async (req, res) => {
  return res.status(200).json({
    status: true,
    totalSources: Object.keys(SOURCES).length,
    sources: Object.keys(SOURCES).map(k => ({
      id: k,
      key: SOURCES[k],
      name: SOURCE_NAMES[SOURCES[k]]
    })),
    autoDetect: {
      images: "postimages",
      videos: "videy",
      others: "uguu"
    }
  });
});

module.exports = {
  path: "/api/upload",
  name: "File Uploader & Mirror",
  type: "post",
  url: `${global.t || "http://localhost:3000"}/api/upload/upload`,
  logo: "https://cdn-icons-png.flaticon.com/512/2926/2926319.png",
  category: "tools",
  info: "Upload files and mirror them to multiple hosting services (Uguu, PostImages, Videy, etc.) with automatic MIME type detection",
  router
};
