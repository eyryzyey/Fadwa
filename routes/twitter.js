const express = require("express");
const axios = require("axios");
const FormData = require("form-data");
const cheerio = require("cheerio");

const router = express.Router();

class TwitterDownloaderHelper {
  static getHeaders() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Origin": "https://savetwitter.net",
      "Referer": "https://savetwitter.net/"
    };
  }

  static async getVideoInfo(url) {
    const form = new FormData();
    form.append("q", url);
    form.append("lang", "en");
    form.append("cftoken", "");

    const headers = {
      ...this.getHeaders(),
      ...form.getHeaders()
    };

    const { data } = await axios.post("https://savetwitter.net/api/ajaxSearch", form, {
      headers,
      timeout: 30000
    });

    if (!data.data) {
      throw new Error("Video not found or invalid URL");
    }

    const $ = cheerio.load(data.data);
    
    const thumbnailSelectors = [
      ".image-tw img",
      ".thumbnail img",
      ".video-thumb img",
      "img[src*='twimg']"
    ];

    let thumbnail = null;
    for (const selector of thumbnailSelectors) {
      thumbnail = $(selector).attr("src");
      if (thumbnail) break;
    }

    const results = [];

    $(".dl-action a").each((_, el) => {
      const link = $(el).attr("href");
      const label = $(el).text().trim();
      
      if (link && (label.includes("Download MP4") || label.includes("MP4"))) {
        const qualityMatch = label.match(/\(([^)]+)\)/) || label.match(/(\d+p)/);
        const quality = qualityMatch ? qualityMatch[1] : "Unknown";
        
        results.push({
          quality: quality,
          url: link,
          thumbnail: thumbnail
        });
      }
    });

    if (results.length === 0) {
      throw new Error("No download links found");
    }

    return {
      thumbnail: thumbnail,
      videos: results,
      best_quality: results[0]
    };
  }

  static async downloadVideo(downloadUrl) {
    const { data } = await axios.get(downloadUrl, {
      responseType: "arraybuffer",
      headers: this.getHeaders(),
      timeout: 60000,
      maxRedirects: 5
    });

    return Buffer.from(data);
  }
}

router.get("/download", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: url",
        example: "/api/twitter/download?url=https://twitter.com/user/status/123456789"
      });
    }

    if (!url.includes("twitter.com") && !url.includes("x.com")) {
      return res.status(400).json({
        status: false,
        error: "Invalid Twitter/X URL"
      });
    }

    const result = await TwitterDownloaderHelper.getVideoInfo(url);

    return res.status(200).json({
      status: true,
      thumbnail: result.thumbnail,
      videos: result.videos,
      best_quality: result.best_quality
    });

  } catch (error) {
    console.error("Twitter Download Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal server error"
    });
  }
});

router.get("/file", async (req, res) => {
  try {
    const { download_url } = req.query;

    if (!download_url) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: download_url"
      });
    }

    const buffer = await TwitterDownloaderHelper.downloadVideo(download_url);

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", "attachment; filename=twitter_video.mp4");
    return res.send(buffer);

  } catch (error) {
    console.error("Twitter File Download Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal server error"
    });
  }
});

module.exports = {
  path: "/api/twitter",
  name: "Twitter Video Downloader",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/twitter/download?url=https://twitter.com/user/status/123456789`,
  logo: "https://twitter.com/favicon.ico",
  category: "download",
  info: "Download Twitter/X videos via savetwitter.net",
  router
};

