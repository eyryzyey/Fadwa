const express = require("express");
const axios = require("axios");

const router = express.Router();

const el = [
  {
    value: "deepseek-ai/DeepSeek-V3-0324",
    label: "DeepSeek V3 O324",
    providers: ["fireworks-ai", "nebius", "sambanova", "novita", "hyperbolic"],
    autoProvider: "novita"
  },
  {
    value: "deepseek-ai/DeepSeek-R1-0528",
    label: "DeepSeek R1 0528",
    providers: ["fireworks-ai", "novita", "hyperbolic", "nebius", "together", "sambanova"],
    autoProvider: "novita",
    isThinker: true
  },
  {
    value: "Qwen/Qwen3-Coder-480B-A35B-Instruct",
    label: "Qwen3 Coder 480B A35B Instruct",
    providers: ["novita", "hyperbolic"],
    autoProvider: "novita",
    isNew: true
  },
  {
    value: "moonshotai/Kimi-K2-Instruct",
    label: "Kimi K2 Instruct",
    providers: ["together", "novita", "groq"],
    autoProvider: "groq"
  },
  {
    value: "deepseek-ai/DeepSeek-V3.1",
    label: "DeepSeek V3.1",
    providers: ["fireworks-ai", "novita"],
    isNew: true,
    autoProvider: "fireworks-ai"
  },
  {
    value: "moonshotai/Kimi-K2-Instruct-0905",
    label: "Kimi K2 Instruct 0905",
    providers: ["together", "groq", "novita"],
    isNew: true,
    autoProvider: "groq"
  }
];

class AIHandler {
  constructor() {
    this.apiUrl = "https://enzostvs-deepsite.hf.space/api/ask-ai";
    this.headers = {
      accept: "*/*",
      "accept-language": "id-ID",
      "content-type": "application/json",
      origin: "https://enzostvs-deepsite.hf.space",
      priority: "u=1, i",
      referer: "https://enzostvs-deepsite.hf.space/projects/new",
      "sec-ch-ua": '"Chromium";v="127", "Not)A;Brand";v="99", "Microsoft Edge Simulate";v="127", "Lemur";v="127"',
      "sec-ch-ua-mobile": "?1",
      "sec-ch-ua-platform": '"Android"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
      "x-forwarded-for": "enzostvs-deepsite.hf.space"
    };
  }

  _g(e) {
    if (!e) return "";
    const t = e.trim().match(/<!DOCTYPE html>[\s\S]*/);
    if (!t) return "";
    let s = t[0];
    return this._f(s).replace(/```/g, "");
  }

  _f(e) {
    let t = e;
    if (t.includes("<head>") && !t.includes("</head>")) t += "\n</head>";
    if (t.includes("<body") && !t.includes("</body>")) t += "\n</body>";
    if (!t.includes("</html>")) t += "\n</html>";
    return t;
  }

  _h(e) {
    let t = [];
    const titleRegex = /<<<<<<< START_TITLE (.*?) >>>>>>> END_TITLE/;
    if (!e.match(titleRegex)) {
      return t;
    }
    const s = e.split(titleRegex);
    const a = new Set();
    s.forEach((val, index) => {
      if (a.has(index) || !val?.trim()) return;
      const n = this._g(s[index + 1]);
      if (n) {
        const page = {
          path: val.trim(),
          html: n
        };
        t.push(page);
        a.add(index);
        a.add(index + 1);
      }
    });
    return t;
  }

  async chat({ prompt, ...rest }) {
    try {
      const data = {
        prompt: prompt,
        provider: rest?.provider || "auto",
        model: rest?.model ?? "deepseek-ai/DeepSeek-V3.1",
        ...rest
      };

      const response = await axios.post(this.apiUrl, data, {
        headers: this.headers,
        responseType: "text"
      });

      const responseData = response.data;
      const parsedPages = this._h(responseData);
      
      if (parsedPages.length > 0) {
        return {
          status: true,
          pages: parsedPages,
          count: parsedPages.length
        };
      }

      return {
        status: false,
        message: "Failed to parse response or format not supported",
        raw: responseData
      };

    } catch (error) {
      const errorMessage = error?.response?.data || error?.message || "Server error occurred";
      return {
        status: false,
        error: true,
        message: errorMessage
      };
    }
  }
}

router.get("/models", async (req, res) => {
  try {
    return res.status(200).json({
      status: true,
      models: el.map(m => ({
        value: m.value,
        label: m.label,
        providers: m.providers,
        autoProvider: m.autoProvider,
        isNew: m.isNew || false,
        isThinker: m.isThinker || false
      })),
      count: el.length
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message
    });
  }
});

router.post("/chat", async (req, res) => {
  try {
    const { prompt, provider, model } = req.body;

    if (!prompt) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: prompt"
      });
    }

    const ai = new AIHandler();
    const response = await ai.chat({ prompt, provider, model });

    if (!response.status) {
      return res.status(400).json({
        status: false,
        error: response.message || "Chat failed",
        details: response.raw || null
      });
    }

    return res.status(200).json({
      status: true,
      pages: response.pages,
      count: response.count
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error"
    });
  }
});

module.exports = {
  path: "/api/deepsite",
  name: "DeepSite AI Website Generator",
  type: "post",
  url: `${global.t || "http://localhost:3000"}/api/deepsite/chat`,
  logo: "https://enzostvs-deepsite.hf.space/favicon.ico",
  category: "ai",
  info: "Generate complete HTML websites from text prompts using various AI models",
  router
};
