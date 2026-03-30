const express = require("express");
const translate = require("google-translate-api-x");

const router = express.Router();

const headers = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive"
};

async function translateText(text, to) {
  try {
    const result = await translate(text, { to });
    
    return {
      original_text: text,
      translated_text: result.text,
      from_language: result.from.language.iso,
      to_language: to
    };
  } catch (error) {
    throw new Error(error.message);
  }
}

router.get("/translate", async (req, res) => {
  try {
    const { text, to } = req.query;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "✍️ يرجى تقديم النص المطلوب ترجمته"
      });
    }

    if (!to || to.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "🌐 يرجى تحديد اللغة الهدف (مثال: en, fr, ar)"
      });
    }

    const data = await translateText(text.trim(), to.trim().toLowerCase());

    return res.json({
      status: true,
      original_text: data.original_text,
      translated_text: data.translated_text,
      from_language: data.from_language,
      to_language: data.to_language
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: "⚡ حدث خطأ أثناء الترجمة، يرجى المحاولة لاحقاً"
    });
  }
});

module.exports = {
  path: "/api/translate",
  name: "Traduction de Texte 🌐",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/translate/translate?text=bonjour&to=ar`,
  logo: "https://files.catbox.moe/yel9l1.jpg",
  category: "ai",
  info: "📝 ترجمة النصوص بين اللغات المختلفة باستخدام Google Translate",
  router
};

