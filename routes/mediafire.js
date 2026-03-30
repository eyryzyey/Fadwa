const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

class MediafireSearchHelper {
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

  static shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  static async search(query, limit = 5) {
    const headers = this.getHeaders();
    const searchUrl = `https://mediafiretrend.com/?q=${encodeURIComponent(query)}&search=Search`;

    const { data: html } = await axios.get(searchUrl, {
      headers,
      timeout: 30000
    });

    const $ = cheerio.load(html);
    
    const linkSelectors = [
      'tbody tr a[href*="/f/"]',
      'a[href*="/f/"]',
      'table tbody tr a',
      '.file-list a',
      'a[href^="/f/"]'
    ];

    let links = [];
    for (const selector of linkSelectors) {
      links = $(selector).map((_, el) => $(el).attr("href")).get();
      if (links.length > 0) break;
    }

    if (!links.length) {
      return [];
    }

    const shuffledLinks = this.shuffle(links).slice(0, limit);
    const results = await Promise.all(
      shuffledLinks.map(async (link) => {
        try {
          return await this.getFileDetails(link, headers);
        } catch (err) {
          console.error(`Error fetching ${link}:`, err.message);
          return null;
        }
      })
    );

    return results.filter(item => item !== null);
  }

  static async getFileDetails(link, headers) {
    const fullUrl = link.startsWith("http") ? link : `https://mediafiretrend.com${link}`;
    const { data } = await axios.get(fullUrl, { headers, timeout: 30000 });
    const $ = cheerio.load(data);

    const filenameSelectors = [
      "tr:nth-child(2) td:nth-child(2) b",
      ".info tr:nth-child(2) td:nth-child(2) b",
      "table.info tbody tr:nth-child(2) td:nth-child(2) b",
      "h1.filename",
      ".filename",
      "b:contains('.')"
    ];

    let filename = "";
    for (const selector of filenameSelectors) {
      filename = $(selector).first().text().trim();
      if (filename) break;
    }

    const filesizeSelectors = [
      "tr:nth-child(3) td:nth-child(2)",
      ".info tr:nth-child(3) td:nth-child(2)",
      "table.info tbody tr:nth-child(3) td:nth-child(2)",
      ".filesize",
      "td:contains('MB'), td:contains('GB'), td:contains('KB')"
    ];

    let filesize = "";
    for (const selector of filesizeSelectors) {
      filesize = $(selector).first().text().trim();
      if (filesize && /(MB|GB|KB|Bytes)/i.test(filesize)) break;
    }

    const scriptSelectors = [
      "div.info tbody tr:nth-child(4) td:nth-child(2) script",
      "tbody tr:nth-child(4) td:nth-child(2) script",
      "script:contains('unescape')",
      "script"
    ];

    let downloadUrl = null;
    for (const selector of scriptSelectors) {
      const raw = $(selector).text();
      const match = raw.match(/unescape\(['"`]([^'"`]+)['"`]\)/);
      if (match) {
        const decoded = cheerio.load(decodeURIComponent(match[1]));
        downloadUrl = decoded("a").attr("href");
        if (downloadUrl) break;
      }
    }

    const sourceUrlSelectors = [
      "tr:nth-child(5) td:nth-child(2)",
      ".info tr:nth-child(5) td:nth-child(2)",
      "table.info tbody tr:nth-child(5) td:nth-child(2)"
    ];

    let sourceUrl = "";
    for (const selector of sourceUrlSelectors) {
      sourceUrl = $(selector).first().text().trim();
      if (sourceUrl) break;
    }

    const sourceTitleSelectors = [
      "tr:nth-child(6) td:nth-child(2)",
      ".info tr:nth-child(6) td:nth-child(2)",
      "table.info tbody tr:nth-child(6) td:nth-child(2)"
    ];

    let sourceTitle = "";
    for (const selector of sourceTitleSelectors) {
      sourceTitle = $(selector).first().text().trim();
      if (sourceTitle) break;
    }

    if (!downloadUrl) {
      throw new Error("Download URL not found");
    }

    return {
      filename: filename || "Unknown",
      filesize: filesize || "Unknown",
      url: downloadUrl,
      source_url: sourceUrl || "",
      source_title: sourceTitle || ""
    };
  }
}

router.get("/search", async (req, res) => {
  try {
    const { q, limit } = req.query;

    if (!q) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: q",
        example: "/api/mediafire/search?q=nodejs+tutorial&limit=5"
      });
    }

    const searchLimit = parseInt(limit) || 5;
    if (searchLimit < 1 || searchLimit > 20) {
      return res.status(400).json({
        status: false,
        error: "Limit must be between 1 and 20"
      });
    }

    const results = await MediafireSearchHelper.search(q, searchLimit);

    if (!results.length) {
      return res.status(404).json({
        status: false,
        error: "No results found, try another keyword"
      });
    }

    return res.status(200).json({
      status: true,
      query: q,
      total: results.length,
      results: results
    });

  } catch (error) {
    console.error("Mediafire Search Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal server error"
    });
  }
});

module.exports = {
  path: "/api/mediafire",
  name: "Mediafire Search",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/mediafire/search?q=nodejs+tutorial&limit=5`,
  logo: "https://www.mediafire.com/favicon.ico",
  category: "search",
  info: "Search Mediafire files via mediafiretrend.com",
  router
};

