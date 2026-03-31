const express = require("express");
const axios = require("axios");

const router = express.Router();

const headers = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive"
};

router.get("/download", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || url.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "🔗 يرجى تقديم رابط Google Drive"
      });
    }

    if (!url.includes("drive.google.com")) {
      return res.status(400).json({
        status: false,
        error: "❌ يرجى تقديم رابط Google Drive صحيح"
      });
    }

    const apiUrl = `https://takamura.site/api/dl/gdrive?url=${encodeURIComponent(url.trim())}`;
    const response = await axios.get(apiUrl, { headers, timeout: 30000 });
    const json = response.data;

    if (!json.success || !json.downloadUrl) {
      return res.status(404).json({
        status: false,
        error: "📭 لم يتم العثور على الملف أو فشل التحميل"
      });
    }

    return res.json({
      status: true,
      fileName: json.fileName || "غير معروف",
      fileSize: json.fileSize || "غير معروف",
      mimetype: json.mimetype || "غير معروف",
      downloadUrl: json.downloadUrl
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: "⚡ حدث خطأ أثناء تحميل الملف"
    });
  }
});

module.exports = {
  path: "/api/gdrive",
  name: "Téléchargeur Google Drive 📥",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/gdrive/download?url=https://drive.google.com/file/d/xxx`,
  logo: "https://files.catbox.moe/xyz123.jpg",
  category: "download",
  info: "📂 تحميل الملفات من Google Drive مباشرة",
  router
};

