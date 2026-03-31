const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

function parseString(string) {
  try {
    return JSON.parse(`{"text": "${string}"}`).text;
  } catch (e) {
    return string;
  }
}

function match(data, ...patterns) {
  for (const pattern of patterns) {
    const result = data.match(pattern);
    if (result) return result;
  }
  return null;
}

async function fesnuk(postUrl, cookie = "", userAgent = "") {
  if (!postUrl || !postUrl.trim()) throw new Error("Please specify a valid Facebook URL.");
  if (!/(facebook.com|fb.watch)/.test(postUrl)) throw new Error("Invalid Facebook URL.");

  const headers = {
    "authority": "www.facebook.com",
    "origin": "https://www.facebook.com",
    "referer": "https://www.facebook.com/",
    "sec-fetch-user": "?1",
    "sec-ch-ua-mobile": "?0",
    "sec-fetch-site": "none",
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "cache-control": "max-age=0",
    "upgrade-insecure-requests": "1",
    "accept-language": "en-GB,en;q=0.9,en-US;q=0.8,ar;q=0.7",
    "sec-ch-ua": '"Google Chrome";v="89", "Chromium";v="89", ";Not A Brand";v="99"',
    "user-agent": userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.114 Safari/537.36",
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
    "cookie": cookie || ""
  };

  const { data } = await axios.get(postUrl, { headers });
  const extractData = data.replace(/"/g, '"').replace(/&/g, "&");

  const sdUrl = match(extractData, /"browser_native_sd_url":"(.*?)"/, /sd_src\s*:\s*"([^"]*)"/)?.[1];
  const hdUrl = match(extractData, /"browser_native_hd_url":"(.*?)"/, /hd_src\s*:\s*"([^"]*)"/)?.[1];
  const title = match(extractData, /<meta\sname="description"\scontent="(.*?)"/)?.[1] || "";

  if (!sdUrl) {
    throw new Error("Unable to fetch media at this time. Please try again.");
  }

  return {
    url: postUrl,
    title: parseString(title),
    quality: {
      sd: parseString(sdUrl),
      hd: parseString(hdUrl || "")
    }
  };
}

router.get("/download", async (req, res) => {
  try {
    const { url, cookie, userAgent } = req.query;

    if (!url || typeof url !== "string" || url.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Missing or invalid parameter: 'url' is required",
        example: "/api/facebook/download?url=https://facebook.com/watch?v=..."
      });
    }

    const result = await fesnuk(url.trim(), cookie || "", userAgent || "");

    return res.status(200).json({
      status: true,
      platform: "facebook",
      ...result
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message || "Unable to fetch media at this time. Please try again."
    });
  }
});

module.exports = {
  path: "/api/facebook",
  name: "Facebook Video Downloader",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/facebook/download?url=https://www.facebook.com/Meta/videos/10153231379946729/`,
  logo: "https://cdn-icons-png.flaticon.com/512/124/124010.png",
  category: "download",
  info: "Download Facebook videos in SD and HD quality",
  router
};

