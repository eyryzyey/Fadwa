const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

async function getSnappinToken() {
  const { headers, data } = await axios.get("https://snappin.app/", {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      "accept-encoding": "gzip, deflate, br",
      "referer": "https://www.google.com/"
    }
  });
  const cookies = headers["set-cookie"].map(c => c.split(";")[0]).join("; ");
  const $ = cheerio.load(data);
  const csrfToken = $('meta[name="csrf-token"]').attr("content");
  return { csrfToken, cookies };
}

async function snappinDownload(pinterestUrl) {
  const { csrfToken, cookies } = await getSnappinToken();

  const postRes = await axios.post(
    "https://snappin.app/",
    { url: pinterestUrl },
    {
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
        "cookie": cookies,
        "referer": "https://snappin.app",
        "origin": "https://snappin.app",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "accept": "application/json, text/plain, */*",
        "accept-language": "en-US,en;q=0.9"
      }
    }
  );

  const $ = cheerio.load(postRes.data);
  const thumb = $("img").attr("src");

  const downloadLinks = $("a.button.is-success")
    .map((_, el) => $(el).attr("href"))
    .get();

  let videoUrl = null;
  let imageUrl = null;

  for (const link of downloadLinks) {
    const fullLink = link.startsWith("http") ? link : "https://snappin.app" + link;
    const head = await axios.head(fullLink, { timeout: 5000 }).catch(() => null);
    const contentType = head?.headers?.["content-type"] || "";

    if (link.includes("/download-file/")) {
      if (contentType.includes("video")) {
        videoUrl = fullLink;
      } else if (contentType.includes("image")) {
        imageUrl = fullLink;
      }
    } else if (link.includes("/download-image/")) {
      imageUrl = fullLink;
    }
  }

  return {
    status: true,
    thumb: thumb || "",
    video: videoUrl,
    image: videoUrl ? null : imageUrl
  };
}

router.get("/download", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== "string" || url.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Missing or invalid parameter: 'url' is required",
        example: "/api/pinterest/download?url=https://pin.it/xxxx"
      });
    }

    if (!/pin\.it|pinterest\.com/.test(url)) {
      return res.status(400).json({
        status: false,
        error: "Invalid Pinterest URL"
      });
    }

    const result = await snappinDownload(url.trim());

    if (!result.video && !result.image) {
      return res.status(404).json({
        status: false,
        error: "No media found in this link"
      });
    }

    return res.status(200).json({
      status: true,
      platform: "pinterest",
      ...result
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message || "Failed to download from Pinterest"
    });
  }
});

module.exports = {
  path: "/api/pinterest",
  name: "Pinterest Downloader",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/pinterest/download?url=https://www.pinterest.com/pin/99360735500167749/`,
  logo: "https://cdn-icons-png.flaticon.com/512/174/174863.png",
  category: "download",
  info: "Download images and videos from Pinterest",
  router
};
