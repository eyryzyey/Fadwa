const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

class GoogleSearchHelper {
  static getHeaders() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Cache-Control": "max-age=0"
    };
  }

  static cleanGoogleLink(link) {
    if (!link) return null;
    
    if (link.startsWith("/url?q=")) {
      return decodeURIComponent(link.replace("/url?q=", "").split("&")[0]);
    }
    
    if (link.startsWith("/search")) {
      return null;
    }
    
    return link;
  }

  static extractDomain(link) {
    try {
      if (!link || !link.startsWith("http")) return "";
      return new URL(link).hostname.replace("www.", "");
    } catch {
      return "";
    }
  }
}

router.get("/google", async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: q",
        example: "/api/search/google?q=nodejs+tutorial"
      });
    }

    const url = `https://www.google.com/search?q=${encodeURIComponent(q)}&hl=en&gl=us`;

    const { data } = await axios.get(url, {
      headers: GoogleSearchHelper.getHeaders(),
      timeout: 15000
    });

    const $ = cheerio.load(data);
    const results = [];

    const resultSelectors = [
      "div.N54PNb",
      "div.MjjYud",
      "div.tF2Cxc",
      "div.g",
      "div[data-ved]",
      "div.Gx5Zad",
      "div.kCrYT",
      "div.ZINbbc",
      "div.sCuL3"
    ];

    let usedSelector = "";

    for (const selector of resultSelectors) {
      if ($(selector).length > 0) {
        usedSelector = selector;
        break;
      }
    }

    if (!usedSelector) {
      return res.status(500).json({
        status: false,
        error: "No results found - Google structure may have changed"
      });
    }

    $(usedSelector).each((i, el) => {
      const titleSelectors = [
        "h3.LC20lb",
        "h3.MBeuO",
        "h3.DKV0Md",
        "h3",
        "a h3",
        ".DKV0Md",
        ".vvjwJb"
      ];

      let title = "";
      for (const selector of titleSelectors) {
        title = $(el).find(selector).first().text().trim();
        if (title) break;
      }

      let link = $(el).find("a").first().attr("href") || "";
      link = GoogleSearchHelper.cleanGoogleLink(link);

      const snippetSelectors = [
        ".VwiC3b",
        ".yXK7lf",
        ".lVm3ye",
        ".Hdw6tb",
        "[data-sncf='1']",
        ".s3v94d",
        ".St3GK",
        ".V7Sr8",
        ".MUxGbd",
        ".yDYNvb",
        ".lyLwlc"
      ];

      let snippet = "";
      for (const selector of snippetSelectors) {
        snippet = $(el).find(selector).first().text().trim();
        if (snippet) break;
      }

      const domainSelectors = [
        ".yuRUbf .NJjxre .tjvcx",
        "cite",
        ".byrV5b",
        ".TbwUpd",
        ".iUh30",
        ".qLRx3d",
        ".gBIQub",
        ".dTe0Ie"
      ];

      let domain = "";
      for (const selector of domainSelectors) {
        domain = $(el).find(selector).first().text().trim();
        if (domain) break;
      }

      if (!domain && link) {
        domain = GoogleSearchHelper.extractDomain(link);
      }

      if (title && link && link.startsWith("http")) {
        results.push({
          position: results.length + 1,
          title,
          link,
          snippet,
          domain
        });
      }
    });

    const totalResultsText = $("#result-stats").text() || $(".LHJvCe").text();
    const totalResultsMatch = totalResultsText.match(/About ([\d,]+) results?/i) || 
                              totalResultsText.match(/([\d,]+) results?/i);
    const totalResults = totalResultsMatch ? totalResultsMatch[1] : "unknown";

    const searchTimeMatch = totalResultsText.match(/in ([\d.]+) seconds?/i);
    const searchTime = searchTimeMatch ? searchTimeMatch[1] : null;

    return res.status(200).json({
      status: true,
      query: q,
      selector_used: usedSelector,
      total_found: results.length,
      total_results_text: totalResults,
      search_time_seconds: searchTime,
      results
    });

  } catch (error) {
    console.error("Google Search Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal server error",
      hint: "Google may have blocked the request - try adding delays or using proxy"
    });
  }
});

module.exports = {
  path: "/api/search",
  name: "Google Search",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/search/google?q=chatgpt`,
  logo: "https://www.google.com/favicon.ico",
  category: "search",
  info: "Google search scraping API with multiple fallback selectors",
  router
};

