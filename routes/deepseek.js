const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

const AJ_URL = "https://www.aljazeera.net/";
const HEADERS = {
  "user-agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
  "accept-language": "ar,en;q=0.9",
  "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "accept-encoding": "gzip, deflate, br",
  "referer": "https://www.google.com/"
};

async function getBreakingNews() {
  const { data: html } = await axios.get(AJ_URL, { timeout: 20000, headers: HEADERS });

  const results = {
    mainHeadline: null,
    liveUpdates: [],
    liveUrl: null
  };

  const mainRe = /عاجل[\s\S]{0,300}?<h[123][^>]*>\s*([\s\S]+?)\s*<\/h[123]>/;
  const mainMatch = html.match(mainRe);
  if (mainMatch) {
    results.mainHeadline = mainMatch[1]
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  if (!results.mainHeadline) {
    const altRe = /href="([^"]*liveblog[^"]*)"[^>]*>[\s\S]{0,200}?<h[123][^>]*>([\s\S]+?)<\/h[123]>/;
    const altMatch = html.match(altRe);
    if (altMatch) {
      results.mainHeadline = altMatch[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      results.liveUrl = "https://www.aljazeera.net" + altMatch[1];
    }
  }

  if (!results.liveUrl) {
    const liveUrlRe = /href="(\/news\/liveblog\/[^"]+)"/;
    const liveUrlMatch = html.match(liveUrlRe);
    if (liveUrlMatch) results.liveUrl = "https://www.aljazeera.net" + liveUrlMatch[1].split("?")[0];
  }

  const updateRe = /<h[34][^>]*>\s*<a[^>]*href="([^"]*liveblog[^"]*)"[^>]*>([\s\S]+?)<\/a>\s*<\/h[34]>/g;
  let match;
  while ((match = updateRe.exec(html)) !== null && results.liveUpdates.length < 8) {
    const title = match[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (title && title.length > 10) {
      results.liveUpdates.push(title);
    }
  }

  if (!results.liveUpdates.length) {
    const blockRe = /تغطية مباشرة[\s\S]{0,5000}?(?=اختيارات المحررين|class="article-card)/;
    const blockMatch = html.match(blockRe);
    if (blockMatch) {
      const block = blockMatch[0];
      const itemRe = /<h[34][^>]*>([\s\S]+?)<\/h[34]>/g;
      let m2;
      while ((m2 = itemRe.exec(block)) !== null && results.liveUpdates.length < 8) {
        const t = m2[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
        if (t && t.length > 10) results.liveUpdates.push(t);
      }
    }
  }

  return results;
}

router.get("/news", async (req, res) => {
  try {
    const data = await getBreakingNews();

    if (!data.mainHeadline && data.liveUpdates.length === 0) {
      return res.status(404).json({
        status: false,
        error: "No breaking news found at the moment"
      });
    }

    return res.status(200).json({
      status: true,
      platform: "aljazeera",
      mainHeadline: data.mainHeadline,
      liveUpdates: data.liveUpdates,
      liveUrl: data.liveUrl,
      totalUpdates: data.liveUpdates.length,
      source: "https://www.aljazeera.net/"
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message || "Failed to fetch news from Al Jazeera"
    });
  }
});

module.exports = {
  path: "/api/aljazeera",
  name: "Al Jazeera Breaking News",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/aljazeera/news`,
  logo: "https://cdn-icons-png.flaticon.com/512/5968/5968866.png",
  category: "ai",
  info: "Get breaking news and live updates from Al Jazeera",
  router
};

