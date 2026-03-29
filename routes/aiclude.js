const express = require("express");
const axios = require("axios");

const router = express.Router();

class AcloudAI {
  constructor() {
    this.baseURL = "https://api.acloudapp.com/v1/completions";
    this.apiKey = "sk-9jL26pavtzAHk9mdF0A5AeAfFcE1480b9b06737d9eC62c1e";
    this.defaultHeaders = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${this.apiKey}`,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Origin": "https://api.acloudapp.com",
      "Referer": "https://api.acloudapp.com/",
      "Connection": "keep-alive",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache"
    };
  }

  async chat(inputText, options = {}) {
    try {
      const payload = {
        model: options.model || "gemini-pro",
        messages: options.messages || [{
          role: "user",
          content: inputText
        }],
        temperature: options.temperature || 0.9,
        top_p: options.top_p || 0.7,
        top_k: options.top_k || 40
      };

      // Validation des entrées
      if (!payload.messages || payload.messages.length === 0) {
        throw new Error("Missing messages input payload");
      }

      if (!Array.isArray(payload.messages)) {
        throw new Error("Invalid array in messages input payload");
      }

      if (isNaN(payload.top_p) || payload.top_p < 0 || payload.top_p > 1) {
        throw new Error("Invalid number in top_p payload (must be between 0 and 1)");
      }

      if (isNaN(payload.top_k) || payload.top_k < 0) {
        throw new Error("Invalid number in top_k payload (must be positive)");
      }

      if (isNaN(payload.temperature) || payload.temperature < 0 || payload.temperature > 2) {
        throw new Error("Invalid temperature value (must be between 0 and 2)");
      }

      const response = await axios.post(this.baseURL, payload, {
        headers: this.defaultHeaders,
        timeout: 60000,
        responseType: "json"
      });

      const data = response.data;

      if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
        throw new Error("Failed to get response message from API");
      }

      return {
        status: true,
        answer: data.choices[0].message.content,
        model: data.model || payload.model,
        usage: data.usage || null,
        finishReason: data.choices[0].finish_reason || null,
        metadata: {
          temperature: payload.temperature,
          top_p: payload.top_p,
          top_k: payload.top_k,
          totalTokens: data.usage?.total_tokens || null,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error("AcloudAI Error:", error.message);
      
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.error?.message || error.response.data?.message || error.message;
        
        if (status === 401) {
          throw new Error(`Authentication failed: ${message}`);
        } else if (status === 429) {
          throw new Error(`Rate limit exceeded: ${message}`);
        } else if (status >= 500) {
          throw new Error(`API server error (${status}): ${message}`);
        } else {
          throw new Error(`API error (${status}): ${message}`);
        }
      } else if (error.request) {
        throw new Error("No response received from API server");
      } else {
        throw new Error(error.message || "Unknown error occurred");
      }
    }
  }
}

// Endpoint GET /chat
router.get("/chat", async (req, res) => {
  try {
    const { 
      prompt, 
      model,
      temperature,
      top_p,
      top_k,
      messages
    } = req.query;

    // Validation du prompt
    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'prompt' is required",
        example: `${global.t || "http://localhost:3000"}/api/acloud/chat?prompt=Hello%20world`,
        usage: "Provide a text prompt for AI response",
        optionalParams: {
          model: "Model to use (default: gemini-pro)",
          temperature: "Sampling temperature (0-2, default: 0.9)",
          top_p: "Nucleus sampling (0-1, default: 0.7)",
          top_k: "Top-k sampling (default: 40)",
          messages: "JSON array of conversation messages"
        }
      });
    }

    // Validation de la longueur du prompt
    if (prompt.length > 8000) {
      return res.status(400).json({
        status: false,
        error: "Prompt too long (max 8000 characters)"
      });
    }

    const acloud = new AcloudAI();
    
    const options = {
      model: model || "gemini-pro",
      temperature: temperature ? parseFloat(temperature) : 0.9,
      top_p: top_p ? parseFloat(top_p) : 0.7,
      top_k: top_k ? parseInt(top_k) : 40
    };

    // Parser les messages si fournis
    if (messages) {
      try {
        const parsedMessages = JSON.parse(messages);
        if (Array.isArray(parsedMessages) && parsedMessages.length > 0) {
          options.messages = parsedMessages;
        }
      } catch (e) {
        return res.status(400).json({
          status: false,
          error: "Invalid JSON in 'messages' parameter",
          example: '[{"role":"user","content":"Hello"},{"role":"assistant","content":"Hi!"}]'
        });
      }
    }

    const result = await acloud.chat(prompt.trim(), options);

    return res.status(200).json(result);

  } catch (error) {
    console.error("Acloud API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error",
      message: "Failed to generate AI response"
    });
  }
});

// Endpoint POST /chat (pour les prompts longs ou paramètres complexes)
router.post("/chat", async (req, res) => {
  try {
    const { 
      prompt,
      messages,
      model = "gemini-pro",
      temperature = 0.9,
      top_p = 0.7,
      top_k = 40
    } = req.body;

    // Validation du prompt ou messages
    if ((!prompt || prompt.trim().length === 0) && (!messages || !Array.isArray(messages) || messages.length === 0)) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'prompt' or 'messages' array is required",
        example: {
          prompt: "Hello world",
          model: "gemini-pro",
          temperature: 0.9,
          top_p: 0.7,
          top_k: 40,
          messages: [
            { role: "user", content: "Hello" }
          ]
        }
      });
    }

    // Validation de la longueur
    if (prompt && prompt.length > 8000) {
      return res.status(400).json({
        status: false,
        error: "Prompt too long (max 8000 characters)"
      });
    }

    // Validation des paramètres numériques
    const tempNum = parseFloat(temperature);
    const topPNum = parseFloat(top_p);
    const topKNum = parseInt(top_k);

    if (isNaN(tempNum) || tempNum < 0 || tempNum > 2) {
      return res.status(400).json({
        status: false,
        error: "Invalid temperature value (must be between 0 and 2)"
      });
    }

    if (isNaN(topPNum) || topPNum < 0 || topPNum > 1) {
      return res.status(400).json({
        status: false,
        error: "Invalid top_p value (must be between 0 and 1)"
      });
    }

    if (isNaN(topKNum) || topKNum < 0) {
      return res.status(400).json({
        status: false,
        error: "Invalid top_k value (must be positive)"
      });
    }

    const acloud = new AcloudAI();
    
    const options = {
      model: model,
      temperature: tempNum,
      top_p: topPNum,
      top_k: topKNum,
      messages: messages
    };

    const result = await acloud.chat(prompt?.trim(), options);

    return res.status(200).json(result);

  } catch (error) {
    console.error("Acloud API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error",
      message: "Failed to generate AI response"
    });
  }
});

// Endpoint GET /models (liste des modèles disponibles)
router.get("/models", async (req, res) => {
  return res.status(200).json({
    status: true,
    data: {
      models: [
        {
          id: "gemini-pro",
          name: "Gemini Pro",
          description: "Google's Gemini Pro model for general tasks",
          default: true
        }
      ],
      defaultParams: {
        temperature: 0.9,
        top_p: 0.7,
        top_k: 40
      }
    }
  });
});

module.exports = {
  path: "/api/acloud",
  name: "Acloud AI Chat",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/acloud/chat?prompt=Hello%20world`,
  logo: "https://api.acloudapp.com/favicon.ico",
  category: "tools",
  info: "AI chat API powered by Gemini Pro with configurable temperature, top_p and top_k sampling parameters",
  router
};

