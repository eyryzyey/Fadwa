const express = require("express");
const axios = require("axios");

const router = express.Router();

class YouTubeMP4Helper {
  static CONFIG = {
    video: { 
      ext: ["mp4"], 
      q: ["144p", "240p", "360p", "480p", "720p", "1080p"] 
    }
  };

  static getHeaders() {
    return {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
      referer: "https://ytmp3.gg/",
      "accept-language": "en-US,en;q=0.9",
      "accept-encoding": "gzip, deflate, br",
      origin: "https://ytmp3.gg"
    };
  }

  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async poll(statusUrl) {
    const headers = this.getHeaders();
    const { data } = await axios.get(statusUrl, { headers, timeout: 30000 });

    if (data.status === "completed") return data;
    if (data.status === "failed") throw new Error(data.message || "Conversion failed");

    await this.sleep(2000);
    return this.poll(statusUrl);
  }

  static async getVideoInfo(url) {
    try {
      const { data } = await axios.get("https://www.youtube.com/oembed", {
        params: { url, format: "json" },
        timeout: 10000
      });
      return {
        title: data.title || "Unknown",
        author: data.author_name || "Unknown",
        thumbnail: data.thumbnail_url || null
      };
    } catch (error) {
      return {
        title: "Unknown",
        author: "Unknown",
        thumbnail: null
      };
    }
  }

  static async convertVideo(url, quality = "720p") {
    if (!this.CONFIG.video.q.includes(quality)) {
      throw new Error(`Invalid quality. Choose: ${this.CONFIG.video.q.join(", ")}`);
    }

    const meta = await this.getVideoInfo(url);

    const payload = {
      url,
      os: "android",
      output: {
        type: "video",
        format: "mp4",
        quality
      }
    };

    const headers = this.getHeaders();

    let downloadInit;
    try {
      downloadInit = await axios.post("https://hub.ytconvert.org/api/download", payload, { 
        headers, 
        timeout: 30000 
      });
    } catch {
      downloadInit = await axios.post("https://api.ytconvert.org/api/download", payload, { 
        headers, 
        timeout: 30000 
      });
    }

    if (!downloadInit?.data?.statusUrl) {
      throw new Error("Converter failed to respond");
    }

    const result = await this.poll(downloadInit.data.statusUrl);

    return {
      title: meta.title,
      author: meta.author,
      thumbnail: meta.thumbnail,
      quality: quality,
      format: "mp4",
      downloadUrl: result.downloadUrl,
      filename: `${meta.title.replace(/[^\w\s-]/gi, "").trim()}.mp4`
    };
  }
}

router.get("/download", async (req, res) => {
  try {
    const { url, quality } = req.query;

    if (!url) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: url",
        example: "/api/ytmp4/download?url=https://youtu.be/xxxxx&quality=720p",
        available_qualities: YouTubeMP4Helper.CONFIG.video.q
      });
    }

    const videoQuality = quality || "720p";

    if (!YouTubeMP4Helper.CONFIG.video.q.includes(videoQuality)) {
      return res.status(400).json({
        status: false,
        error: `Invalid quality: ${videoQuality}`,
        available_qualities: YouTubeMP4Helper.CONFIG.video.q
      });
    }

    if (!url.includes("youtube.com") && !url.includes("youtu.be")) {
      return res.status(400).json({
        status: false,
        error: "Invalid YouTube URL"
      });
    }

    const result = await YouTubeMP4Helper.convertVideo(url, videoQuality);

    return res.status(200).json({
      status: true,
      title: result.title,
      author: result.author,
      thumbnail: result.thumbnail,
      quality: result.quality,
      format: result.format,
      filename: result.filename,
      download_url: result.downloadUrl
    });

  } catch (error) {
    console.error("YouTube MP4 Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal server error"
    });
  }
});

module.exports = {
  path: "/api/ytmp4",
  name: "YouTube MP4 Downloader",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/ytmp4/download?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ&quality=720p`,
  logo: "https://www.youtube.com/favicon.ico",
  category: "download",
  info: "Download YouTube videos in MP4 format with quality selection",
  router
};

