const express = require("express");
const axios = require("axios");

const router = express.Router();

class LyricAPI {
  constructor() {
    this.cfg = {
      base: "https://lyric-jumper-en.petitlyrics.com",
      api: "https://lyric-jumper-api.appspot.com",
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Referer: "https://lyric-jumper-en.petitlyrics.com/",
        "X-Requested-With": "XMLHttpRequest",
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive"
      }
    };
  }

  async req({ url, params = {}, method = "GET", responseType = "json" }) {
    try {
      const res = await axios({
        method: method,
        url: url,
        params: params,
        timeout: this.cfg.timeout,
        headers: this.cfg.headers,
        responseType: responseType
      });
      return res.data;
    } catch (err) {
      return null;
    }
  }

  async find({ q, limit = 10 }) {
    if (!q) return [];
    const url = `${this.cfg.base}/api/artist/search`;
    const data = await this.req({
      url: url,
      params: {
        q: q,
        limit: limit
      }
    });
    return data || [];
  }

  async topics({ id, limit = 10 }) {
    if (!id) return [];
    const url = `${this.cfg.base}/api/artist/topics/${id}/${limit}`;
    const data = await this.req({
      url: url
    });
    return data || [];
  }

  async songs({ artistId, topicId }) {
    if (!artistId || !topicId) return [];
    const url = `${this.cfg.base}/api/song/topic_songs/${artistId}/${topicId}`;
    const data = await this.req({
      url: url
    });
    return data || [];
  }

  async song({ id }) {
    if (!id) return {};
    const url = `${this.cfg.base}/api/song/info/${id}`;
    return await this.req({
      url: url
    }) || {};
  }

  async lyrics({ id }) {
    if (!id) return {};
    const url = `${this.cfg.api}/lyrics/${id}`;
    const data = await this.req({
      url: url,
      responseType: "text"
    });
    if (typeof data === "string") {
      try {
        const decodedString = Buffer.from(data, "base64").toString("utf-8");
        const json = JSON.parse(decodedString);
        return this.parseLyrics(json);
      } catch (err) {
        return {};
      }
    }
    return {};
  }

  parseLyrics(data) {
    if (!data || !data.lines) return {
      lines: []
    };
    return {
      type: data.type || 1,
      lines: data.lines.map(line => {
        const text = line.words && line.words.length > 0 ? line.words.map(w => w.string).join("") : "";
        return {
          text: text,
          words: line.words
        };
      }).filter(line => line.text)
    };
  }

  async phrases({ artistId, topicId }) {
    if (!artistId || !topicId) return [];
    const url = `${this.cfg.base}/api/topic/phrase/${artistId}/${topicId}`;
    return await this.req({
      url: url
    }) || [];
  }

  async yt({ id }) {
    if (!id) return [];
    const url = `${this.cfg.base}/api/song/search_youtube/${id}`;
    return await this.req({
      url: url
    }) || [];
  }
}

router.get("/search", async (req, res) => {
  try {
    const { q, limit } = req.query;

    if (!q) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: q"
      });
    }

    const api = new LyricAPI();
    const response = await api.find({ q, limit: limit || 10 });

    return res.status(200).json({
      status: true,
      query: q,
      results: response
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message,
      results: []
    });
  }
});

router.get("/topics", async (req, res) => {
  try {
    const { id, limit } = req.query;

    if (!id) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: id"
      });
    }

    const api = new LyricAPI();
    const response = await api.topics({ id, limit: limit || 10 });

    return res.status(200).json({
      status: true,
      artistId: id,
      results: response
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message,
      results: []
    });
  }
});

router.get("/songs", async (req, res) => {
  try {
    const { artistId, topicId } = req.query;

    if (!artistId || !topicId) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameters: artistId and topicId"
      });
    }

    const api = new LyricAPI();
    const response = await api.songs({ artistId, topicId });

    return res.status(200).json({
      status: true,
      artistId: artistId,
      topicId: topicId,
      results: response
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message,
      results: []
    });
  }
});

router.get("/info", async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: id"
      });
    }

    const api = new LyricAPI();
    const response = await api.song({ id });

    return res.status(200).json({
      status: true,
      songId: id,
      data: response
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message,
      data: {}
    });
  }
});

router.get("/lyrics", async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: id"
      });
    }

    const api = new LyricAPI();
    const response = await api.lyrics({ id });

    return res.status(200).json({
      status: true,
      songId: id,
      data: response
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message,
      data: {}
    });
  }
});

router.get("/phrases", async (req, res) => {
  try {
    const { artistId, topicId } = req.query;

    if (!artistId || !topicId) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameters: artistId and topicId"
      });
    }

    const api = new LyricAPI();
    const response = await api.phrases({ artistId, topicId });

    return res.status(200).json({
      status: true,
      artistId: artistId,
      topicId: topicId,
      results: response
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message,
      results: []
    });
  }
});

router.get("/youtube", async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: id"
      });
    }

    const api = new LyricAPI();
    const response = await api.yt({ id });

    return res.status(200).json({
      status: true,
      songId: id,
      results: response
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message,
      results: []
    });
  }
});

module.exports = {
  path: "/api/lyrics",
  name: "Petit Lyrics API",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/lyrics/search?q=hello`,
  logo: "https://petitlyrics.com/favicon.ico",
  category: "search",
  info: "Search for song lyrics, artists, and topics from Petit Lyrics",
  router
};

