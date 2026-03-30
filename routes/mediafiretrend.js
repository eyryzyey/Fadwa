const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

class MediaFireScraper {
  constructor() {
    this.proxy = "https://api.allorigins.win/raw?url=";
    this.base = "https://mediafiretrend.com";
  }

  async get(url) {
    try {
      const { data } = await axios.get(`${this.proxy}${encodeURIComponent(url)}`, {
        validateStatus: status => status >= 200 && status < 500,
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "keep-alive"
        }
      });
      return cheerio.load(data);
    } catch (e) {
      throw new Error(`Fetch failed: ${e.message}`);
    }
  }

  async search({ query, limit = 5, detail = true, ...rest }) {
    try {
      const $ = await this.get(`${this.base}/?q=${encodeURIComponent(query)}&search=Search`);
      const results = [];

      for (const row of $("table tr").get()) {
        if (results.length >= limit) break;
        const $row = $(row);
        const $td = $row.find('td.item a[href*="/f/"]').eq(0);
        const href = $td.attr("href") || "";
        const id = href.match(/\/f\/(\d+)/)?.[1] || "";

        if (!id) continue;

        const title = $td.text().trim() || "Unknown";
        const size = $td.parent().text().match(/\((\d+(?:\.\d+)?\s*[KM]B?)\)/)?.[1] || "Unknown";
        const source = $row.find("span").eq(0).text().trim() || "";

        let result = {
          id: id,
          title: title,
          size: size,
          url: `${this.base}${href}`,
          source: source
        };

        if (detail) {
          const det = await this.detail({ url: result.url, ...rest });
          if (det?.error) continue;
          result = { ...result, ...det };
        }

        results.push(result);
      }

      return {
        status: true,
        query: query,
        total: results.length,
        results: results
      };
    } catch (e) {
      throw new Error(`Search failed: ${e.message}`);
    }
  }

  async detail({ url, ...rest }) {
    try {
      const $ = await this.get(url);
      const filename = $("td h1").eq(0).text().trim() || "Unknown";
      const fullFn = $("td b").filter((i, el) => $(el).text().includes(".")).eq(0).text().trim() || "Unknown";
      const size = $("td").filter((i, el) => $(el).text().match(/[KM]B/)).eq(0).text().trim() || "Unknown";
      const srcRow = $("td").filter((i, el) => $(el).text().trim() === "Link source:").eq(0);
      const source = srcRow?.next("td")?.text().trim() || "";
      const titleRow = $("td").filter((i, el) => $(el).text().trim() === "Source title:").eq(0);
      const sourceTitle = titleRow?.next("td")?.text().trim() || "";

      let dlUrl = "";
      for (const el of $("script").get()) {
        const code = $(el).html() || "";
        const match = code.match(/unescape\('([^']+)'\)/);
        if (match) {
          const raw = decodeURIComponent(match[1]);
          dlUrl = raw.match(/href=['"]([^'"]+)['"]/i)?.[1] || raw;
          break;
        }
      }

      let realUrl = dlUrl || "Unknown";
      if (dlUrl) {
        try {
          const { request } = await axios.head(dlUrl);
          realUrl = request?.res?.responseUrl || dlUrl;
        } catch (e) {
          realUrl = dlUrl;
        }
      }

      const similar = [];
      for (const el of $('strong a[href*="/f/"]').get()) {
        const $el = $(el);
        const link = $el.attr("href") || "";
        const text = $el.text().trim();
        if (link && text) {
          similar.push({
            title: text,
            url: `${this.base}${link}`
          });
        }
        if (similar.length >= 5) break;
      }

      return {
        filename: filename,
        full_filename: fullFn,
        file_size: size,
        source_url: source,
        source_title: sourceTitle,
        download_url: realUrl,
        similar: similar
      };
    } catch (e) {
      throw new Error(`Detail failed: ${e.message}`);
    }
  }
}

router.get("/search", async (req, res) => {
  try {
    const { q, limit, detail } = req.query;

    if (!q) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: q"
      });
    }

    const api = new MediaFireScraper();
    const response = await api.search({
      query: q,
      limit: parseInt(limit) || 5,
      detail: detail !== "false"
    });

    return res.status(200).json({
      status: true,
      query: q,
      total: response.total,
      results: response.results
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message
    });
  }
});

router.get("/detail", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: url"
      });
    }

    const api = new MediaFireScraper();
    const response = await api.detail({ url });

    return res.status(200).json({
      status: true,
      url: url,
      data: response
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message
    });
  }
});

module.exports = {
  path: "/api/mediafire",
  name: "MediaFire Trend Search",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/mediafire/search?q=software`,
  logo: "https://www.mediafire.com/favicon.ico",
  category: "search",
  info: "Search and get download links from MediaFire Trend",
  router
};

