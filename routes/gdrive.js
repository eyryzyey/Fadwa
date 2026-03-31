const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

class MediaFireHelper {
  static getHeaders() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1"
    };
  }

  static async getFileInfo(url) {
    const client = axios.create({
      timeout: 30000,
      maxRedirects: 5,
      headers: this.getHeaders()
    });

    const { data } = await client.get(url);
    const $ = cheerio.load(data);

    const linkSelectors = [
      "#downloadButton",
      "a#downloadButton",
      ".download_link a",
      ".dl-btn-cont a",
      "a[href*='download']"
    ];

    let link = null;
    for (const selector of linkSelectors) {
      link = $(selector).attr("href");
      if (link) break;
    }

    const nameSelectors = [
      ".dl-btn-label",
      ".promoDownloadName .dl-btn-label",
      ".dl-filename",
      ".filename",
      "h1",
      "title"
    ];

    let name = "file";
    for (const selector of nameSelectors) {
      const text = $(selector).attr("title") || $(selector).text().trim();
      if (text) {
        name = text;
        break;
      }
    }

    const sizeSelectors = [
      ".download_link .input",
      ".details .size",
      ".dl-info .size",
      ".file-info .size",
      ".dl-size"
    ];

    let size = "-";
    for (const selector of sizeSelectors) {
      const text = $(selector).text().trim();
      const match = text.match(/\(([^)]+)\)/);
      if (match) {
        size = match[1];
        break;
      }
      if (text && /(MB|GB|KB|Bytes)/i.test(text)) {
        size = text;
        break;
      }
    }

    return { link, name, size };
  }
}

router.get("/download", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: url",
        example: "/api/mediafire-dl/download?url=https://www.mediafire.com/file/xxxxx"
      });
    }

    if (!url.includes("mediafire.com")) {
      return res.status(400).json({
        status: false,
        error: "Invalid MediaFire URL"
      });
    }

    const result = await MediaFireHelper.getFileInfo(url);

    if (!result.link) {
      return res.status(404).json({
        status: false,
        error: "Failed to get download link. File may be private or removed."
      });
    }

    return res.status(200).json({
      status: true,
      filename: result.name,
      filesize: result.size,
      download_url: result.link,
      source_url: url
    });

  } catch (error) {
    console.error("MediaFire DL Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal server error"
    });
  }
});

module.exports = {
  path: "/api/mediafire-dl",
  name: "MediaFire Downloader",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/mediafire-dl/download?url=https://www.mediafire.com/file/nbzh4zoc8ohfrwz/sample.zip/file`,
  logo: "https://www.mediafire.com/favicon.ico",
  category: "download",
  info: "Get direct download links from MediaFire URL",
  router
};

