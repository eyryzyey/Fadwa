const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

const headers = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "ar-SA,ar;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1"
};

router.get("/book", async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "📚 يرجى إدخال اسم الكتاب أو الرواية للبحث عنها ✍️"
      });
    }

    const searchUrl = `https://www.alarabimag.com/search/?q=${encodeURIComponent(query.trim())}`;
    const { data } = await axios.get(searchUrl, { headers, timeout: 10000 });
    const $ = cheerio.load(data);

    const books = [];
    const bookElements = $(".hotbooks").slice(0, 10);

    if (bookElements.length === 0) {
      return res.status(404).json({
        status: false,
        error: "🔍❌ لم يتم العثور على أي نتائج 📭"
      });
    }

    await Promise.all(
      bookElements.map(async (_, element) => {
        const title = $(element).find("h2 a").text().trim();
        const bookUrl = "https://www.alarabimag.com" + ($(element).find("h2 a").attr("href") || "");
        const description = $(element).find(".info").text().trim();
        const imageSrc = "https://www.alarabimag.com" + ($(element).find(".smallimg").attr("src") || "");

        if (!title || !bookUrl) return;

        try {
          const { data: bookPage } = await axios.get(bookUrl, { headers, timeout: 10000 });
          const $$ = cheerio.load(bookPage);
          const downloadLink = $$("#download a").attr("href");

          if (!downloadLink) return;

          const downloadPageUrl = "https://www.alarabimag.com" + downloadLink;
          const { data: downloadPage } = await axios.get(downloadPageUrl, { headers, timeout: 10000 });
          const $$$ = cheerio.load(downloadPage);

          const downloadLinks = $$$("#download a")
            .map((_, el) => {
              const href = $$$(el).attr("href");
              return href ? "https://www.alarabimag.com" + href : null;
            })
            .get()
            .filter(link => link !== null);

          const infos = $$$(".rTable .rTableRow")
            .map((_, row) => ({
              title: $$$(row).find(".rTableHead").text().trim(),
              value: $$$(row).find(".rTableCell").text().trim()
            }))
            .get()
            .filter(info => info.title && info.value);

          books.push({
            title,
            url: bookUrl,
            description,
            imageSrc,
            downloadLinks,
            infos
          });
        } catch (err) {
          console.error(`⚠️ خطأ في جلب تفاصيل الكتاب (${title}):`, err.message);
        }
      }).get()
    );

    if (books.length === 0) {
      return res.status(404).json({
        status: false,
        error: "📖❌ لم يتم العثور على روابط تحميل للكتب 🔗"
      });
    }

    return res.json({
      status: true,
      count: books.length,
      query: query.trim(),
      books
    });

  } catch (error) {
    console.error("🚨 خطأ في البحث:", error.message);
    return res.status(500).json({
      status: false,
      error: "⚡ حدث خطأ أثناء البحث عن الكتب 📚"
    });
  }
});

module.exports = {
  path: "/api/books",
  name: "Recherche de Livres 📚",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/books/book?query=romans`,
  logo: "https://files.catbox.moe/wy1k15.jpg",
  category: "search",
  info: "🔍 Recherchez et téléchargez des livres depuis la Bibliothèque Arabe 📖",
  router
};

