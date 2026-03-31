const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

async function pixiv(word) {
  const url = "https://www.pixiv.net/touch/ajax/tag_portal";
  const params = {
    word: word,
    lang: "en",
    version: "b355e2bcced14892fe49d790ebb9ec73d2287393"
  };
  const headers = {
    "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
    "referer": "https://www.pixiv.net/",
    "accept": "application/json, text/plain, */*",
    "accept-encoding": "gzip, deflate, br",
    "accept-language": "en-US,en;q=0.9",
    "origin": "https://www.pixiv.net"
  };

  const { data } = await axios.get(url, { params, headers });
  const illusts = data.body?.illusts;

  if (!illusts || illusts.length === 0) {
    throw new Error("No images found for this search");
  }

  const randomIllust = illusts[Math.floor(Math.random() * illusts.length)];
  const imageUrl = randomIllust.url;
  const imageResponse = await axios.get(imageUrl, {
    responseType: "arraybuffer",
    headers: {
      "user-agent": headers["user-agent"],
      "referer": "https://www.pixiv.net/"
    }
  });

  return {
    imageBuffer: imageResponse.data,
    imageUrl: imageUrl,
    illustId: randomIllust.id,
    illustTitle: randomIllust.title,
    userName: randomIllust.userName,
    userId: randomIllust.userId
  };
}

router.get("/search", async (req, res) => {
  try {
    const { q, query } = req.query;

    const searchQuery = q || query;

    if (!searchQuery || typeof searchQuery !== "string" || searchQuery.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Missing or invalid parameter: 'q' or 'query' is required",
        example: "/api/pixiv/search?q=naruto"
      });
    }

    const result = await pixiv(searchQuery.trim());

    const base64Image = Buffer.from(result.imageBuffer).toString("base64");

    return res.status(200).json({
      status: true,
      platform: "pixiv",
      query: searchQuery.trim(),
      illustId: result.illustId,
      illustTitle: result.illustTitle,
      userName: result.userName,
      userId: result.userId,
      imageUrl: result.imageUrl,
      imageBase64: `data:image/jpeg;base64,${base64Image}`
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message || "Failed to fetch from Pixiv"
    });
  }
});

module.exports = {
  path: "/api/pixiv",
  name: "Pixiv Image Search",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/pixiv/search?q=naruto`,
  logo: "https://cdn-icons-png.flaticon.com/512/512/512787.png",
  category: "search",
  info: "Search and get random images from Pixiv",
  router
};

