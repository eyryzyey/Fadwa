const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

class BraveSearch {
  constructor() {
    this.cfg = {
      url: "https://search.brave.com/search",
      hdr: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "accept-language": "id-ID",
        "accept-encoding": "gzip, deflate, br",
        "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
        referer: "https://search.brave.com/",
        "sec-ch-ua": '"Chromium";v="127", "Not)A;Brand";v="99"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "same-origin",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
        priority: "u=0, i",
        connection: "keep-alive"
      }
    };
  }

  async search({ query, ...rest }) {
    const q = query ?? rest.q ?? "";
    
    try {
      const p = {
        q: q,
        source: "web",
        ...rest
      };

      const r = await axios.get(this.cfg.url, {
        params: p,
        headers: this.cfg.hdr
      });

      return this.parse(r.data);
    } catch (e) {
      throw new Error(e?.message ?? "Search failed");
    }
  }

  parse(html) {
    const $ = cheerio.load(html);
    const results = [];

    $('.snippet[data-type="web"]').each((i, el) => {
      const $el = $(el);
      const pos = $el.attr("data-pos") || null;
      const $link = $el.find("a.l1").first();
      const url = $link.attr("href") || "";
      const title = $link.find(".title").text().trim() || "No title";
      const $siteWrapper = $el.find(".site-wrapper");
      const sitename = $siteWrapper.find(".sitename").text().trim() || "";
      const $cite = $siteWrapper.find("cite.snippet-url");
      const netloc = $cite.find(".netloc").text().trim() || "";
      const urlPath = $cite.find(".url-path").text().trim() || "";
      const desc = $el.find(".snippet-description").text().trim() || "No description";
      const $thumb = $el.find(".thumbnail img");
      const thumbnail = $thumb.length ? $thumb.attr("src") : null;

      const meta = {};
      $el.find(".item-attributes .r-attr").each((_, attr) => {
        const $attr = $(attr);
        const text = $attr.text().trim();
        if (text.includes("Dibintangi") || text.includes("Starred")) {
          meta.stars = text.match(/\d+/)?.[0] || null;
        }
        if (text.includes("Diambil") || text.includes("Forked")) {
          meta.forks = text.match(/\d+/)?.[0] || null;
        }
        if (text.includes("Bahasa") || text.includes("Language")) {
          meta.language = text.split(":")[1]?.trim() || null;
        }
        if (text.includes("Penulis") || text.includes("Author")) {
          meta.author = text.split(":")[1]?.trim() || null;
        }
      });

      const dateMatch = desc.match(/\d{1,2}\s+(?:Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/i);
      const date = dateMatch ? dateMatch[0] : null;

      if (url) {
        results.push({
          position: pos,
          url: url,
          title: title,
          description: desc,
          site: sitename,
          domain: netloc,
          path: urlPath,
          fullPath: urlPath ? `${netloc}${urlPath.startsWith("›") ? urlPath.substring(1).trim() : urlPath}` : netloc,
          thumbnail: thumbnail,
          date: date,
          metadata: Object.keys(meta).length > 0 ? meta : null
        });
      }
    });

    return {
      status: true,
      count: results.length,
      results: results
    };
  }
}

router.get("/search", async (req, res) => {
  try {
    const { q, ...rest } = req.query;

    if (!q) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: q"
      });
    }

    const api = new BraveSearch();
    const data = await api.search({ query: q, ...rest });

    return res.status(200).json({
      status: true,
      query: q,
      count: data.count,
      results: data.results
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
  path: "/api/bravesearch",
  name: "Brave Search",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/bravesearch/search?q=hello`,
  logo: "https://cdn.search.brave.com/serp/v2/_app/immutable/assets/brave-logo-small.6EAVW0g8.svg",
  category: "search",
  info: "Search the web using Brave Search engine",
  router
};
