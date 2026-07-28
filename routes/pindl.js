const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

const BASE_URL = "https://snappin.app";
const REFERER = "https://snappin.app";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
  "Upgrade-Insecure-Requests": "1"
};

class SnappinDownloader {
  constructor() {
    this.client = axios.create({
      timeout: 30000,
      headers: HEADERS,
      maxRedirects: 10,
      decompress: true
    });
  }

  async getToken() {
    try {
      const { headers, data } = await this.client.get(BASE_URL, {
        headers: {
          ...HEADERS,
          "Referer": REFERER
        }
      });

      const cookies = (headers["set-cookie"] || [])
        .map(c => c.split(";")[0])
        .join("; ");

      const $ = cheerio.load(data);

      const csrfSelectors = [
        'meta[name="csrf-token"]',
        'meta[name="csrf_token"]',
        'input[name="_token"]',
        'input[name="csrf-token"]',
        'meta[name="token"]'
      ];

      let csrfToken = null;
      for (const sel of csrfSelectors) {
        const el = $(sel);
        if (el.length) {
          csrfToken = el.attr("content") || el.val();
          if (csrfToken) break;
        }
      }

      if (!csrfToken) {
        const scriptMatch = data.match(/"csrf[_-]token"\s*[:=]\s*["']([^"']+)["']/i);
        if (scriptMatch) csrfToken = scriptMatch[1];
      }

      if (!csrfToken) {
        throw new Error("CSRF token not found on page");
      }

      if (!cookies) {
        throw new Error("Session cookies not received");
      }

      return { csrfToken, cookies };
    } catch (error) {
      if (error.response) {
        throw new Error(`Token fetch failed (${error.response.status}): ${error.response.statusText}`);
      } else if (error.request) {
        throw new Error("Token fetch failed: No response from server");
      } else {
        throw new Error(`Token fetch failed: ${error.message}`);
      }
    }
  }

  async download(pinterestUrl) {
    try {
      const { csrfToken, cookies } = await this.getToken();

      const postRes = await this.client.post(
        BASE_URL,
        { url: pinterestUrl },
        {
          headers: {
            ...HEADERS,
            "Content-Type": "application/json",
            "X-Csrf-Token": csrfToken,
            "X-Requested-With": "XMLHttpRequest",
            "Cookie": cookies,
            "Referer": REFERER,
            "Origin": BASE_URL,
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors"
          },
          timeout: 60000
        }
      );

      const $ = cheerio.load(postRes.data);

      const thumbSelectors = [
        "img.preview",
        ".preview img",
        ".thumbnail img",
        "img[src]",
        "img"
      ];

      let thumb = null;
      for (const sel of thumbSelectors) {
        const src = $(sel).first().attr("src");
        if (src) {
          thumb = src.startsWith("http") ? src : `${BASE_URL}${src}`;
          break;
        }
      }

      const linkSelectors = [
        "a.button.is-success",
        "a[href*='/download']",
        "a.download-btn",
        "a.btn-success",
        "a[download]"
      ];

      let downloadLinks = [];
      for (const sel of linkSelectors) {
        const links = $(sel)
          .map((_, el) => $(el).attr("href"))
          .get()
          .filter(Boolean);
        if (links.length) {
          downloadLinks = links;
          break;
        }
      }

      let videoUrl = null;
      let imageUrl = null;

      for (const link of downloadLinks) {
        const fullLink = link.startsWith("http") ? link : `${BASE_URL}${link}`;

        const head = await this.client.head(fullLink, {
          headers: {
            ...HEADERS,
            "Referer": BASE_URL,
            "Cookie": cookies
          },
          timeout: 15000
        }).catch(() => null);

        const contentType = head?.headers?.["content-type"] || "";

        if (link.includes("/download-file/")) {
          if (contentType.includes("video")) {
            videoUrl = fullLink;
          } else if (contentType.includes("image")) {
            imageUrl = fullLink;
          }
        } else if (link.includes("/download-image/")) {
          imageUrl = fullLink;
        } else if (contentType.includes("video")) {
          videoUrl = fullLink;
        } else if (contentType.includes("image")) {
          imageUrl = fullLink;
        }
      }

      if (!videoUrl && !imageUrl) {
        throw new Error("No downloadable video or image found");
      }

      return {
        status: true,
        thumb,
        video: videoUrl,
        image: videoUrl ? null : imageUrl,
        type: videoUrl ? "video" : "image",
        source: pinterestUrl,
        metadata: {
          totalLinks: downloadLinks.length,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      if (error.response?.data) {
        const apiMsg = typeof error.response.data === "string"
          ? error.response.data
          : error.response.data.message || error.response.data.error;
        throw new Error(apiMsg || error.message);
      } else if (error.request) {
        throw new Error("Server did not respond");
      } else {
        throw new Error(error.message || "Unknown error");
      }
    }
  }
}

function isPinterestUrl(url) {
  const regex = /^https?:\/\/(www\.)?(pinterest\.[a-z]+|pin\.it)\//i;
  return regex.test(url);
}

router.get("/download", async (req, res) => {
  try {
    const { url, link } = req.query;
    const targetUrl = url || link;

    if (!targetUrl || targetUrl.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'url' or 'link' is required",
        example: `${global.t || "http://localhost:3000"}/api/pinterest/download?url=https://pin.it/xxxx`,
        usage: "Download video or image from Pinterest via Snappin",
        supportedFormats: [
          "https://pin.it/xxxx",
          "https://www.pinterest.com/pin/xxxx"
        ]
      });
    }

    const trimmedUrl = targetUrl.trim();

    if (!isPinterestUrl(trimmedUrl)) {
      return res.status(400).json({
        status: false,
        error: "Invalid Pinterest URL format",
        example: "https://pin.it/abcd1234",
        supportedDomains: ["pin.it", "pinterest.com", "pinterest.fr", "pinterest.co.uk"]
      });
    }

    const downloader = new SnappinDownloader();
    const result = await downloader.download(trimmedUrl);

    return res.status(200).json(result);

  } catch (error) {
    console.error("Pinterest Download API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error",
      message: "Failed to download Pinterest content"
    });
  }
});

router.post("/download", async (req, res) => {
  try {
    const { url, link } = req.body;
    const targetUrl = url || link;

    if (!targetUrl || targetUrl.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'url' or 'link' is required in request body",
        example: {
          url: "https://pin.it/abcd1234"
        }
      });
    }

    const trimmedUrl = targetUrl.trim();

    if (!isPinterestUrl(trimmedUrl)) {
      return res.status(400).json({
        status: false,
        error: "Invalid Pinterest URL format",
        example: "https://pin.it/abcd1234"
      });
    }

    const downloader = new SnappinDownloader();
    const result = await downloader.download(trimmedUrl);

    return res.status(200).json(result);

  } catch (error) {
    console.error("Pinterest Download API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error"
    });
  }
});

module.exports = {
  path: "/api/pinterest",
  name: "Pinterest Downloader",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/pinterest/download?url=https://pin.it/xxxx`,
  logo: "https://www.pinterest.com/favicon.ico",
  category: "download",
  info: "Download videos and images from Pinterest via Snappin scraper with CSRF token handling",
  router
};

