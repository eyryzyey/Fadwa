const express = require("express");
const axios = require("axios");
const FormData = require("form-data");
const { Readable } = require("stream");
const sharp = require("sharp");

const router = express.Router();

class Photo2AnimeHelper {
  static randomIP() {
    return Array(4).fill(0).map(() => Math.floor(Math.random() * 256)).join(".");
  }

  static randomUserAgent() {
    const userAgents = [
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Android 12; Mobile; rv:102.0) Gecko/102.0 Firefox/102.0",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15"
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  constructor() {
    this.sessionIP = Photo2AnimeHelper.randomIP();
    this.sessionUA = Photo2AnimeHelper.randomUserAgent();
  }

  getBaseHeaders() {
    return {
      "fp": "c74f54010942b009eaa50cd58a1f4419",
      "fp1": "3LXezMA2LSO2kESzl2EYNEQBUWOCDQ/oQMQaeP5kWWHbtCWoiTptGi2EUCOLjkdD",
      "origin": "https://pixnova.ai",
      "referer": "https://pixnova.ai/",
      "theme-version": "83EmcUoQTUv50LhNx0VrdcK8rcGexcP35FcZDcpgWsAXEyO4xqL5shCY6sFIWB2Q",
      "x-code": Date.now().toString(),
      "x-guide": "SjwMWX+LcTqkoPt48PIOgZzt3eQ93zxCGvzs1VpdikRR9b9+HvKM0Qiceq6Zusjrv8bUEtDGZdVqjQf/bdOXBb0vEaUUDRZ29EXYW0kt047grMMceXzd3zppZoHZj9DeXZOTGaG50PpTHxTjX3gb0D1wmfjol2oh7d5jJFSIsY0=",
      "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      "accept": "application/json, text/plain, */*",
      "user-agent": this.sessionUA,
      "X-Forwarded-For": this.sessionIP,
      "Client-IP": this.sessionIP
    };
  }

  async uploadImageFromBuffer(buffer) {
    const stream = Readable.from(buffer);
    const form = new FormData();
    form.append("file", stream, { filename: "image.jpg" });
    form.append("fn_name", "demo-photo2anime");
    form.append("request_from", "2");
    form.append("origin_from", "111977c0d5def647");

    const upload = await axios.post("https://api.pixnova.ai/aitools/upload-img", form, {
      headers: {
        ...this.getBaseHeaders(),
        ...form.getHeaders()
      },
      timeout: 60000
    });

    return upload.data?.data?.path;
  }

  async createTask(sourceImage) {
    const payload = {
      fn_name: "demo-photo2anime",
      call_type: 3,
      input: {
        source_image: sourceImage,
        strength: 0.6,
        prompt: "use anime style, hd, 8k, smooth, aesthetic",
        negative_prompt: "(worst quality, low quality:1.4), (greyscale, monochrome:1.1), cropped, lowres , username, blurry, trademark, watermark, title, multiple view, Reference sheet, curvy, plump, fat, strabismus, clothing cutout, side slit,worst hand, (ugly face:1.2), extra leg, extra arm, bad foot, text, name",
        request_from: 2
      },
      request_from: 2,
      origin_from: "111977c0d5def647"
    };

    const headers = {
      ...this.getBaseHeaders(),
      "content-type": "application/json"
    };

    const res = await axios.post("https://api.pixnova.ai/aitools/of/create", payload, {
      headers,
      timeout: 30000
    });

    return res.data?.data?.task_id;
  }

  async waitForResult(taskId) {
    const payload = {
      task_id: taskId,
      fn_name: "demo-photo2anime",
      call_type: 3,
      request_from: 2,
      origin_from: "111977c0d5def647"
    };

    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 1; i <= 30; i++) {
      const headers = {
        ...this.getBaseHeaders(),
        "content-type": "application/json"
      };

      const check = await axios.post("https://api.pixnova.ai/aitools/of/check-status", payload, {
        headers,
        timeout: 30000
      });

      const data = check.data?.data;
      if (data?.status === 2 && data?.result_image) {
        const url = data.result_image.startsWith("http")
          ? data.result_image
          : `https://oss-global.pixnova.ai/${data.result_image}`;
        return url;
      }

      await delay(2000);
    }

    return null;
  }

  async convertToPNG(url) {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30000
    });

    const webpBuffer = Buffer.from(res.data);
    const pngBuffer = await sharp(webpBuffer).png().toBuffer();
    return pngBuffer;
  }

  async processImage(buffer) {
    const sourceImage = await this.uploadImageFromBuffer(buffer);
    const taskId = await this.createTask(sourceImage);
    const resultUrl = await this.waitForResult(taskId);

    if (!resultUrl) {
      throw new Error("Failed to generate anime image");
    }

    const pngBuffer = await this.convertToPNG(resultUrl);
    return {
      result_url: resultUrl,
      buffer: pngBuffer
    };
  }
}

router.post("/convert", async (req, res) => {
  try {
    if (!req.body || !req.body.image) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: image (base64)",
        example: "POST /api/photo2anime/convert with body: { \"image\": \"base64string\" }"
      });
    }

    const base64Data = req.body.image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({
        status: false,
        error: "Image too large. Max 10MB allowed"
      });
    }

    const helper = new Photo2AnimeHelper();
    const result = await helper.processImage(buffer);

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", "attachment; filename=anime.png");
    return res.send(result.buffer);

  } catch (error) {
    console.error("Photo2Anime Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal server error"
    });
  }
});

router.post("/convert-url", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: url",
        example: "POST /api/photo2anime/convert-url with body: { \"url\": \"https://example.com/image.jpg\" }"
      });
    }

    let imageBuffer;
    
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const imageResponse = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 30000
      });
      imageBuffer = Buffer.from(imageResponse.data);
    } else {
      return res.status(400).json({
        status: false,
        error: "Invalid URL format"
      });
    }

    if (imageBuffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({
        status: false,
        error: "Image too large. Max 10MB allowed"
      });
    }

    const helper = new Photo2AnimeHelper();
    const result = await helper.processImage(imageBuffer);

    return res.status(200).json({
      status: true,
      result_url: result.result_url,
      message: "Image converted successfully. Use the URL to download."
    });

  } catch (error) {
    console.error("Photo2Anime URL Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal server error"
    });
  }
});

module.exports = {
  path: "/api/photo2anime",
  name: "Photo to Anime Converter",
  type: "post",
  url: `${global.t || "http://localhost:3000"}/api/photo2anime/convert`,
  logo: "https://pixnova.ai/favicon.ico",
  category: "tools",
  info: "Convert photos to anime style using PixNova AI",
  router
};

