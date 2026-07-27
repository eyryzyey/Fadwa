const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

const BASE_URL = "https://m.apkpure.com";
const COOKIE_STR = [
  "_apk_sid=1.1.1785171857618.1.1.1785171857618.0",
  "_apk_uid=EBHrr8cmYdB1NbM1jRyzXx7B8BMPaPHt",
  "_qimei=zWeXdzkhamKR4N5SbiR8hDZpsBGynzWQ",
  "_user_tag=j%3A%7B%22language%22%3A%22fr%22%2C%22source_language%22%3A%22fr-FR%22%2C%22country%22%3A%22MA%22%7D",
  "apkpure__lang=fr",
  "apkpure__country=MA",
  "apkpure__sample=0.5165852928348031",
  "_dt_sample=0.8900335737858915",
  "_dt_referrer_fix=0.5518108805219759",
  "_tag_sample=0.5514547693134337",
  "_home_article_entry_sample=0.9305527128015736",
  "_related_recommend=0.3537886410581865",
  "_download_detail_sample=0.45331034094334943",
  "_f_sp=91578913",
  "udb_appid=1025",
  "hdid=9dc30abd7938180ad74b71016891537b14b60f0e",
  "sdid=0UnHUgv0_qmfD4KAKlwzhqfrjwDppP_hzlEbGNjyS0tI2T753ZXVGrmnioAcw2ijwTwMAUBn4rQscphbce8i43n3Q3BHeVEApIhLQffMQzpPWVkn9LtfFJw_Qo4kgKr8OZHDqNnuwg612sGyflFn1dpmrb0YdZsN5hhrCptAh3an8cgC2Pz3nbgh4-xW5ToV6"
].join("; ");

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Linux; Android 16; SM-A075F Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.124 Mobile Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9,ar-MA;q=0.8,ar;q=0.7,en-US;q=0.6,en;q=0.5",
  "Accept-Encoding": "gzip, deflate, br, zstd",
  "Referer": "https://m.apkpure.com/fr/",
  "X-Requested-With": "mark.via.gp",
  "Sec-Ch-Ua": `"Not;A=Brand";v="8", "Chromium";v="150", "Android WebView";v="150"`,
  "Sec-Ch-Ua-Mobile": "?1",
  "Sec-Ch-Ua-Platform": `"Android"`,
  "Sec-Fetch-Site": "same-site",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Dest": "document",
  "Connection": "keep-alive",
  "Cache-Control": "max-age=0",
  "Cookie": COOKIE_STR
};

class APKPureScraper {
  async fetchHTML(path) {
    const url = `${BASE_URL}${path}`;
    const { data } = await axios.get(url, {
      headers: HEADERS,
      timeout: 30000,
      responseType: "text",
      decompress: true
    });
    return data;
  }

  extractFromScript($, patterns) {
    let result = null;
    $("script").each((i, el) => {
      const text = $(el).html() || "";
      for (const { regex, group = 1 } of patterns) {
        const m = text.match(regex);
        if (m && m[group]) {
          result = m[group];
          return false;
        }
      }
    });
    return result;
  }

  async search(query) {
    const html = await this.fetchHTML(`/fr/search?q=${encodeURIComponent(query)}`);
    const $ = cheerio.load(html);
    const results = [];

    const itemSelectors = [
      ".search-item",
      ".app-item",
      ".info-box",
      "a[href*='/app/']"
    ];

    let items = $();
    for (const sel of itemSelectors) {
      items = $(sel);
      if (items.length) break;
    }

    items.each((i, el) => {
      const $el = $(el);
      const linkEl = $el.is("a") ? $el : $el.find("a[href*='/app/']").first();
      const href = linkEl.attr("href") || "";

      const match = href.match(/\/app\/([^/]+)\/([^/]+)/);
      if (!match) return;

      const titleSelectors = [".title", ".app-name", "h3", ".name", ".info-title", "p"];
      let title = "";
      for (const sel of titleSelectors) {
        title = $el.find(sel).first().text().trim();
        if (title) break;
      }
      if (!title && linkEl.attr("title")) title = linkEl.attr("title");

      const iconSelectors = [".icon img", ".app-icon img", "img"];
      let icon = "";
      for (const sel of iconSelectors) {
        icon = $el.find(sel).first().attr("src") || $el.find(sel).first().attr("data-src") || "";
        if (icon) break;
      }

      const devSelectors = [".developer", ".author", ".dev"];
      let developer = "";
      for (const sel of devSelectors) {
        developer = $el.find(sel).first().text().trim();
        if (developer) break;
      }

      results.push({
        index: i,
        title: title || match[1].replace(/-/g, " "),
        packageName: match[2],
        slug: match[1],
        url: href.startsWith("http") ? href : `${BASE_URL}${href}`,
        icon: icon || null,
        developer: developer || null
      });
    });

    return results;
  }

  async appDetails(packageName) {
    const html = await this.fetchHTML(`/fr/${packageName.replace(/\./g, "-")}/${packageName}`);
    const $ = cheerio.load(html);

    const titleSelectors = [".title", "h1", ".app-name", ".name"];
    let title = "";
    for (const sel of titleSelectors) {
      title = $(sel).first().text().trim();
      if (title) break;
    }

    const versionSelectors = [".version", ".version-name", ".ver", "[data-version]"];
    let version = "";
    for (const sel of versionSelectors) {
      version = $(sel).first().text().trim() || $(sel).first().attr("data-version") || "";
      if (version) break;
    }

    const sizeSelectors = [".size", ".file-size", "[data-size]"];
    let size = "";
    for (const sel of sizeSelectors) {
      size = $(sel).first().text().trim() || $(sel).first().attr("data-size") || "";
      if (size) break;
    }

    const descSelectors = [".description", ".desc", ".about", ".intro"];
    let description = "";
    for (const sel of descSelectors) {
      description = $(sel).first().text().trim();
      if (description) break;
    }

    const iconSelectors = [".icon img", ".app-icon img", ".icon"];
    let icon = "";
    for (const sel of iconSelectors) {
      icon = $(sel).first().attr("src") || $(sel).first().attr("data-src") || "";
      if (icon) break;
    }

    const devSelectors = [".developer", ".author", ".dev-name"];
    let developer = "";
    for (const sel of devSelectors) {
      developer = $(sel).first().text().trim();
      if (developer) break;
    }

    const dlBtnSelectors = ["a.download-btn", "a[href*='/download']", ".download a", "a.btn-download"];
    let downloadPageUrl = "";
    for (const sel of dlBtnSelectors) {
      const href = $(sel).first().attr("href");
      if (href) {
        downloadPageUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`;
        break;
      }
    }

    const screenshotSelectors = [".screenshot img", ".screenshot-item img", ".gallery img", ".screenshots img"];
    const screenshots = [];
    for (const sel of screenshotSelectors) {
      $(sel).each((i, el) => {
        const src = $(el).attr("src") || $(el).attr("data-src") || "";
        if (src && !screenshots.includes(src)) screenshots.push(src);
      });
      if (screenshots.length) break;
    }

    return {
      title,
      packageName,
      version,
      size,
      description: description ? description.substring(0, 1000) : null,
      icon: icon || null,
      developer: developer || null,
      downloadPageUrl: downloadPageUrl || `${BASE_URL}/fr/${packageName.replace(/\./g, "-")}/${packageName}/download`,
      screenshots: screenshots.slice(0, 10)
    };
  }

  async resolveDownload(packageName) {
    const path = `/fr/${packageName.replace(/\./g, "-")}/${packageName}/download`;
    const html = await this.fetchHTML(path);
    const $ = cheerio.load(html);

    const apkUrl = this.extractFromScript($, [
      { regex: /(https?:\/\/[^"']+\.apk[^"']*)/i },
      { regex: /"download_url"\s*:\s*"([^"]+)"/i },
      { regex: /"url"\s*:\s*"(https?:\/\/[^"]+\.apk[^"]*)"/i }
    ]);

    if (apkUrl) {
      return {
        directUrl: apkUrl,
        packageName,
        source: "script"
      };
    }

    const linkSelectors = ["a[href*='.apk']", "a.download-btn", ".download-link a", "a.btn-primary"];
    for (const sel of linkSelectors) {
      const href = $(sel).first().attr("href");
      if (href && href.includes(".apk")) {
        return {
          directUrl: href.startsWith("http") ? href : `${BASE_URL}${href}`,
          packageName,
          source: "link"
        };
      }
    }

    throw new Error("Could not extract APK download URL");
  }
}

router.get("/search", async (req, res) => {
  try {
    const { q, query } = req.query;
    const searchQuery = q || query;

    if (!searchQuery || searchQuery.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'q' or 'query' is required",
        example: `${global.t || "http://localhost:3000"}/api/apkpure/search?q=whatsapp`,
        usage: "Search for apps on APKPure"
      });
    }

    if (searchQuery.length > 200) {
      return res.status(400).json({
        status: false,
        error: "Query too long (max 200 characters)"
      });
    }

    const scraper = new APKPureScraper();
    const results = await scraper.search(searchQuery.trim());

    return res.status(200).json({
      status: true,
      query: searchQuery.trim(),
      totalResults: results.length,
      results
    });

  } catch (error) {
    console.error("APKPure Search Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error"
    });
  }
});

router.get("/app", async (req, res) => {
  try {
    const { package: packageName, pkg, id } = req.query;
    const target = packageName || pkg || id;

    if (!target || target.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'package' or 'pkg' is required",
        example: `${global.t || "http://localhost:3000"}/api/apkpure/app?package=com.whatsapp`,
        usage: "Get app details from APKPure"
      });
    }

    const scraper = new APKPureScraper();
    const details = await scraper.appDetails(target.trim());

    return res.status(200).json({
      status: true,
      ...details
    });

  } catch (error) {
    console.error("APKPure App Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error"
    });
  }
});

router.get("/download", async (req, res) => {
  try {
    const { package: packageName, pkg, id } = req.query;
    const target = packageName || pkg || id;

    if (!target || target.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'package' or 'pkg' is required",
        example: `${global.t || "http://localhost:3000"}/api/apkpure/download?package=com.whatsapp`,
        usage: "Resolve direct APK download URL"
      });
    }

    const scraper = new APKPureScraper();
    const result = await scraper.resolveDownload(target.trim());

    return res.status(200).json({
      status: true,
      ...result
    });

  } catch (error) {
    console.error("APKPure Download Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error"
    });
  }
});

router.post("/search", async (req, res) => {
  try {
    const { q, query } = req.body;
    const searchQuery = q || query;

    if (!searchQuery || searchQuery.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'q' or 'query' is required in request body",
        example: { q: "whatsapp" }
      });
    }

    const scraper = new APKPureScraper();
    const results = await scraper.search(searchQuery.trim());

    return res.status(200).json({
      status: true,
      query: searchQuery.trim(),
      totalResults: results.length,
      results
    });

  } catch (error) {
    console.error("APKPure Search Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error"
    });
  }
});

router.post("/app", async (req, res) => {
  try {
    const { package: packageName, pkg, id } = req.body;
    const target = packageName || pkg || id;

    if (!target) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'package' or 'pkg' is required in request body"
      });
    }

    const scraper = new APKPureScraper();
    const details = await scraper.appDetails(target.trim());

    return res.status(200).json({
      status: true,
      ...details
    });

  } catch (error) {
    console.error("APKPure App Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error"
    });
  }
});

router.post("/download", async (req, res) => {
  try {
    const { package: packageName, pkg, id } = req.body;
    const target = packageName || pkg || id;

    if (!target) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'package' or 'pkg' is required in request body"
      });
    }

    const scraper = new APKPureScraper();
    const result = await scraper.resolveDownload(target.trim());

    return res.status(200).json({
      status: true,
      ...result
    });

  } catch (error) {
    console.error("APKPure Download Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error"
    });
  }
});

module.exports = {
  path: "/api/apkpure",
  name: "APKPure Scraper",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/apkpure/search?q=whatsapp`,
  logo: "https://apkpure.com/favicon.ico",
  category: "search",
  info: "Search APKPure for Android apps, get details and resolve direct APK download links with professional scraping",
  router
};
