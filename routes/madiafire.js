const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

async function getFileInfo(url) {
  const client = axios.create({
    timeout: 30000,
    maxRedirects: 5,
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      "accept-encoding": "gzip, deflate, br",
      "referer": "https://www.google.com/"
    }
  });

  const res = await client.get(url);
  const $ = cheerio.load(res.data);

  const link = $("#downloadButton").attr("href") || null;
  const name =
    $(".dl-btn-label").attr("title") ||
    $(".promoDownloadName .dl-btn-label").text().trim() ||
    "file";
  const size =
    $(".download_link .input").text().match(/\(([^)]+)\)/)?.[1] ||
    $(".details .size").text().trim() ||
    "-";

  return { link, name, size };
}

router.get("/download", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== "string" || url.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Missing or invalid parameter: 'url' is required",
        example: "/api/mediafire/download?url=https://www.mediafire.com/file/xxxxx"
      });
    }

    if (!url.includes("mediafire.com")) {
      return res.status(400).json({
        status: false,
        error: "Invalid MediaFire URL"
      });
    }

    const result = await getFileInfo(url.trim());

    if (!result.link) {
      return res.status(404).json({
        status: false,
        error: "Failed to get download link"
      });
    }

    return res.status(200).json({
      status: true,
      platform: "mediafire",
      name: result.name,
      size: result.size,
      downloadUrl: result.link
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message || "Failed to download from MediaFire"
    });
  }
});

module.exports = {
  path: "/api/mediafire",
  name: "MediaFire Downloader",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/mediafire/download?url=https://www.mediafire.com/file/nbzh4zoc8ohfrwz/sample.zip/file`,
  logo: "https://cdn-icons-png.flaticon.com/512/8243/8243060.png",
  category: "download",
  info: "Download files from MediaFire",
  router
};
