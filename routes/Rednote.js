const express = require("express");
const axios = require("axios");

const router = express.Router();

class RedNote {
  constructor() {
    this.api = "https://anyfetcher.com/";
  }

  async download({ url }) {
    try {
      const res = await axios.post(`${this.api}api/video/parse`, {
        url: url
      }, {
        headers: {
          accept: "*/*",
          "accept-language": "id-ID",
          "accept-encoding": "gzip, deflate, br",
          "content-type": "application/json",
          origin: "https://anyfetcher.com",
          referer: "https://anyfetcher.com/en/tools/xiaohongshu",
          "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
          "sec-ch-ua-platform": '"Android"',
          connection: "keep-alive"
        }
      });

      return {
        status: true,
        result: res.data
      };
    } catch (err) {
      return {
        status: false,
        error: err.response?.data?.message || err.message
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

    const api = new RedNote();
    const data = await api.download({ url });

    if (!data.status) {
      return res.status(400).json({
        status: false,
        error: data.error || "Download failed"
      });
    }

    return res.status(200).json({
      status: true,
      result: data.result
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message || "Internal server error"
    });
  }
});

module.exports = {
  path: "/api/rednote",
  name: "RedNote (Xiaohongshu) Downloader",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/rednote/download?url=https://xiaohongshu.com/...`,
  logo: "https://www.xiaohongshu.com/favicon.ico",
  category: "download",
  info: "Download videos from RedNote (Xiaohongshu) via AnyFetcher API",
  router
};

