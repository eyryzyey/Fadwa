const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const router = express.Router();

class ChatAI {
  constructor() {
    this.baseURL = "http://api.chatai.click/v1/chat2";
    this.headers = {
      "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 14; RMX3890 Build/UKQ1.230917.001)",
      "Connection": "Keep-Alive",
      "Accept-Encoding": "gzip",
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache"
    };
    this.templates = {
      1: "653b5fd1003600001b005769",
      2: "653b5fe4003600001b005773",
      3: "653b5fd5003600001b00576c"
    };
  }

  genId() {
    return Math.floor(1e14 + Math.random() * 9e14).toString();
  }

  async chat({ prompt, template = 1, ...rest }) {
    try {
      const templateId = this.templates[template] || this.templates[1];
      
      const data = new URLSearchParams();
      data.append("chatModel", "3");
      data.append("p2", prompt);
      data.append("phoneId", this.genId());
      data.append("messageId", this.genId());
      data.append("packageName", "com.demo.aigirlfriend");
      data.append("templateId", templateId);
      data.append("message", prompt);
      
      // Ajouter les paramètres supplémentaires
      Object.keys(rest).forEach(key => {
        if (rest[key] !== undefined && rest[key] !== null) {
          data.append(key, rest[key]);
        }
      });

      const response = await axios.post(
        `${this.baseURL}/chatTemplate`,
        data.toString(),
        {
          headers: this.headers,
          timeout: 60000,
          responseType: "text",
          decompress: true
        }
      );

      return this.parseResponse(response.data);
    } catch (error) {
      console.error("Chat error:", error.message);
      throw new Error(`Chat API request failed: ${error.message}`);
    }
  }

  parseResponse(responseData) {
    // Réponse déjà formatée en JSON
    if (typeof responseData === "object" && !Array.isArray(responseData)) {
      return {
        status: true,
        result: responseData?.result || responseData?.content || JSON.stringify(responseData),
        metadata: {
          raw: responseData,
          type: "json_object",
          timestamp: new Date().toISOString()
        }
      };
    }

    // Réponse en format SSE (Server-Sent Events) stream
    if (typeof responseData === "string" && responseData.includes("data: {")) {
      const result = {
        content: "",
        id: "",
        model: "",
        created: 0,
        service_tier: "",
        system_fingerprint: null,
        finish_reason: null,
        role: "",
        obfuscation: [],
        chunks: []
      };

      let position = 0;
      
      while (position < responseData.length) {
        const dataStart = responseData.indexOf("data: {", position);
        if (dataStart === -1) break;

        let braceCount = 0;
        let jsonEnd = -1;
        
        for (let i = dataStart + 6; i < responseData.length; i++) {
          if (responseData[i] === "{") braceCount++;
          if (responseData[i] === "}") {
            braceCount--;
            if (braceCount === 0) {
              jsonEnd = i + 1;
              break;
            }
          }
        }

        if (jsonEnd === -1) break;

        const jsonStr = responseData.substring(dataStart + 6, jsonEnd);
        
        try {
          const chunk = JSON.parse(jsonStr);
          result.chunks.push(chunk);
          
          // Extraction des métadonnées
          result.id = result.id || chunk?.id || "";
          result.model = result.model || chunk?.model || "";
          result.created = result.created || chunk?.created || 0;
          result.service_tier = result.service_tier || chunk?.service_tier || "";
          result.system_fingerprint = result.system_fingerprint || chunk?.system_fingerprint || null;
          
          // Extraction du contenu
          const content = chunk?.choices?.[0]?.delta?.content;
          if (content) {
            result.content += content;
          }
          
          // Extraction du rôle
          const role = chunk?.choices?.[0]?.delta?.role;
          if (role && !result.role) {
            result.role = role;
          }
          
          // Extraction du finish_reason
          const finishReason = chunk?.choices?.[0]?.finish_reason;
          if (finishReason) {
            result.finish_reason = finishReason;
          }
          
          // Extraction de l'obfuscation
          const obfuscation = chunk?.obfuscation;
          if (obfuscation) {
            result.obfuscation.push(obfuscation);
          }
          
        } catch (e) {
          // Ignorer les chunks malformés
        }
        
        position = jsonEnd;
      }

      return {
        status: true,
        result: result.content,
        metadata: {
          id: result.id,
          model: result.model,
          created: result.created,
          service_tier: result.service_tier,
          system_fingerprint: result.system_fingerprint,
          finish_reason: result.finish_reason,
          role: result.role,
          obfuscation: result.obfuscation,
          total_chunks: result.chunks.length,
          type: "sse_stream",
          timestamp: new Date().toISOString()
        }
      };
    }

    // Réponse texte simple ou autre format
    return {
      status: true,
      result: typeof responseData === "string" ? responseData : JSON.stringify(responseData),
      metadata: {
        raw: responseData,
        type: typeof responseData,
        timestamp: new Date().toISOString()
      }
    };
  }
}

// Endpoint GET /chat
router.get("/chat", async (req, res) => {
  try {
    const { 
      prompt, 
      template = 1,
      chatModel,
      phoneId,
      messageId,
      packageName
    } = req.query;

    // Validation du prompt
    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'prompt' is required",
        example: `${global.t || "http://localhost:3000"}/api/chatai/chat?prompt=Hello%20world&template=1`,
        usage: "Provide a text prompt for AI chat response",
        availableTemplates: {
          1: "Default (653b5fd1003600001b005769)",
          2: "Alternative 1 (653b5fe4003600001b005773)",
          3: "Alternative 2 (653b5fd5003600001b00576c)"
        }
      });
    }

    // Validation du template
    const templateNum = parseInt(template);
    if (![1, 2, 3].includes(templateNum)) {
      return res.status(400).json({
        status: false,
        error: "Invalid template ID",
        availableTemplates: [1, 2, 3],
        default: 1
      });
    }

    // Validation de la longueur du prompt
    if (prompt.length > 5000) {
      return res.status(400).json({
        status: false,
        error: "Prompt too long (max 5000 characters)"
      });
    }

    const chat = new ChatAI();
    
    const options = {
      prompt: prompt.trim(),
      template: templateNum
    };

    // Ajouter les paramètres optionnels s'ils sont fournis
    if (chatModel) options.chatModel = chatModel;
    if (phoneId) options.phoneId = phoneId;
    if (messageId) options.messageId = messageId;
    if (packageName) options.packageName = packageName;

    const response = await chat.chat(options);

    return res.status(200).json(response);

  } catch (error) {
    console.error("ChatAI API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error",
      message: "Failed to generate chat response"
    });
  }
});

// Endpoint POST /chat (pour les prompts longs ou paramètres complexes)
router.post("/chat", async (req, res) => {
  try {
    const { 
      prompt, 
      template = 1,
      chatModel,
      phoneId,
      messageId,
      packageName,
      ...additionalParams
    } = req.body;

    // Validation du prompt
    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'prompt' is required in request body",
        example: {
          prompt: "Hello world",
          template: 1,
          chatModel: "3"
        }
      });
    }

    // Validation du template
    const templateNum = parseInt(template);
    if (![1, 2, 3].includes(templateNum)) {
      return res.status(400).json({
        status: false,
        error: "Invalid template ID",
        availableTemplates: [1, 2, 3]
      });
    }

    // Validation de la longueur
    if (prompt.length > 5000) {
      return res.status(400).json({
        status: false,
        error: "Prompt too long (max 5000 characters)"
      });
    }

    const chat = new ChatAI();
    
    const options = {
      prompt: prompt.trim(),
      template: templateNum
    };

    // Ajouter les paramètres optionnels
    if (chatModel) options.chatModel = chatModel;
    if (phoneId) options.phoneId = phoneId;
    if (messageId) options.messageId = messageId;
    if (packageName) options.packageName = packageName;

    // Ajouter les paramètres additionnels personnalisés
    Object.keys(additionalParams).forEach(key => {
      if (!["prompt", "template"].includes(key)) {
        options[key] = additionalParams[key];
      }
    });

    const response = await chat.chat(options);

    return res.status(200).json(response);

  } catch (error) {
    console.error("ChatAI API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error",
      message: "Failed to generate chat response"
    });
  }
});

// Endpoint GET /templates (liste des templates disponibles)
router.get("/templates", async (req, res) => {
  return res.status(200).json({
    status: true,
    data: {
      templates: {
        1: {
          id: "653b5fd1003600001b005769",
          name: "Default",
          description: "Standard chat template"
        },
        2: {
          id: "653b5fe4003600001b005773",
          name: "Alternative 1",
          description: "Alternative personality template"
        },
        3: {
          id: "653b5fd5003600001b00576c",
          name: "Alternative 2",
          description: "Creative mode template"
        }
      },
      default: 1
    }
  });
});

module.exports = {
  path: "/api/chatai",
  name: "ChatAI API",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/chatai/chat?prompt=Hello%20world&template=1`,
  logo: "https://api.chatai.click/favicon.ico",
  category: "ai",
  info: "AI chat API with multiple personality templates and streaming response support",
  router
};

