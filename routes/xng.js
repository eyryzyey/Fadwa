const express = require("express");
const axios = require("axios");

const router = express.Router();

class MusicFinder {
  async search(params) {
    const {
      service,
      query,
      url,
      quality,
      extension,
      title,
      pageToken,
      folder
    } = params;

    const endpoints = {
      1: "https://backendace.1010diy.com/web/free-mp3-finder/query",
      2: "https://backendace.1010diy.com/web/free-mp3-finder/detail",
      3: "https://stream_ace1.1010diy.com/download",
      4: "https://line.1010diy.com/web/free-mp3-finder/query",
      5: "https://your-query.myfreemp3.icu/",
      6: "https://songslover.vip/",
      7: "https://justnaija.com/search",
      8: "https://myfreemp3juices.cc/api/search.php",
      9: "https://idmp3s.com/api/vip/get_song.php",
      10: "https://www.mp3-juices.plus/mp3",
      11: "https://www.mp3juices3.cc/",
      12: "https://mp3-juice.com/api.php",
      13: "https://mp3quack.app/mp3",
      14: "https://tubidy.dj/"
    };

    if (!endpoints[service]) throw new Error("Invalid service specified");

    const paramsObj = {
      1: {
        q: query,
        type: "youtube",
        pageToken: pageToken
      },
      2: {
        url: url,
        phonydata: false
      },
      3: {
        url: url,
        quality: quality,
        ext: extension,
        title: title
      },
      4: {
        q: query,
        type: "youtube",
        pageToken: pageToken
      },
      6: {
        s: query
      },
      7: {
        q: query,
        folder: folder
      },
      8: {
        q: query,
        page: 0
      },
      9: {
        id: query
      },
      10: {
        q: query
      },
      11: {
        query: query
      },
      12: {
        q: query
      },
      13: {
        q: query
      },
      14: {
        q: query
      }
    };

    const response = await axios({
      method: service === "8" || service === "11" || service === "14" ? "post" : "get",
      url: endpoints[service],
      params: service !== "8" && service !== "11" && service !== "14" ? paramsObj[service] : undefined,
      data: service === "8" || service === "11" || service === "14" ? paramsObj[service] : undefined,
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive"
      }
    });

    return response.data;
  }
}

router.get("/search", async (req, res) => {
  try {
    const { service, query, url, quality, extension, title, pageToken, folder } = req.query;

    if (!service) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: service"
      });
    }

    if (["1", "4", "6", "7", "8", "10", "12", "13"].includes(service) && !query) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: query for this service"
      });
    }

    if (["2", "3", "9"].includes(service) && !url) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: url for this service"
      });
    }

    if (service === "3" && (!quality || !extension || !title)) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameters: quality, extension, and title for service 3"
      });
    }

    const musicAPI = new MusicFinder();
    const result = await musicAPI.search({
      service,
      query,
      url,
      quality,
      extension,
      title,
      pageToken,
      folder
    });

    return res.status(200).json({
      status: true,
      service: service,
      result: result
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message || "Internal server error"
    });
  }
});

module.exports = {
  path: "/api/musicfinder",
  name: "Music Finder Aggregator",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/musicfinder/search?service=1&query=hello`,
  logo: "https://www.mp3juices.cc/favicon.ico",
  category: "download",
  info: "Search and download music from various MP3 sources (14 different services)",
  router
};

