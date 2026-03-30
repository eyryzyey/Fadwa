const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

class Downloader {
  async download({ url, ...rest }) {
    try {
      const response = await axios.post("https://dvsnackvideo.com/abc_download", {
        url: url || "https://www.snackvideo.com/@kwai/video/5199274407939319471?pwa_source=web_share",
        locale: rest.locale || "en",
        type: rest.type || "video"
      }, {
        headers: {
          accept: "*/*",
          "accept-language": "id-ID",
          "accept-encoding": "gzip, deflate, br",
          "content-type": "text/plain;charset=UTF-8",
          origin: "https://dvsnackvideo.com",
          priority: "u=1, i",
          referer: "https://dvsnackvideo.com/",
          "sec-ch-ua": '"Chromium";v="127", "Not)A;Brand";v="99", "Microsoft Edge Simulate";v="127", "Lemur";v="127"',
          "sec-ch-ua-mobile": "?1",
          "sec-ch-ua-platform": '"Android"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
          connection: "keep-alive"
        }
      });

      const $ = cheerio.load(response.data);
      const resultContainer = $("#results .result");

      if (resultContainer.length === 0) {
        throw new Error("Result container not found");
      }

      const result = {
        video: null,
        video_wm: null,
        mp3: null,
        thumbnail: null
      };

      resultContainer.find(".download-container a").each((i, elem) => {
        const buttonText = $(elem).text().trim().toLowerCase();
        let downloadUrl = $(elem).attr("href");
        
        if (!downloadUrl) return;

        if (downloadUrl.startsWith("//")) {
          downloadUrl = "https:" + downloadUrl;
        } else if (downloadUrl.startsWith("/")) {
          downloadUrl = "https://dvsnackvideo.com" + downloadUrl;
        } else if (!downloadUrl.startsWith("https://")) {
          downloadUrl = "https://dvsnackvideo.com/" + downloadUrl;
        }

        const mapping = {
          "without watermark": "video_wm",
          "no watermark": "video_wm",
          "with watermark": "video",
          original: "video",
          mp3: "mp3",
          music: "mp3",
          thumbnail: "thumbnail",
          cover: "thumbnail"
        };

        for (const [keyword, key] of Object.entries(mapping)) {
          if (buttonText.includes(keyword)) {
            result[key] = downloadUrl;
            break;
          }
        }
      });

      if (!result.video && result.video_wm) {
        result.video = result.video_wm;
      }

      return {
        status: true,
        title: resultContainer.find(".video-title").text()?.trim() || "Title not available",
        thumbnail: resultContainer.find("img.thumbnail").attr("src") || result.thumbnail || "Thumbnail not available",
        likes: resultContainer.find(".likes span").text()?.trim() || "0",
        views: resultContainer.find(".views span").text()?.trim() || "0",
        comments: resultContainer.find(".comments span").text()?.trim() || "0",
        duration: resultContainer.find(".duration span").text()?.trim() || "00:00",
        result: result
      };
    } catch (error) {
      throw new Error(error.message || "Download failed");
    }
  }
}

router.get("/download", async (req, res) => {
  try {
    const { url, locale, type } = req.query;

    if (!url) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: url"
      });
    }

    const client = new Downloader();
    const response = await client.download({ url, locale, type });

    return res.status(200).json({
      status: true,
      title: response.title,
      thumbnail: response.thumbnail,
      stats: {
        likes: response.likes,
        views: response.views,
        comments: response.comments,
        duration: response.duration
      },
      downloads: response.result
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error"
    });
  }
});

module.exports = {
  path: "/api/snackvideo",
  name: "SnackVideo Downloader",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/snackvideo/download?url=https://www.snackvideo.com/@kwai/video/...`,
  logo: "https://www.snackvideo.com/favicon.ico",
  category: "download",
  info: "Download videos from SnackVideo/Kwai with watermark and without watermark options",
  router
};

