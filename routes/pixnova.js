const express = require("express");
const axios = require("axios");
const FormData = require("form-data");
const cheerio = require("cheerio");

const router = express.Router();

async function uploadToCatbox(buffer, mime) {
  const form = new FormData();
  form.append("fileToUpload", buffer, {
    filename: `image_${Date.now()}.jpg`,
    contentType: mime
  });
  form.append("reqtype", "fileupload");

  const uploadRes = await axios.post(
    "https://catbox.moe/user/api.php",
    form,
    {
      headers: form.getHeaders(),
      timeout: 60000
    }
  );

  const imageUrl = uploadRes.data;
  if (!imageUrl.startsWith("http")) throw new Error("Failed to upload image");

  return imageUrl;
}

async function generateImage(tool, prompt, imageUrl) {
  const base = "https://takamura.site/api/ai/pixnova";
  const params = {
    tool: tool,
    prompt: prompt
  };

  if (imageUrl) {
    params.imageUrl = imageUrl;
  }

  const headers = {
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "accept": "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9",
    "accept-encoding": "gzip, deflate, br",
    "referer": "https://takamura.site/",
    "origin": "https://takamura.site"
  };

  const { data } = await axios.get(`${base}/generate`, {
    params: params,
    headers: headers,
    timeout: 120000
  });

  if (data.status !== "success") {
    throw new Error(data.error || "Generation failed");
  }

  return data.result;
}

router.get("/text2image", async (req, res) => {
  try {
    const { q, query, prompt } = req.query;

    const textPrompt = q || query || prompt;

    if (!textPrompt || typeof textPrompt !== "string" || textPrompt.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Missing or invalid parameter: 'q', 'query', or 'prompt' is required",
        example: "/api/pixnova/text2image?q=a cat in space"
      });
    }

    const result = await generateImage("text2image", textPrompt.trim());

    return res.status(200).json({
      status: true,
      tool: "text2image",
      prompt: textPrompt.trim(),
      imageUrl: result
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message || "Failed to generate image"
    });
  }
});

router.post("/image2image", async (req, res) => {
  try {
    const { prompt, imageUrl } = req.body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Missing or invalid parameter: 'prompt' is required in body"
      });
    }

    if (!imageUrl || typeof imageUrl !== "string" || imageUrl.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Missing or invalid parameter: 'imageUrl' is required in body"
      });
    }

    const result = await generateImage("image2image", prompt.trim(), imageUrl.trim());

    return res.status(200).json({
      status: true,
      tool: "image2image",
      prompt: prompt.trim(),
      sourceImage: imageUrl.trim(),
      imageUrl: result
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message || "Failed to generate image"
    });
  }
});

module.exports = {
  path: "/api/pixnova",
  name: "PixNova AI Image Generator",
  type: "get/post",
  url: `${global.t || "http://localhost:3000"}/api/pixnova/text2image?q=a cat in space`,
  logo: "https://cdn-icons-png.flaticon.com/512/4712/4712035.png",
  category: "ai",
  info: "AI image generation - text to image and image to image",
  router
};

