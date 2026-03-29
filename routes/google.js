const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

// 🔎 Endpoint
router.get("/google", async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        status: false,
        error: "❌ خاصك دير ?q=keyword"
      });
    }

    const url = `https://www.google.com/search?q=${encodeURIComponent(q)}&hl=en&gl=us`;

    const { data } = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1"
      },
      timeout: 10000
    });

    const $ = cheerio.load(data);
    const results = [];

    // ✅ السيليكتورات الجديدة المحدثة لعام 2024-2025
    const resultSelectors = [
      "div.N54PNb",      // السيليكتور الأساسي الجديد
      "div.MjjYud",      // بديل آخر
      "div.tF2Cxc",      // كتل النتائج
      "div.g"            // محاولة السيليكتور القديم للتوافق
    ];

    let usedSelector = "";
    
    // نجد السيليكتور الذي يعطي نتائج
    for (const selector of resultSelectors) {
      if ($(selector).length > 0) {
        usedSelector = selector;
        break;
      }
    }

    if (!usedSelector) {
      return res.status(500).json({
        status: false,
        error: "لم يتم العثور على نتائج - ربما تغير هيكل Google مرة أخرى"
      });
    }

    $(usedSelector).each((i, el) => {
      // ✅ استخراج العنوان باستخدام السيليكتور المحدث
      const titleElement = $(el).find("h3.LC20lb, h3.MBeuO, h3.DKV0Md, h3").first();
      const title = titleElement.text().trim();

      // ✅ استخراج الرابط مع معالجة إعادة التوجيه
      let link = $(el).find("a").first().attr("href") || "";
      
      // إزالة إعادة توجيه Google إن وجدت
      if (link.startsWith("/url?q=")) {
        link = decodeURIComponent(link.replace("/url?q=", "").split("&")[0]);
      } else if (link.startsWith("/search")) {
        link = null; // تجاهل روابط البحث الداخلية
      }

      // ✅ استخراج الوصف باستخدام السيليكتور المحدث
      const snippetElement = $(el).find(".VwiC3b, .yXK7lf, .lVm3ye, .Hdw6tb, [data-sncf='1']").first();
      const snippet = snippetElement.text().trim();

      // ✅ استخراج النطاق (الدومين)
      const domainElement = $(el).find(".yuRUbf .NJjxre .tjvcx, cite, .byrV5b").first();
      const domain = domainElement.text().trim();

      if (title && link && link.startsWith("http")) {
        results.push({
          position: results.length + 1,
          title,
          link,
          snippet,
          domain: domain || new URL(link).hostname.replace("www.", "")
        });
      }
    });

    // ✅ استخراج معلومات إضافية
    const totalResultsText = $("#result-stats").text();
    const totalResultsMatch = totalResultsText.match(/About ([\d,]+) results/);
    const totalResults = totalResultsMatch ? totalResultsMatch[1] : "unknown";

    res.json({
      status: true,
      query: q,
      selector_used: usedSelector,
      total_found: results.length,
      total_results_text: totalResults,
      results
    });

  } catch (err) {
    console.error("Scraping Error:", err.message);
    res.status(500).json({
      status: false,
      error: err.message,
      hint: "قد يكون Google قد حظر الطلب - جرب إضافة تأخير أو استخدام proxy"
    });
  }
});

// 📦 Export
module.exports = {
  path: "/api/search",
  name: "Google Search",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/search/google?q=chatgpt`,
  logo: "https://www.google.com/favicon.ico",
  category: "search",
  info: "Google search scraping API - Updated 2024 selectors",
  router
};
