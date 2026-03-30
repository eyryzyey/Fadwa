const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const mime = require("mime-types");

const router = express.Router();

class DafontHandler {
  async search(query) {
    try {
      const response = await axios.get(`https://www.dafont.com/search.php?q=${encodeURIComponent(query)}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          Referer: "https://www.dafont.com/",
          Connection: "keep-alive"
        }
      });

      const html = response.data;
      const results = [];
      const regex = /<div class="lv1left dfbg">.*?<span class="highlight">(.*?)<\/span>.*?by <a href="(.*?)">(.*?)<\/a>.*?<\/div>.*?<div class="lv1right dfbg">.*?<a href="(.*?)">(.*?)<\/a>.*?>(.*?)<\/a>.*?<\/div>.*?<div class="lv2right">.*?<span class="light">(.*?)<\/span>.*?<\/div>.*?<div style="background-image:url\((.*?)\)" class="preview">.*?<a href="(.*?)">/g;
      
      let match;
      while ((match = regex.exec(html)) !== null) {
        const [, title, authorLink, author, themeLink, theme, , totalDownloads, previewImage, link] = match;
        results.push({
          title: title?.trim(),
          authorLink: `https://www.dafont.com/${authorLink?.trim()}`,
          author: author?.trim(),
          themeLink: `https://www.dafont.com/${themeLink?.trim()}`,
          theme: theme?.trim(),
          totalDownloads: totalDownloads?.trim().replace(/[^0-9]/g, ""),
          previewImage: `https://www.dafont.com${previewImage?.trim()}`,
          link: `https://www.dafont.com/${link?.trim()}`
        });
      }

      return results;
    } catch (error) {
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  async download(link) {
    try {
      const response = await axios.get(link, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          Referer: "https://www.dafont.com/"
        }
      });

      const $ = cheerio.load(response.data);
      const getValue = selector => $(selector).text().trim();

      return {
        title: getValue(".lv1left.dfbg strong"),
        author: getValue(".lv1left.dfbg a"),
        theme: getValue(".lv1right.dfbg a:last-child"),
        totalDownloads: getValue(".lv2right .light").replace(/\D/g, ""),
        filename: $(".filename").toArray().map(el => $(el).text().trim()),
        image: "https://www.dafont.com" + $(".preview").css("background-image").replace(/^url\(["']?|['"]?\)$/g, ""),
        note: $('[style^="border-left"]').text().trim(),
        download: $("a.dl").attr("href") ? "http:" + $("a.dl").attr("href") : ""
      };
    } catch (error) {
      throw new Error(`Download info failed: ${error.message}`);
    }
  }

  async detail(url) {
    try {
      const res = await axios.head(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
          Accept: "*/*"
        }
      });

      const contentType = res.headers["content-type"];
      const mimeType = mime.contentType(contentType);
      const extension = mime.extension(contentType);

      return {
        url: url,
        mimeType: mimeType || null,
        fileFormat: "." + (extension || "")
      };
    } catch (error) {
      throw new Error(`Detail fetch failed: ${error.message}`);
    }
  }

  format(num) {
    try {
      const numString = Math.abs(num).toString();
      const numDigits = numString.length;
      if (numDigits <= 3) return numString;
      const suffixIndex = Math.floor((numDigits - 1) / 3);
      let formattedNum = (num / Math.pow(1000, suffixIndex)).toFixed(1);
      if (formattedNum.endsWith(".0")) {
        formattedNum = formattedNum.slice(0, -2);
      }
      return formattedNum + ["", "k", "M", "B", "T"][suffixIndex];
    } catch (error) {
      throw new Error(`Format failed: ${error.message}`);
    }
  }
}

router.get("/search", async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: q"
      });
    }

    const dafont = new DafontHandler();
    const results = await dafont.search(q);

    return res.status(200).json({
      status: true,
      query: q,
      results: results,
      count: results.length
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message,
      results: []
    });
  }
});

router.get("/download", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: url"
      });
    }

    const dafont = new DafontHandler();
    const result = await dafont.download(url);

    return res.status(200).json({
      status: true,
      data: result
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

    const dafont = new DafontHandler();
    const result = await dafont.detail(url);

    return res.status(200).json({
      status: true,
      data: result
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message
    });
  }
});

router.get("/format", async (req, res) => {
  try {
    const { num } = req.query;

    if (!num) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: num"
      });
    }

    const dafont = new DafontHandler();
    const formatted = dafont.format(parseFloat(num));

    return res.status(200).json({
      status: true,
      original: num,
      formatted: formatted
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message
    });
  }
});

module.exports = {
  path: "/api/dafont",
  name: "DaFont Search",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/dafont/search?q=roboto`,
  logo: "https://www.dafont.com/img/dafont.png",
  category: "search",
  info: "Search and download fonts from DaFont",
  router
};

