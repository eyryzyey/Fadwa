const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const router = express.Router();

function _r(s) {
  return s.split("+").map(t => t.trim().replace(/[()']/g, "")).join("");
}

const API_BASE = _r("('https') + '://' + 'johan-vex-apis' + ('.') + 'vercel' + ('.') + 'app' + '/api/ai/ai-image");

const MODELS = {
  nano_banana: { label: "Nano Banana", desc: "سريع ودقيق", icon: "🍌" },
  flux: { label: "Flux", desc: "جودة عالية وإبداعي", icon: "⚡" }
};

const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"];
const OUTPUT_FORMATS = ["png", "jpg", "webp"];

const sessions = new Map();
const SESSION_TTL = 60 * 60 * 1000;

setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL;
  for (const [id, data] of sessions) {
    if (data.timestamp < cutoff) sessions.delete(id);
  }
}, 15 * 60 * 1000);

class AIImageGenerator {
  constructor() {
    this.headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      "Referer": "https://johan-vex-apis.vercel.app/",
      "Origin": "https://johan-vex-apis.vercel.app"
    };
  }

  async generate(prompt, model = "nano_banana", aspect_ratio = "1:1", output_format = "png") {
    try {
      const response = await axios.get(API_BASE, {
        params: {
          prompt: prompt,
          model: model,
          aspect_ratio: aspect_ratio,
          output_format: output_format
        },
        timeout: 120000,
        headers: this.headers,
        responseType: "json"
      });

      if (!response.data?.success) {
        throw new Error(response.data?.error || response.data?.message || "فشل توليد الصورة");
      }

      const result = response.data;

      return {
        status: true,
        url: result.result || result.url || null,
        model: result.model || model,
        aspectRatio: result.aspect_ratio || aspect_ratio,
        outputFormat: result.output_format || output_format,
        note: result.note || null,
        prompt: prompt,
        metadata: {
          apiResponse: result,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.error || error.response.data?.message || error.message;
        throw new Error(`API error (${status}): ${message}`);
      } else if (error.request) {
        throw new Error("API did not respond within timeout (120s)");
      } else {
        throw new Error(error.message || "Unknown error occurred");
      }
    }
  }

  async downloadImage(imageUrl) {
    try {
      const { data } = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 30000,
        headers: {
          ...this.headers,
          "Accept": "image/*,*/*;q=0.9"
        }
      });

      return {
        buffer: Buffer.from(data).toString("base64"),
        size: data.length,
        mimeType: data.byteLength > 0 ? "image/png" : "application/octet-stream"
      };
    } catch (error) {
      throw new Error(`Failed to download image: ${error.message}`);
    }
  }

  createSession(prompt, model, aspect_ratio, output_format) {
    const sessionId = crypto.randomUUID();
    sessions.set(sessionId, {
      prompt,
      model,
      aspect_ratio,
      output_format,
      timestamp: Date.now()
    });
    return sessionId;
  }

  getSession(sessionId) {
    const data = sessions.get(sessionId);
    if (!data) return null;
    if (Date.now() - data.timestamp > SESSION_TTL) {
      sessions.delete(sessionId);
      return null;
    }
    return data;
  }
}

router.get("/generate", async (req, res) => {
  try {
    const {
      prompt,
      text,
      model = "nano_banana",
      aspect_ratio = "1:1",
      output_format = "png",
      download = "false"
    } = req.query;

    const userPrompt = prompt || text;

    if (!userPrompt || userPrompt.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'prompt' or 'text' is required",
        example: `${global.t || "http://localhost:3000"}/api/ai-image/generate?prompt=cat%20in%20garden&model=flux`,
        usage: "Generate AI image from text description",
        availableModels: Object.keys(MODELS).map(k => ({ id: k, ...MODELS[k] })),
        optionalParams: {
          model: `Model ID (${Object.keys(MODELS).join(" | ")}, default: nano_banana)`,
          aspect_ratio: `Aspect ratio (${ASPECT_RATIOS.join(" | ")}, default: 1:1)`,
          output_format: `Output format (${OUTPUT_FORMATS.join(" | ")}, default: png)`,
          download: "Include base64 image (true/false, default: false)"
        }
      });
    }

    const trimmedPrompt = userPrompt.trim();

    if (trimmedPrompt.length < 3) {
      return res.status(400).json({
        status: false,
        error: "Prompt too short (min 3 characters)"
      });
    }

    if (trimmedPrompt.length > 1000) {
      return res.status(400).json({
        status: false,
        error: "Prompt too long (max 1000 characters)"
      });
    }

    if (!MODELS[model]) {
      return res.status(400).json({
        status: false,
        error: `Invalid model '${model}'`,
        availableModels: Object.keys(MODELS).map(k => ({ id: k, ...MODELS[k] }))
      });
    }

    if (!ASPECT_RATIOS.includes(aspect_ratio)) {
      return res.status(400).json({
        status: false,
        error: `Invalid aspect_ratio '${aspect_ratio}'`,
        availableRatios: ASPECT_RATIOS
      });
    }

    if (!OUTPUT_FORMATS.includes(output_format)) {
      return res.status(400).json({
        status: false,
        error: `Invalid output_format '${output_format}'`,
        availableFormats: OUTPUT_FORMATS
      });
    }

    const generator = new AIImageGenerator();
    const result = await generator.generate(trimmedPrompt, model, aspect_ratio, output_format);

    const sessionId = generator.createSession(trimmedPrompt, model, aspect_ratio, output_format);

    if (download === "true" || download === "1") {
      try {
        const imageData = await generator.downloadImage(result.url);
        result.image = imageData;
      } catch (e) {
        result.imageError = e.message;
      }
    }

    return res.status(200).json({
      status: true,
      sessionId: sessionId,
      ...result
    });

  } catch (error) {
    console.error("AI Image Generate API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error",
      message: "Failed to generate AI image"
    });
  }
});

router.post("/generate", async (req, res) => {
  try {
    const {
      prompt,
      text,
      model = "nano_banana",
      aspect_ratio = "1:1",
      output_format = "png",
      download = false
    } = req.body;

    const userPrompt = prompt || text;

    if (!userPrompt || userPrompt.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'prompt' or 'text' is required in request body",
        example: {
          prompt: "cat in garden",
          model: "flux",
          aspect_ratio: "1:1",
          output_format: "png"
        }
      });
    }

    const trimmedPrompt = userPrompt.trim();

    if (trimmedPrompt.length < 3) {
      return res.status(400).json({
        status: false,
        error: "Prompt too short (min 3 characters)"
      });
    }

    if (trimmedPrompt.length > 1000) {
      return res.status(400).json({
        status: false,
        error: "Prompt too long (max 1000 characters)"
      });
    }

    if (!MODELS[model]) {
      return res.status(400).json({
        status: false,
        error: `Invalid model '${model}'`,
        availableModels: Object.keys(MODELS).map(k => ({ id: k, ...MODELS[k] }))
      });
    }

    if (!ASPECT_RATIOS.includes(aspect_ratio)) {
      return res.status(400).json({
        status: false,
        error: `Invalid aspect_ratio`,
        availableRatios: ASPECT_RATIOS
      });
    }

    if (!OUTPUT_FORMATS.includes(output_format)) {
      return res.status(400).json({
        status: false,
        error: `Invalid output_format`,
        availableFormats: OUTPUT_FORMATS
      });
    }

    const generator = new AIImageGenerator();
    const result = await generator.generate(trimmedPrompt, model, aspect_ratio, output_format);
    const sessionId = generator.createSession(trimmedPrompt, model, aspect_ratio, output_format);

    if (download === true || download === "true") {
      try {
        const imageData = await generator.downloadImage(result.url);
        result.image = imageData;
      } catch (e) {
        result.imageError = e.message;
      }
    }

    return res.status(200).json({
      status: true,
      sessionId: sessionId,
      ...result
    });

  } catch (error) {
    console.error("AI Image Generate API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error"
    });
  }
});

router.get("/regenerate", async (req, res) => {
  try {
    const { sessionId, download = "false" } = req.query;

    if (!sessionId || sessionId.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'sessionId' is required",
        example: `${global.t || "http://localhost:3000"}/api/ai-image/regenerate?sessionId=xxxxxx`,
        usage: "Regenerate an image using previous session parameters"
      });
    }

    const generator = new AIImageGenerator();
    const sessionData = generator.getSession(sessionId.trim());

    if (!sessionData) {
      return res.status(404).json({
        status: false,
        error: "Session not found or expired",
        message: "Sessions expire after 1 hour. Please generate a new image."
      });
    }

    const result = await generator.generate(
      sessionData.prompt,
      sessionData.model,
      sessionData.aspect_ratio,
      sessionData.output_format
    );

    generator.createSession(sessionData.prompt, sessionData.model, sessionData.aspect_ratio, sessionData.output_format);

    if (download === "true" || download === "1") {
      try {
        const imageData = await generator.downloadImage(result.url);
        result.image = imageData;
      } catch (e) {
        result.imageError = e.message;
      }
    }

    return res.status(200).json({
      status: true,
      sessionId: sessionId,
      regenerated: true,
      ...result
    });

  } catch (error) {
    console.error("AI Image Regenerate API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error",
      message: "Failed to regenerate AI image"
    });
  }
});

router.get("/models", async (req, res) => {
  return res.status(200).json({
    status: true,
    models: Object.entries(MODELS).map(([id, data]) => ({
      id,
      name: data.label,
      description: data.desc,
      icon: data.icon
    })),
    aspectRatios: ASPECT_RATIOS,
    outputFormats: OUTPUT_FORMATS,
    defaults: {
      model: "nano_banana",
      aspect_ratio: "1:1",
      output_format: "png"
    }
  });
});

router.get("/sessions", async (req, res) => {
  const sessionList = [];
  const now = Date.now();

  for (const [id, data] of sessions.entries()) {
    sessionList.push({
      sessionId: id,
      prompt: data.prompt.substring(0, 50) + (data.prompt.length > 50 ? "..." : ""),
      model: data.model,
      aspectRatio: data.aspect_ratio,
      outputFormat: data.output_format,
      created: new Date(data.timestamp).toISOString(),
      expiresIn: Math.floor((SESSION_TTL - (now - data.timestamp)) / 1000) + "s"
    });
  }

  return res.status(200).json({
    status: true,
    totalSessions: sessions.size,
    sessionTtl: SESSION_TTL / 1000 + "s",
    sessions: sessionList
  });
});

router.delete("/sessions", async (req, res) => {
  const size = sessions.size;
  sessions.clear();

  return res.status(200).json({
    status: true,
    message: "All sessions cleared successfully",
    clearedSessions: size
  });
});

module.exports = {
  path: "/api/ai-image",
  name: "AI Image Generator",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/ai-image/generate?prompt=cat%20in%20garden&model=flux`,
  logo: "https://cdn-icons-png.flaticon.com/512/3659/3659898.png",
  category: "tools",
  info: "Generate AI images from text prompts using Nano Banana and Flux models with support for aspect ratios and format selection",
  router
};

