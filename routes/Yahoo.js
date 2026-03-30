const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

class YahooSearchHelper {
  static getHeaders() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1"
    };
  }

  static async search(query) {
    const yahooURL = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`;

    const { data } = await axios.get(yahooURL, {
      headers: this.getHeaders(),
      timeout: 30000
    });

    const $ = cheerio.load(data);
    const results = [];

    const resultSelectors = [
      "ol.reg.searchCenterMiddle > li",
      ".searchCenterMiddle li",
      ".algo li",
      "#web li"
    ];

    for (const selector of resultSelectors) {
      $(selector).each((index, element) => {
        const titleSelectors = [
          "h3.title a",
          "h3 a",
          ".title a",
          "a.ac-algo"
        ];

        let title = "";
        let link = "";
        for (const titleSel of titleSelectors) {
          const titleElement = $(element).find(titleSel);
          title = titleElement.text().trim();
          link = titleElement.attr("href");
          if (title && link) break;
        }

        const snippetSelectors = [
          "div.compText p",
          ".compText p",
          ".description",
          "p"
        ];

        let snippet = "";
        for (const snippetSel of snippetSelectors) {
          snippet = $(element).find(snippetSel).text().trim();
          if (snippet) break;
        }

        const faviconSelectors = [
          "a.thmb.algo-favicon img",
          ".algo-favicon img",
          "img.favicon"
        ];

        let favicon = "";
        for (const favSel of faviconSelectors) {
          favicon = $(element).find(favSel).attr("src");
          if (favicon) break;
        }

        if (title && link) {
          results.push({
            position: results.length + 1,
            title,
            link,
            snippet: snippet || "",
            favicon: favicon || ""
          });
        }
      });

      if (results.length > 0) break;
    }

    return results;
  }
}

router.get("/yahoo", async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: q",
        example: "/api/search/yahoo?q=morocco"
      });
    }

    const results = await YahooSearchHelper.search(q);

    if (results.length === 0) {
      return res.status(404).json({
        status: false,
        error: "No search results found"
      });
    }

    return res.status(200).json({
      status: true,
      query: q,
      total: results.length,
      search_results: results
    });

  } catch (error) {
    console.error("Yahoo Search Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Failed to fetch search results"
    });
  }
});

module.exports = {
  path: "/api/search",
  name: "Yahoo Search",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/search/yahoo?q=morocco`,
  logo: "https://www.yahoo.com/favicon.ico",
  category: "search",
  info: "Search Yahoo and get results with title, link, snippet and favicon",
  router
};
