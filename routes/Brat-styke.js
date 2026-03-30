const express = require("express");
const axios = require("axios");

const router = express.Router();

class BratProHelper {
  static async generateImage(text) {
    const url = `https://api.nexray.web.id/sticker/brat?text=${encodeURIComponent(text)}`;
    
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
      },
      timeout: 30000
    });

    return Buffer.from(response.data);
  }

  static async generateVideo(text) {
    const url = `https://api.nexray.web.id/sticker/bratvideo?text=${encodeURIComponent(text)}`;
    
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "video/mp4,video/*;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
      },
      timeout: 60000
    });

    return Buffer.from(response.data);
  }
}

router.get("/generate", async (req, res) => {
  try {
    const { text, type } = req.query;

    if (!text) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: text",
        example: "/api/bratpro/generate?text=silana+ai&type=image"
      });
    }

    const format = type || "image";

    if (format !== "image" && format !== "video") {
      return res.status(400).json({
        status: false,
        error: "Invalid type. Use 'image' or 'video'",
        example: "/api/bratpro/generate?text=silana+ai&type=image"
      });
    }

    let buffer;
    let contentType;
    let filename;

    if (format === "image") {
      buffer = await BratProHelper.generateImage(text);
      contentType = "image/webp";
      filename = "brat.webp";
    } else {
      buffer = await BratProHelper.generateVideo(text);
      contentType = "video/mp4";
      filename = "brat.mp4";
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    return res.send(buffer);

  } catch (error) {
    console.error("BratPro Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal server error"
    });
  }
});

router.get("/options", async (req, res) => {
  try {
    const { text } = req.query;

    if (!text) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: text",
        example: "/api/bratpro/options?text=silana+ai"
      });
    }

    return res.status(200).json({
      status: true,
      text: text,
      options: [
        {
          type: "image",
          label: "Image 🖼️",
          url: `/api/bratpro/generate?text=${encodeURIComponent(text)}&type=image`
        },
        {
          type: "video",
          label: "Video 🎥",
          url: `/api/bratpro/generate?text=${encodeURIComponent(text)}&type=video`
        }
      ]
    });

  } catch (error) {
    console.error("BratPro Options Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal server error"
    });
  }
});

module.exports = {
  path: "/api/bratpro",
  name: "Brat Sticker Generator",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/bratpro/generate?text=silana+ai&type=image`,
  logo: "https://bratgenerator.com/favicon.ico",
  category: "tools",
  info: "Generate brat-style stickers as image or video",
  router
};

