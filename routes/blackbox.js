const express = require("express");
const axios = require("axios");

const router = express.Router();

class BlackboxAIHelper {
static getHeaders() {
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive"
  };
}

static async ask(question) {
  const url = `https://takamura.site/api/ai/blackbox?question=${encodeURIComponent(question)}`;
  
  const { data } = await axios.get(url, {
    headers: this.getHeaders(),
    timeout: 60000
  });

  if (!data || !data.answer) {
    throw new Error("No answer received from Blackbox AI");
  }

  return {
    question: question,
    answer: data.answer,
    timestamp: new Date().toISOString()
  };
}
}

router.get("/ask", async (req, res) => {
try {
  const { q, question } = req.query;
  const userQuestion = q || question;

  if (!userQuestion) {
    return res.status(400).json({
      status: false,
      error: "Missing required parameter: q or question",
      example: "/api/blackbox/ask?q=hi or /api/blackbox/ask?question=hi"
    });
  }

  const result = await BlackboxAIHelper.ask(userQuestion);

  return res.status(200).json({
    status: true,
    question: result.question,
    answer: result.answer,
    timestamp: result.timestamp
  });

} catch (error) {
  console.error("Blackbox AI Error:", error.message);
  return res.status(500).json({
    status: false,
    error: error.message || "Internal server error"
  });
}
});

router.post("/ask", async (req, res) => {
try {
  const { q, question } = req.body;
  const userQuestion = q || question;

  if (!userQuestion) {
    return res.status(400).json({
      status: false,
      error: "Missing required parameter: q or question",
      example: "POST /api/blackbox/ask with body: { \"q\": \"hi\" }"
    });
  }

  const result = await BlackboxAIHelper.ask(userQuestion);

  return res.status(200).json({
    status: true,
    question: result.question,
    answer: result.answer,
    timestamp: result.timestamp
  });

} catch (error) {
  console.error("Blackbox AI Error:", error.message);
  return res.status(500).json({
    status: false,
    error: error.message || "Internal server error"
  });
}
});

module.exports = {
path: "/api/blackbox",
name: "Blackbox AI",
type: "get",
url: `${global.t || "http://localhost:3000"}/api/blackbox/ask?q=hi`,
logo: "https://www.blackbox.ai/favicon.ico",
category: "ai",
info: "Chat with Blackbox AI via Takamura API",
router
};

