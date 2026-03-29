const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const router = express.Router();

class KimiAI {
  constructor(baseURL) {
    console.log("[INIT] Initializing KimiAI Client...");
    
    this.BASE_URL = baseURL || "https://www.kimi.com/api";
    this.accessToken = null;
    this.refreshToken = null;
    this.deviceId = this.generateRandomId();
    this.sessionId = this.generateRandomId();
    this.trafficId = this.deviceId;
    
    const randomVersion = Math.floor(Math.random() * 10) + 125;
    
    this._axiosInstance = axios.create({
      baseURL: this.BASE_URL,
      timeout: 120000,
      headers: {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "id-ID,id;q=0.9",
        "Content-Type": "application/json",
        "Origin": "https://www.kimi.com",
        "R-Timezone": "Asia/Makassar",
        "Sec-CH-UA": `"Lemur";v="${randomVersion}", "Not A(Brand";v="99", "Microsoft Edge";v="${randomVersion}"`,
        "Sec-CH-UA-Mobile": "?1",
        "Sec-CH-UA-Platform": '"Android"',
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "User-Agent": `Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${randomVersion}.0.0.0 Mobile Safari/537.36`,
        "X-Language": "zh-CN",
        "X-Msh-Device-Id": this.deviceId,
        "X-Msh-Platform": "web",
        "X-Msh-Session-Id": this.sessionId,
        "X-Traffic-Id": this.trafficId,
        "Connection": "keep-alive",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache"
      }
    });

    // Intercepteur pour ajouter le token d'authentification
    this._axiosInstance.interceptors.request.use(
      config => {
        if (this.accessToken) {
          config.headers["Authorization"] = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      error => Promise.reject(error)
    );

    console.log("[INIT] KimiAI Client initialized successfully.");
  }

  generateRandomId(length = 19) {
    return String(Math.floor(Math.random() * Math.pow(10, length))).padStart(length, "0");
  }

  parseStream(streamData) {
    if (!streamData || typeof streamData !== "string") return [];
    
    return streamData
      .split("\n")
      .filter(line => line.startsWith("data:"))
      .map(line => line.slice(5).trim())
      .filter(line => line && line !== "[DONE]")
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          return null;
        }
      })
      .filter(obj => obj !== null);
  }

  async _ensureAuth() {
    if (!this.accessToken) {
      console.log("[AUTH] Token not found, ensuring authentication...");
      await this.registerDevice();
    }
  }

  async registerDevice() {
    console.log("[START] Registering new device...");
    try {
      const response = await this._axiosInstance.post("/device/register", {});
      
      this.accessToken = response.data?.access_token;
      this.refreshToken = response.data?.refresh_token;
      
      if (!this.accessToken) {
        throw new Error("No access token received from device registration");
      }
      
      console.log("[SUCCESS] Device registered successfully.");
      return response.data;
    } catch (error) {
      console.error("[FAIL] Error during device registration:", error.message);
      throw new Error(`Device registration failed: ${error.message}`);
    }
  }

  async _poll(apiCallFunction, validationFunction, callName, maxRetries = 10, delay = 1500) {
    console.log(`[POLL START] Starting polling for: ${callName}`);
    
    let retries = 0;
    while (retries < maxRetries) {
      try {
        const response = await apiCallFunction();
        if (validationFunction(response.data)) {
          console.log(`[POLL SUCCESS] Validation passed for ${callName} on attempt ${retries + 1}.`);
          return response.data;
        }
      } catch (error) {
        console.error(`[POLL FAIL] Attempt ${retries + 1} for ${callName} failed: ${error.message}`);
      }
      
      retries++;
      if (retries < maxRetries) {
        console.log(`[POLL RETRY] Retrying ${callName} in ${delay / 1000}s... (${retries}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    console.warn(`[POLL TIMEOUT] Polling for ${callName} timed out after ${maxRetries} retries.`);
    return null;
  }

  async getSuggestions(payload) {
    console.log("[START] getSuggestions with payload:", payload);
    try {
      await this._ensureAuth();
      
      const apiCall = () => this._axiosInstance.post("/suggestion", payload);
      const validator = data => data && data.items && data.items.length > 0;
      
      const result = await this._poll(apiCall, validator, "getSuggestions");
      console.log("[SUCCESS] getSuggestions completed.");
      return result;
    } catch (error) {
      console.error("[FAIL] Error in getSuggestions:", error.message);
      throw error;
    }
  }

  async listChats(payload, chatIdToFind) {
    console.log(`[START] listChats to find ID: ${chatIdToFind}`);
    try {
      await this._ensureAuth();
      
      const apiCall = () => this._axiosInstance.post("/chat/list", payload);
      const validator = data => data && data.items && data.items.some(item => item.id === chatIdToFind);
      
      const result = await this._poll(apiCall, validator, `listChats for ${chatIdToFind}`);
      console.log("[SUCCESS] listChats completed.");
      return result;
    } catch (error) {
      console.error("[FAIL] Error in listChats:", error.message);
      throw error;
    }
  }

  async getChatHistory(chatId, payload) {
    console.log(`[START] getChatHistory for chat ID: ${chatId}`);
    try {
      await this._ensureAuth();
      
      const apiCall = () => this._axiosInstance.post(`/chat/${chatId}/segment/scroll`, payload);
      const validator = data => data && data.items && data.items.length >= 2;
      
      const result = await this._poll(apiCall, validator, `getChatHistory for ${chatId}`);
      console.log("[SUCCESS] getChatHistory completed.");
      return result;
    } catch (error) {
      console.error("[FAIL] Error in getChatHistory:", error.message);
      throw error;
    }
  }

  async chat({ prompt, messages, useSearch = true, model = "kimi", ...rest }) {
    console.log(`[START] chat process with prompt: "${prompt?.substring(0, 50)}..."`);
    
    try {
      await this._ensureAuth();
      
      console.log("[PROCESS] 1. Creating chat session...");
      const createChatResponse = await this._axiosInstance.post("/chat", {
        name: "Untitled Session",
        born_from: "home",
        kimiplus_id: "kimi",
        is_example: false,
        source: "web",
        tags: []
      });
      
      const chatId = createChatResponse.data?.id;
      const chatInfo = createChatResponse.data;
      
      if (!chatId) {
        throw new Error("Failed to create chat session: No chat ID received");
      }
      
      console.log(`[PROCESS] Chat created with ID: ${chatId}`);
      
      const messagesToSend = messages && messages.length > 0 
        ? messages 
        : [{ role: "user", content: prompt }];
      
      const completionPayload = {
        kimiplus_id: "kimi",
        model: model,
        use_search: useSearch,
        refs: [],
        history: [],
        scene_labels: [],
        use_semantic_memory: false,
        ...rest,
        messages: messagesToSend
      };
      
      console.log("[PROCESS] 2. Executing parallel calls: Stream, List Chats, Suggestions...");
      
      const [streamResponse, chatList, suggestions] = await Promise.all([
        this._axiosInstance.post(
          `/chat/${chatId}/completion/stream`,
          completionPayload,
          {
            headers: {
              "Referer": `https://www.kimi.com/chat/${chatId}`
            },
            responseType: "text"
          }
        ).catch(e => {
          console.error("--> Sub-process 'Stream' failed:", e.message);
          return null;
        }),
        
        this.listChats({ offset: 0, size: 5 }, chatId).catch(e => {
          console.error("--> Sub-process 'ListChats' failed:", e.message);
          return null;
        }),
        
        this.getSuggestions({ query: prompt, scene: "first_round" }).catch(e => {
          console.error("--> Sub-process 'GetSuggestions' failed:", e.message);
          return null;
        })
      ]);
      
      if (!streamResponse) {
        throw new Error("Main chat stream failed to execute, process aborted.");
      }
      
      console.log("[PROCESS] 3. Main chat stream completed.");
      
      const allEvents = this.parseStream(streamResponse.data);
      const resultText = allEvents
        .filter(obj => obj && obj.event === "cmpl" && obj.text)
        .map(obj => obj.text)
        .join("");
      
      console.log("[PROCESS] 4. Finding group_id from stream...");
      const eventWithGroupId = allEvents.find(e => e && e.group_id);
      const groupId = eventWithGroupId ? eventWithGroupId.group_id : null;
      
      let chatHistory = null;
      let recommendedPrompts = null;
      
      if (groupId) {
        console.log(`[PROCESS] 5. Found group_id: ${groupId}. Getting history and recommendations...`);
        
        const [historyResult, recommendedResult] = await Promise.all([
          this.getChatHistory(chatId, { last: 10 }).catch(e => {
            console.error("--> Sub-process 'GetHistory' failed:", e.message);
            return null;
          }),
          
          this._axiosInstance.post(
            "/chat/recommend-prompt",
            {
              chat_id: chatId,
              group_id: groupId,
              use_search: useSearch
            },
            { responseType: "text" }
          )
            .then(res => this.parseStream(res.data))
            .catch(e => {
              console.error("--> Sub-process 'GetRecommendations' failed:", e.message);
              return null;
            })
        ]);
        
        chatHistory = historyResult;
        recommendedPrompts = recommendedResult;
      } else {
        console.warn("[PROCESS] Could not find group_id in stream, skipping history and recommendations.");
      }
      
      console.log("[PROCESS] 6. Assembling final result...");
      
      return {
        status: true,
        chatId: chatId,
        chatInfo: chatInfo,
        result: resultText,
        allEvents: allEvents,
        chatList: chatList,
        suggestions: suggestions,
        chatHistory: chatHistory,
        recommendedPrompts: recommendedPrompts,
        groupId: groupId,
        metadata: {
          totalEvents: allEvents.length,
          hasGroupId: !!groupId,
          hasHistory: !!chatHistory,
          hasRecommendations: !!recommendedPrompts,
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      console.error("[FAIL] Critical error in chat process:", error.message);
      throw error;
    }
  }
}

// Endpoint GET /chat
router.get("/chat", async (req, res) => {
  try {
    const { 
      prompt, 
      messages,
      useSearch,
      model,
      useSemanticMemory,
      sceneLabels,
      refs
    } = req.query;

    // Validation du prompt
    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'prompt' is required",
        example: `${global.t || "http://localhost:3000"}/api/kimi/chat?prompt=Hello%20world`,
        usage: "Provide a text prompt for AI chat response",
        optionalParams: {
          useSearch: "Enable web search (true/false)",
          model: "Model to use (default: kimi)",
          messages: "JSON array of previous messages"
        }
      });
    }

    // Validation de la longueur du prompt
    if (prompt.length > 10000) {
      return res.status(400).json({
        status: false,
        error: "Prompt too long (max 10000 characters)"
      });
    }

    const kimi = new KimiAI();
    
    const options = {
      prompt: prompt.trim(),
      useSearch: useSearch !== "false" && useSearch !== "0",
      model: model || "kimi"
    };

    // Parser les messages si fournis
    if (messages) {
      try {
        const parsedMessages = JSON.parse(messages);
        if (Array.isArray(parsedMessages)) {
          options.messages = parsedMessages;
        }
      } catch (e) {
        console.warn("Failed to parse messages parameter:", e.message);
      }
    }

    // Ajouter les paramètres optionnels
    if (useSemanticMemory) options.use_semantic_memory = useSemanticMemory === "true";
    if (sceneLabels) {
      try {
        options.scene_labels = JSON.parse(sceneLabels);
      } catch (e) {
        options.scene_labels = sceneLabels.split(",");
      }
    }
    if (refs) {
      try {
        options.refs = JSON.parse(refs);
      } catch (e) {
        options.refs = [];
      }
    }

    const response = await kimi.chat(options);

    return res.status(200).json(response);

  } catch (error) {
    console.error("Kimi AI API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error",
      message: "Failed to generate chat response from Kimi AI"
    });
  }
});

// Endpoint POST /chat (pour les prompts longs ou conversations complexes)
router.post("/chat", async (req, res) => {
  try {
    const { 
      prompt, 
      messages,
      useSearch = true,
      model = "kimi",
      useSemanticMemory = false,
      sceneLabels = [],
      refs = [],
      ...additionalParams
    } = req.body;

    // Validation du prompt ou messages
    if ((!prompt || prompt.trim().length === 0) && (!messages || !Array.isArray(messages) || messages.length === 0)) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'prompt' or 'messages' array is required",
        example: {
          prompt: "Hello world",
          useSearch: true,
          model: "kimi",
          messages: [
            { role: "user", content: "Hello" },
            { role: "assistant", content: "Hi there!" }
          ]
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

    const kimi = new KimiAI();
    
    const options = {
      prompt: prompt?.trim(),
      messages: messages,
      useSearch: useSearch === true || useSearch === "true",
      model: model,
      useSemanticMemory: useSemanticMemory === true || useSemanticMemory === "true",
      sceneLabels: sceneLabels,
      refs: refs,
      ...additionalParams
    };

    const response = await kimi.chat(options);

    return res.status(200).json(response);

  } catch (error) {
    console.error("Kimi AI API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error",
      message: "Failed to generate chat response from Kimi AI"
    });
  }
});

// Endpoint GET /suggestions (obtenir des suggestions de prompts)
router.get("/suggestions", async (req, res) => {
  try {
    const { query, scene = "first_round" } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'query' is required",
        example: `${global.t || "http://localhost:3000"}/api/kimi/suggestions?query=programming`
      });
    }

    const kimi = new KimiAI();
    const suggestions = await kimi.getSuggestions({ query: query.trim(), scene });

    return res.status(200).json({
      status: true,
      data: suggestions
    });

  } catch (error) {
    console.error("Kimi Suggestions API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error"
    });
  }
});

module.exports = {
  path: "/api/kimi",
  name: "Kimi AI Chat",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/kimi/chat?prompt=Hello%20world`,
  logo: "https://www.kimi.com/favicon.ico",
  category: "tools",
  info: "Advanced AI chat powered by Kimi with web search, semantic memory, and conversation history support",
  router
};

