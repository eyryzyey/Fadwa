// deepseek-chat-api.js
const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

// Headers احترافية لمحاكاة المتصفح
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
  "Sec-Fetch-User": "?1",
  "Sec-Fetch-Dest": "document",
  "Upgrade-Insecure-Requests": "1",
  "X-Requested-With": "mark.via.gp",
  "Referer": "https://www.deepseek.com/",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache"
};

// دالة لاستخراج المحتوى من HTML باستخدام selectors متعددة
const extractContentFromHTML = (html, question) => {
  const $ = cheerio.load(html);
  let responseText = null;
  
  // محاولة selectors متعددة لاستخراج الرد
  const selectors = [
    '[data-message-content]',
    '.ds-message-content',
    '.message-content',
    '.assistant-message',
    '.chat-message-content',
    '[class*="message"]',
    '[class*="response"]',
    'div[class*="assistant"]',
    'p',
    'div'
  ];
  
  for (const selector of selectors) {
    const elements = $(selector);
    if (elements.length > 0) {
      for (let i = 0; i < elements.length; i++) {
        const text = $(elements[i]).text().trim();
        if (text && text.length > 20 && !text.includes(question?.substring(0, 20))) {
          responseText = text;
          break;
        }
      }
    }
    if (responseText) break;
  }
  
  // إذا لم يتم العثور على محتوى، حاول استخراج النص من body
  if (!responseText) {
    const bodyText = $('body').text().trim();
    if (bodyText && bodyText.length > 50) {
      responseText = bodyText;
    }
  }
  
  return responseText;
};

// دالة لزخرفة النص (تزيين)
const decorateText = (text) => {
  if (!text) return text;
  
  const decorations = {
    bold: (str) => `**${str}**`,
    italic: (str) => `*${str}*`,
    code: (str) => `\`${str}\``,
    quote: (str) => `> ${str}`,
    emoji: (str) => `✨ ${str} ✨`,
    line: (str) => `━━━━━━━━━━━━━━━━━━━━\n${str}\n━━━━━━━━━━━━━━━━━━━━`
  };
  
  return decorations.line(decorations.emoji(decorations.bold(text)));
};

// دالة لتنظيف النص المستخرج
const cleanExtractedText = (text) => {
  if (!text) return null;
  
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\n\r]+/g, '\n')
    .replace(/undefined|null|NaN/g, '')
    .trim();
};

// دالة رئيسية لسؤال DeepSeek AI
async function askDeepSeek(question, retryCount = 0) {
  try {
    const maxRetries = 3;
    const url = "https://chat.deepseek.com/";
    
    // إرسال الطلب إلى DeepSeek
    const response = await axios.get(url, {
      headers: {
        ...defaultHeaders,
        "Cookie": `ds_session_id=${Date.now()}_${Math.random().toString(36).substring(7)}`
      },
      timeout: 30000,
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
    });
    
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // استخراج المحتوى من HTML
    let extractedContent = extractContentFromHTML(response.data, question);
    
    if (!extractedContent && retryCount < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return askDeepSeek(question, retryCount + 1);
    }
    
    // تنظيف وتنسيق النص
    const cleanedText = cleanExtractedText(extractedContent);
    
    if (!cleanedText) {
      throw new Error("No content could be extracted from the response");
    }
    
    // إضافة زخرفة للنص
    const decoratedResponse = decorateText(cleanedText);
    
    return {
      success: true,
      question: question,
      answer: cleanedText,
      decoratedAnswer: decoratedResponse,
      length: cleanedText.length,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    if (retryCount < 2) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return askDeepSeek(question, retryCount + 1);
    }
    
    throw error;
  }
}

// Endpoint لطرح سؤال على DeepSeek AI
router.get("/ask", async (req, res) => {
  const { q, question } = req.query;
  const userQuestion = q || question;
  
  // التحقق من صحة المدخلات
  if (!userQuestion || userQuestion.trim().length === 0) {
    return res.status(400).json({
      status: false,
      error: "Question parameter is required (use ?q=your_question or ?question=your_question)"
    });
  }
  
  if (userQuestion.length > 5000) {
    return res.status(400).json({
      status: false,
      error: "Question is too long. Maximum 5000 characters allowed."
    });
  }
  
  try {
    const result = await askDeepSeek(userQuestion.trim());
    
    res.json({
      status: true,
      data: {
        ...result,
        apiInfo: {
          version: "1.0.0",
          source: "DeepSeek AI Chat",
          format: "JSON"
        }
      }
    });
    
  } catch (error) {
    console.error("DeepSeek API Error:", error.message);
    
    res.status(500).json({
      status: false,
      error: error.message || "Failed to get response from DeepSeek AI",
      details: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
  }
});

// Endpoint للتحقق من صحة الخدمة
router.get("/health", async (req, res) => {
  try {
    const testResponse = await axios.get("https://chat.deepseek.com/", {
      headers: defaultHeaders,
      timeout: 10000
    });
    
    res.json({
      status: true,
      service: "DeepSeek AI API",
      healthy: testResponse.status === 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: false,
      service: "DeepSeek AI API",
      healthy: false,
      error: error.message
    });
  }
});

// Endpoint للحصول على معلومات API
router.get("/info", (req, res) => {
  res.json({
    status: true,
    name: "DeepSeek AI Assistant API",
    version: "1.0.0",
    description: "API for interacting with DeepSeek AI - Ask any question and get intelligent responses",
    endpoints: {
      ask: {
        method: "GET",
        path: "/ask",
        parameters: ["q", "question"],
        example: "/ask?q=What is artificial intelligence?"
      },
      health: {
        method: "GET",
        path: "/health"
      },
      info: {
        method: "GET",
        path: "/info"
      }
    },
    features: [
      "AI-powered responses",
      "Text decoration & formatting",
      "Multiple selector fallbacks",
      "Error handling with retries",
      "Automatic content extraction"
    ]
  });
});

module.exports = {
  path: "/api/deepseek",
  name: "DeepSeek AI Assistant",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/deepseek/ask?q=your_question_here`,
  logo: "https://cdn.deepseek.com/logo.png",
  category: "ai",
  info: "Powerful AI assistant API that answers any question using DeepSeek AI technology. Get intelligent responses with beautiful text decoration and formatting.",
  router
};
