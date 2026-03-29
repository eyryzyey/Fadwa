const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const router = express.Router();

// Fonction utilitaire pour fusionner les objets en profondeur
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

class BlackboxAI {
  constructor() {
    this.sessionId = crypto.randomUUID();
    this.csrfToken = null;
    this.baseURL = "https://www.blackbox.ai";
    this.defaultUserAgent = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
  }

  async getCsrfToken() {
    const headers = {
      "Accept": "*/*",
      "Accept-Language": "id-ID,id;q=0.9",
      "Content-Type": "application/json",
      "Cookie": `sessionId=${this.sessionId}`,
      "Referer": `${this.baseURL}/`,
      "Origin": this.baseURL,
      "Sec-CH-UA": '"Chromium";v="131", "Not_A Brand";v="24", "Microsoft Edge Simulate";v="131", "Lemur";v="131"',
      "Sec-CH-UA-Mobile": "?1",
      "Sec-CH-UA-Platform": '"Android"',
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      "User-Agent": this.defaultUserAgent,
      "Connection": "keep-alive",
      "Cache-Control": "no-cache"
    };

    try {
      const res = await axios.get(`${this.baseURL}/api/auth/csrf`, {
        headers: headers,
        timeout: 30000
      });
      
      this.csrfToken = res.data?.csrfToken;
      
      if (!this.csrfToken) {
        throw new Error("Failed to retrieve CSRF token from response");
      }
      
      return this.csrfToken;
    } catch (error) {
      throw new Error(`CSRF Token Error: ${error.message}`);
    }
  }

  async sendMessage(options = {}) {
    if (!this.csrfToken) {
      await this.getCsrfToken();
    }

    const headers = {
      ...this.defaultHeaders(),
      "Cookie": `sessionId=${this.sessionId}; __Host-authjs.csrf-token=${this.csrfToken}`
    };

    const defaultData = {
      messages: options.messages || [{
        role: "user",
        content: options.prompt || options.content || "",
        id: options.messageId || crypto.randomUUID().substring(0, 8)
      }],
      agentMode: {},
      id: crypto.randomUUID().substring(0, 8),
      previewToken: null,
      userId: null,
      codeModelMode: true,
      trendingAgentMode: {},
      isMicMode: false,
      userSystemPrompt: options.systemPrompt || null,
      maxTokens: options.maxTokens || 1024,
      playgroundTopP: options.topP || null,
      playgroundTemperature: options.temperature || null,
      isChromeExt: false,
      githubToken: options.githubToken || "",
      clickedAnswer2: false,
      clickedAnswer3: false,
      clickedForceWebSearch: false,
      visitFromDelta: false,
      isMemoryEnabled: options.memory || false,
      mobileClient: true,
      userSelectedModel: options.model || null,
      validated: "00f37b34-a166-4efb-bce5-1312d87f2f94",
      imageGenerationMode: options.imageGeneration || false,
      webSearchModePrompt: options.webSearch !== false,
      deepSearchMode: options.deepSearch || false,
      domains: options.domains || null,
      vscodeClient: false,
      codeInterpreterMode: options.codeInterpreter || false,
      customProfile: {
        name: options.profileName || "",
        occupation: options.profileOccupation || "",
        traits: options.profileTraits || [],
        additionalInfo: options.profileInfo || "",
        enableNewChats: false
      },
      session: null,
      isPremium: false,
      subscriptionCache: null,
      beastMode: options.beastMode || false,
      reasoningMode: options.reasoning || false
    };

    const data = deepMerge(defaultData, options);
    
    try {
      const res = await axios.post(`${this.baseURL}/api/chat`, data, {
        headers: headers,
        timeout: 120000,
        responseType: "text"
      });
      
      return {
        response: res.data,
        sessionId: this.sessionId,
        model: options.model || "default",
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        // Token expiré, réessayer une fois
        this.csrfToken = null;
        await this.getCsrfToken();
        return this.sendMessage(options);
      }
      throw new Error(`Chat API Error: ${error.message}`);
    }
  }

  defaultHeaders() {
    return {
      "Accept": "*/*",
      "Accept-Language": "id-ID,id;q=0.9",
      "Content-Type": "application/json",
      "Referer": `${this.baseURL}/`,
      "Origin": this.baseURL,
      "Sec-CH-UA": '"Chromium";v="131", "Not_A Brand";v="24", "Microsoft Edge Simulate";v="131", "Lemur";v="131"',
      "Sec-CH-UA-Mobile": "?1",
      "Sec-CH-UA-Platform": '"Android"',
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      "User-Agent": this.defaultUserAgent,
      "Connection": "keep-alive"
    };
  }
}

// Endpoint GET /chat
router.get("/chat", async (req, res) => {
  try {
    const { 
      prompt, 
      messageId, 
      model, 
      temperature, 
      maxTokens,
      webSearch,
      memory,
      systemPrompt,
      imageGeneration,
      deepSearch,
      codeInterpreter,
      beastMode,
      reasoning
    } = req.query;

    // Validation du prompt
    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'prompt' is required",
        example: `${global.t || "http://localhost:3000"}/api/blackbox/chat?prompt=Hello%20world`,
        usage: "Provide a text prompt to generate AI response"
      });
    }

    // Validation de la longueur du prompt
    if (prompt.length > 10000) {
      return res.status(400).json({
        status: false,
        error: "Prompt too long (max 10000 characters)"
      });
    }

    const ai = new BlackboxAI();
    
    const options = {
      prompt: prompt.trim(),
      messageId: messageId || undefined,
      model: model || undefined,
      temperature: temperature ? parseFloat(temperature) : undefined,
      maxTokens: maxTokens ? parseInt(maxTokens) : undefined,
      webSearch: webSearch === "true" || webSearch === "1",
      memory: memory === "true" || memory === "1",
      systemPrompt: systemPrompt || undefined,
      imageGeneration: imageGeneration === "true" || imageGeneration === "1",
      deepSearch: deepSearch === "true" || deepSearch === "1",
      codeInterpreter: codeInterpreter === "true" || codeInterpreter === "1",
      beastMode: beastMode === "true" || beastMode === "1",
      reasoning: reasoning === "true" || reasoning === "1"
    };

    const result = await ai.sendMessage(options);

    return res.status(200).json({
      status: true,
      data: result
    });

  } catch (error) {
    console.error("Blackbox AI Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error",
      message: "Failed to generate AI response"
    });
  }
});

// Endpoint POST /chat (pour les prompts longs ou complexes)
router.post("/chat", async (req, res) => {
  try {
    const { 
      prompt, 
      messages,
      messageId, 
      model, 
      temperature, 
      maxTokens,
      webSearch,
      memory,
      systemPrompt,
      imageGeneration,
      deepSearch,
      codeInterpreter,
      beastMode,
      reasoning,
      profileName,
      profileOccupation,
      profileTraits,
      profileInfo
    } = req.body;

    // Validation du prompt ou messages
    if ((!prompt || prompt.trim().length === 0) && (!messages || !Array.isArray(messages))) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'prompt' or 'messages' array is required",
        example: {
          prompt: "Hello world",
          model: "default",
          temperature: 0.7
        }
      });
    }

    // Validation de la longueur
    if (prompt && prompt.length > 10000) {
      return res.status(400).json({
        status: false,
        error: "Prompt too long (max 10000 characters)"
      });
    }

    const ai = new BlackboxAI();
    
    const options = {
      prompt: prompt?.trim(),
      messages: messages || undefined,
      messageId: messageId || undefined,
      model: model || undefined,
      temperature: temperature ? parseFloat(temperature) : undefined,
      maxTokens: maxTokens ? parseInt(maxTokens) : undefined,
      webSearch: webSearch === true || webSearch === "true",
      memory: memory === true || memory === "true",
      systemPrompt: systemPrompt || undefined,
      imageGeneration: imageGeneration === true || imageGeneration === "true",
      deepSearch: deepSearch === true || deepSearch === "true",
      codeInterpreter: codeInterpreter === true || codeInterpreter === "true",
      beastMode: beastMode === true || beastMode === "true",
      reasoning: reasoning === true || reasoning === "true",
      profileName: profileName || undefined,
      profileOccupation: profileOccupation || undefined,
      profileTraits: profileTraits || undefined,
      profileInfo: profileInfo || undefined
    };

    const result = await ai.sendMessage(options);

    return res.status(200).json({
      status: true,
      data: result
    });

  } catch (error) {
    console.error("Blackbox AI Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error",
      message: "Failed to generate AI response"
    });
  }
});

// Endpoint POST /chat/stream pour le streaming (optionnel)
router.post("/chat/stream", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'prompt' is required"
      });
    }

    // Configuration pour le streaming
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const ai = new BlackboxAI();
    
    // Note: Le streaming nécessiterait une modification de la classe pour supporter les streams
    // Cet endpoint retourne la réponse complète pour l'instant
    const result = await ai.sendMessage({ prompt: prompt.trim() });
    
    res.write(`data: ${JSON.stringify({ status: true, data: result })}\n\n`);
    res.end();

  } catch (error) {
    res.write(`data: ${JSON.stringify({ status: false, error: error.message })}\n\n`);
    res.end();
  }
});

module.exports = {
  path: "/api/blackbox",
  name: "Blackbox AI Chat",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/blackbox/chat?prompt=Hello%20world`,
  logo: "https://www.blackbox.ai/favicon.ico",
  category: "tools",
  info: "Advanced AI chat API powered by Blackbox AI with support for code generation, web search, and multiple AI models",
  router
};

