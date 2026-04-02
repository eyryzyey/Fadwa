const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const cheerio = require("cheerio");

const router = express.Router();

const api = {
  base: "https://api.chatupai.org",
  endpoints: {
    completions: "/api/v1/completions"
  }
};

const headers = {
  "user-agent": "ChatUpAI-Client/1.3.0",
  "accept": "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  "content-type": "application/json",
  "origin": "https://api.chatupai.org",
  "referer": "https://api.chatupai.org/"
};

const sessions = new Map();
const config = { maxMessages: 100, expiry: 3 * 60 * 60 * 1000 };

function generateId() {
  return crypto.randomBytes(8).toString("hex");
}

function cleanupSessions() {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.lastActive > config.expiry) {
      sessions.delete(id);
    }
  }
}

async function chat({ input, sessionId = null }) {
  if (!input || typeof input !== "string") {
    return { success: false, error: { message: "Input message cannot be empty." } };
  }

  try {
    const currentSessionId = sessionId || generateId();
    const previousMessages = sessions.get(currentSessionId)?.messages || [];
    const messages = [...previousMessages, { role: "user", content: input }];

    const response = await axios.post(
      `${api.base}${api.endpoints.completions}`,
      { messages },
      { headers }
    );

    const content = response.data?.data?.content || "Sorry, I could not provide a response.";

    const assistantMessage = { role: "assistant", content, timestamp: Date.now() };
    const updatedMessages = [...messages, assistantMessage];

    sessions.set(currentSessionId, {
      messages: updatedMessages.slice(-config.maxMessages),
      lastActive: Date.now()
    });

    setTimeout(() => cleanupSessions(), 0);

    return { success: true, result: assistantMessage.content, sessionId: currentSessionId };
  } catch (e) {
    return { success: false, error: { message: e.message } };
  }
}

router.get("/chat", async (req, res) => {
  try {
    const { q, query, message, sessionId } = req.query;

    const inputMessage = q || query || message;

    if (!inputMessage || typeof inputMessage !== "string" || inputMessage.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Missing or invalid parameter: 'q', 'query', or 'message' is required",
        example: `${global.t || "http://localhost:3000"}/api/chatupai/chat?q=hello`
      });
    }

    const result = await chat({ input: inputMessage.trim(), sessionId: sessionId || null });

    if (!result.success) {
      return res.status(500).json({
        status: false,
        error: result.error?.message || "Failed to get response"
      });
    }

    return res.status(200).json({
      status: true,
      response: result.result,
      sessionId: result.sessionId
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message || "Internal server error"
    });
  }
});

module.exports = {
  path: "/api/chatupai",
  name: "ChatUp AI Chat",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/chatupai/chat?q=hello`,
  logo: "https://cdn-icons-png.flaticon.com/512/4712/4712035.png",
  category: "ai",
  info: "AI chatbot with session management",
  router
};

