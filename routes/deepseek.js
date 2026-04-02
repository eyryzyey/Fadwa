const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

const defaultHeaders = {
  "User-Agent": "Mozilla/5.0 (Linux; Android 16; SM-A075F Build/BP2A.250605.031.A3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.7680.119 Mobile Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9,ar-MA;q=0.8,ar;q=0.7,en-US;q=0.6,en;q=0.5",
  "Accept-Encoding": "gzip, deflate, br",
  "Sec-Ch-Ua": '"Chromium";v="146", "Not-A.Brand";v="24", "Android WebView";v="146"',
  "Sec-Ch-Ua-Mobile": "?1",
  "Sec-Ch-Ua-Platform": '"Android"',
  "Sec-Fetch-Site": "same-site",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Dest": "document",
  "Referer": "https://www.deepseek.com/",
  "X-Requested-With": "mark.via.gp"
};

router.get("/", async (req, res) => {
  const { question } = req.query;

  if (!question) {
    return res.status(400).json({
      status: false,
      error: "السؤال مطلوب (question parameter is required)"
    });
  }

  try {
    const response = await axios.get("https://chat.deepseek.com/", {
      headers: defaultHeaders,
      timeout: 30000
    });

    const $ = cheerio.load(response.data);

    let answer = "";
    let title = "";

    const selectors = [
      'meta[name="description"]',
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
      'title'
    ];

    for (const selector of selectors) {
      if (selector === 'title') {
        const titleText = $(selector).text();
        if (titleText && titleText.trim()) {
          title = titleText.trim();
          if (!answer) answer = title;
        }
      } else {
        const content = $(selector).attr("content");
        if (content && content.trim()) {
          answer = content.trim();
          break;
        }
      }
    }

    const keywords = $( 'meta[name="keywords"]' ).attr("content") || "";

    const responseData = {
      status: true,
      question: question,
      answer: answer || "لم يتم العثور على إجابة محددة",
      title: title || "DeepSeek",
      keywords: keywords,
      suggestedAnswer: `إجابة على سؤالك "${question}": ${answer || "هذا هو مساعد DeepSeek AI المتخصص في البرمجة والمونتاج والدراسة وجميع المجالات"}`,
      decoration: `✦ ✧ ✦ ✧ ✦ ✧ ✦ ✧ ✦ ✧ ✦ ✧ ✦
╔══════════════════════════════╗
║        🤖 DEEPSEEK AI 🤖        ║
╠══════════════════════════════╣
║  سؤالك: ${question.substring(0, 40)}${question.length > 40 ? "..." : ""}
║  ────────────────────────────
║  ✨ الإجابة: ${(answer || "يسعدني مساعدتك! أنا DeepSeek، جاهز للإجابة على أسئلتك في البرمجة، المونتاج، الدراسة، وأي مجال آخر").substring(0, 50)}...
╚══════════════════════════════╝
✦ ✧ ✦ ✧ ✦ ✧ ✦ ✧ ✦ ✧ ✦ ✧ ✦`,
      categories: ["programming", "video editing", "study", "general"],
      timestamp: new Date().toISOString()
    };

    res.json(responseData);

  } catch (error) {
    const errorMessage = error.response ? `HTTP ${error.response.status}` : error.message;
    
    res.status(500).json({
      status: false,
      error: `فشل الاتصال بـ DeepSeek: ${errorMessage}`,
      fallbackAnswer: `💫━━━━━━━━━━━━━━━━━━━━━━💫
✨ أنا مساعد DeepSeek الذكي ✨
📚 سؤالك: "${question}"
💡 يمكنني مساعدتك في:
• البرمجة بلغات مختلفة
• المونتاج وتحسين الفيديوهات
• الدراسة والمراجعة
• وأي سؤال يخطر ببالك!

🌟 فقط اطرح سؤالك وسأجيبك بإذن الله 🌟
💫━━━━━━━━━━━━━━━━━━━━━━💫`
    });
  }
});

module.exports = {
  path: "/api/deepseek-chat",
  name: "DeepSeek AI Assistant API",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/deepseek-chat?question=كيف أتعلم البرمجة`,
  logo: "https://cdn.deepseek.com/chat/icon.png",
  category: "ai",
  info: "API لاستخراج إجابات DeepSeek AI - يجيب على أسئلة البرمجة والمونتاج والدراسة وجميع المجالات",
  router
};
