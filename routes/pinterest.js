const express = require("express");
const axios = require("axios");

const router = express.Router();

class PinterestHelper {
  static getHeaders() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive"
    };
  }

  static async searchImages(query) {
    const url = `https://api.siputzx.my.id/api/s/pinterest?query=${encodeURIComponent(query)}`;
    
    const { data } = await axios.get(url, {
      headers: this.getHeaders(),
      timeout: 30000
    });

    if (!data.status || !data.data || !data.data.length) {
      throw new Error("No images found");
    }

    return data.data.map((item, index) => ({
      position: index + 1,
      title: item.grid_title || "No Title",
      description: item.description || "-",
      image_url: item.image_url || null,
      pin_url: item.pin || null,
      pinner: {
        full_name: item.pinner?.full_name || "Unknown",
        username: item.pinner?.username || "unknown"
      }
    }));
  }

  static getRandomImage(images) {
    return images[Math.floor(Math.random() * images.length)];
  }
}

const sessions = {};

router.get("/search", async (req, res) => {
  try {
    const { q, random } = req.query;

    if (!q) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: q",
        example: "/api/pinterest/search?q=nature&random=true"
      });
    }

    const images = await PinterestHelper.searchImages(q);

    if (random === "true") {
      const randomImage = PinterestHelper.getRandomImage(images);
      return res.status(200).json({
        status: true,
        query: q,
        total: images.length,
        random: true,
        image: randomImage
      });
    }

    return res.status(200).json({
      status: true,
      query: q,
      total: images.length,
      images: images
    });

  } catch (error) {
    console.error("Pinterest Search Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal server error"
    });
  }
});

router.get("/random", async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: q",
        example: "/api/pinterest/random?q=nature"
      });
    }

    const images = await PinterestHelper.searchImages(q);
    const randomImage = PinterestHelper.getRandomImage(images);

    const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    sessions[sessionId] = { query: q, lastIndex: images.indexOf(randomImage) };

    return res.status(200).json({
      status: true,
      query: q,
      session_id: sessionId,
      image: randomImage
    });

  } catch (error) {
    console.error("Pinterest Random Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal server error"
    });
  }
});

router.get("/again", async (req, res) => {
  try {
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: session_id",
        example: "/api/pinterest/again?session_id=abc123"
      });
    }

    const session = sessions[session_id];
    if (!session) {
      return res.status(404).json({
        status: false,
        error: "Session not found or expired"
      });
    }

    const images = await PinterestHelper.searchImages(session.query);
    let nextIndex = (session.lastIndex + 1) % images.length;
    
    const nextImage = images[nextIndex];
    sessions[session_id].lastIndex = nextIndex;

    return res.status(200).json({
      status: true,
      query: session.query,
      session_id: session_id,
      image: nextImage
    });

  } catch (error) {
    console.error("Pinterest Again Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal server error"
    });
  }
});

module.exports = {
  path: "/api/pinterest",
  name: "Pinterest Image Search",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/pinterest/search?q=nature&random=true`,
  logo: "https://www.pinterest.com/favicon.ico",
  category: "search",
  info: "Search Pinterest images via siputzx API with random selection",
  router
};
