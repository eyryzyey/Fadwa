const express = require("express");
const axios = require("axios");
const FormData = require("form-data");

const router = express.Router();

class AIAnime {
  constructor() {
    this.http = axios.create({
      headers: {
        accept: "*/*",
        "accept-language": "id-ID",
        "cache-control": "no-cache",
        pragma: "no-cache",
        "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
        "sec-ch-ua": '"Chromium";v="127", "Not)A;Brand";v="99"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        origin: "https://aianime.io",
        referer: "https://aianime.io/",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site"
      }
    });
    this.base = "https://api.aianime.io/api";
  }

  isUrl(str) {
    return typeof str === "string" && (str.startsWith("http://") || str.startsWith("https://"));
  }

  async toBuf(img) {
    try {
      if (this.isUrl(img)) {
        const { data } = await axios.get(img, {
          responseType: "arraybuffer",
          headers: {
            "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
            accept: "image/webp,image/apng,image/*,*/*;q=0.8"
          }
        });
        return Buffer.from(data);
      }
      if (Buffer.isBuffer(img)) {
        return img;
      }
      if (img?.startsWith?.("data:")) {
        return Buffer.from(img.split(",")[1], "base64");
      }
      return Buffer.from(img, "base64");
    } catch (e) {
      throw new Error(`Image processing failed: ${e?.message}`);
    }
  }

  async poll(id, max = 60) {
    try {
      for (let i = 0; i < max; i++) {
        await new Promise(r => setTimeout(r, 3000));
        try {
          const { data } = await this.http.get(`${this.base}/result/get?job_id=${id}`, {
            headers: {
              "sec-fetch-dest": "empty",
              "sec-fetch-mode": "cors",
              "sec-fetch-site": "same-site"
            }
          });
          if (data?.code === 200 && data?.result !== null) {
            return data || [];
          }
        } catch (e) {
          // Continue polling
        }
      }
      throw new Error("Polling timeout - job took too long to complete");
    } catch (e) {
      throw e;
    }
  }

  async t2i({ prompt, negative_prompt, model_type, aspect_ratio, ...rest }) {
    try {
      const form = new FormData();
      form.append("prompt", prompt);
      form.append("negative_prompt", negative_prompt || "");
      form.append("model_type", model_type || "standard");
      form.append("aspect_ratio", aspect_ratio || "2:3");
      
      const { data } = await this.http.post(`${this.base}/image-generate/text2image`, form, {
        headers: {
          ...form.getHeaders(),
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-site"
        }
      });
      
      const jobId = data?.result?.job_id;
      if (!jobId) throw new Error("Failed to create job - no job_id received");
      
      return await this.poll(jobId);
    } catch (e) {
      throw new Error(`Text to Image failed: ${e?.message}`);
    }
  }

  async i2i({ prompt, image, negative_prompt, model_type, aspect_ratio, ...rest }) {
    try {
      const buf = await this.toBuf(image);
      const form = new FormData();
      form.append("image", buf, { filename: `${Date.now()}.jpg` });
      form.append("prompt", prompt);
      form.append("negative_prompt", negative_prompt || "");
      form.append("model_type", model_type || "standard");
      form.append("aspect_ratio", aspect_ratio || "match_input_image");
      
      const { data } = await this.http.post(`${this.base}/image-generate/image2image`, form, {
        headers: {
          ...form.getHeaders(),
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-site"
        }
      });
      
      const jobId = data?.result?.job_id;
      if (!jobId) throw new Error("Failed to create job - no job_id received");
      
      return await this.poll(jobId);
    } catch (e) {
      throw new Error(`Image to Image failed: ${e?.message}`);
    }
  }

  async t2v({ prompt, ...rest }) {
    try {
      const form = new FormData();
      form.append("prompt", prompt);
      
      const { data } = await this.http.post(`${this.base}/video-generate/text2video`, form, {
        headers: {
          ...form.getHeaders(),
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-site"
        }
      });
      
      const jobId = data?.result?.job_id;
      if (!jobId) throw new Error("Failed to create job - no job_id received");
      
      return await this.poll(jobId);
    } catch (e) {
      throw new Error(`Text to Video failed: ${e?.message}`);
    }
  }

  async i2v({ prompt, image, ...rest }) {
    try {
      const buf = await this.toBuf(image);
      const form = new FormData();
      form.append("image", buf, { filename: `${Date.now()}.jpg` });
      form.append("prompt", prompt);
      
      const { data } = await this.http.post(`${this.base}/video-generate/image2video`, form, {
        headers: {
          ...form.getHeaders(),
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-site"
        }
      });
      
      const jobId = data?.result?.job_id;
      if (!jobId) throw new Error("Failed to create job - no job_id received");
      
      return await this.poll(jobId);
    } catch (e) {
      throw new Error(`Image to Video failed: ${e?.message}`);
    }
  }

  async generate({ prompt, image, video, ...rest }) {
    if (video && image) {
      return await this.i2v({ prompt, image, ...rest });
    }
    if (video) {
      return await this.t2v({ prompt, ...rest });
    }
    if (image) {
      return await this.i2i({ prompt, image, ...rest });
    }
    return await this.t2i({ prompt, ...rest });
  }
}

router.post("/generate", async (req, res) => {
  try {
    const { prompt, image, video, negative_prompt, model_type, aspect_ratio } = req.body;

    if (!prompt) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: prompt"
      });
    }

    const api = new AIAnime();
    const data = await api.generate({ 
      prompt, 
      image, 
      video, 
      negative_prompt, 
      model_type, 
      aspect_ratio 
    });

    return res.status(200).json({
      status: true,
      code: data.code,
      result: data.result,
      message: data.message
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message
    });
  }
});

router.post("/text2image", async (req, res) => {
  try {
    const { prompt, negative_prompt, model_type, aspect_ratio } = req.body;

    if (!prompt) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: prompt"
      });
    }

    const api = new AIAnime();
    const data = await api.t2i({ prompt, negative_prompt, model_type, aspect_ratio });

    return res.status(200).json({
      status: true,
      code: data.code,
      result: data.result,
      message: data.message
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message
    });
  }
});

router.post("/image2image", async (req, res) => {
  try {
    const { prompt, image, negative_prompt, model_type, aspect_ratio } = req.body;

    if (!prompt || !image) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameters: prompt and image"
      });
    }

    const api = new AIAnime();
    const data = await api.i2i({ prompt, image, negative_prompt, model_type, aspect_ratio });

    return res.status(200).json({
      status: true,
      code: data.code,
      result: data.result,
      message: data.message
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message
    });
  }
});

router.post("/text2video", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: prompt"
      });
    }

    const api = new AIAnime();
    const data = await api.t2v({ prompt });

    return res.status(200).json({
      status: true,
      code: data.code,
      result: data.result,
      message: data.message
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message
    });
  }
});

router.post("/image2video", async (req, res) => {
  try {
    const { prompt, image } = req.body;

    if (!prompt || !image) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameters: prompt and image"
      });
    }

    const api = new AIAnime();
    const data = await api.i2v({ prompt, image });

    return res.status(200).json({
      status: true,
      code: data.code,
      result: data.result,
      message: data.message
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message
    });
  }
});

module.exports = {
  path: "/api/aianime",
  name: "AI Anime Generator",
  type: "post",
  url: `${global.t || "http://localhost:3000"}/api/aianime/generate`,
  logo: "https://aianime.io/favicon.ico",
  category: "anime",
  info: "Generate anime-style images and videos from text or images using AI",
  router
};

