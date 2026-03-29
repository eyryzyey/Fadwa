const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const router = express.Router();

const randomString = (length, charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789") => {
  return Array.from({ length }, () => charset.charAt(crypto.randomInt(charset.length))).join("");
};

const formatNumber = (num) => {
  const numString = Math.abs(num).toString();
  const numDigits = numString.length;
  if (numDigits <= 3) return numString;
  const suffix = ["", "k", "M", "B", "T"][Math.floor((numDigits - 1) / 3)];
  return `${(num / 1000 ** Math.floor((numDigits - 1) / 3)).toFixed(1).replace(/\.0$/, "")}${suffix}`;
};

const formatDuration = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h && `${h} hour`, m && `${m} minute`, s && `${s} second`].filter(Boolean).join(" ");
};

const buildTikTokSearchUrl = (keywords, offset = 0) => {
  const encodedKeywords = encodeURIComponent(keywords);
  const timestamp = Date.now();
  const msToken = randomString(107);
  const xBogus = randomString(21);
  const signature = `_02B4Z6wo00001${randomString(16)}`;
  
  return `https://www.tiktok.com/api/search/general/full/?` +
    `aid=1988&app_language=id-ID&app_name=tiktok_web&battery_info=1` +
    `&browser_language=id-ID&browser_name=Mozilla&browser_online=true` +
    `&browser_platform=MacIntel&browser_version=${encodeURIComponent("5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")}` +
    `&channel=tiktok_web&cookie_enabled=true&device_id=${randomString(19, "0123456789")}` +
    `&device_platform=web_pc&focus_state=true&from_page=search&history_len=3` +
    `&is_fullscreen=false&is_page_visible=true&keyword=${encodedKeywords}&offset=${offset}` +
    `&os=mac&priority_region=&referer=&region=SG&screen_height=1080&screen_width=1920` +
    `&tz_name=Asia%2FShanghai&webcast_language=id-ID&msToken=${msToken}` +
    `&X-Bogus=${xBogus}&_signature=${signature}`;
};

const getTikTokHeaders = (keywords) => {
  return {
    "Authority": "www.tiktok.com",
    "Method": "GET",
    "Path": "/api/search/general/full/",
    "Scheme": "https",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": `https://www.tiktok.com/search?q=${encodeURIComponent(keywords)}&t=${Date.now()}`,
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"macOS"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "Connection": "keep-alive",
    "Cookie": `ttwid=1%7C${randomString(16)}%7C${Math.floor(Date.now() / 1000)}%7C${randomString(32)}; ` +
              `msToken=${randomString(107)}; ` +
              `tt_csrf_token=${randomString(16)}; ` +
              `bm_sv=${randomString(32)}~${randomString(8)}`
  };
};

const searchTikTokVideos = async (keywords, offset = 0) => {
  const url = buildTikTokSearchUrl(keywords, offset);
  const headers = getTikTokHeaders(keywords);

  try {
    const response = await axios.get(url, {
      headers,
      timeout: 30000,
      decompress: true
    });

    if (response.status !== 200 || !response.data) {
      throw new Error("Invalid response from TikTok API");
    }

    const { has_more, data } = response.data;

    if (!data || !Array.isArray(data)) {
      return {
        results: [],
        hasMore: 0,
        total: 0
      };
    }

    const results = data.map(({ item }) => {
      if (!item || !item.video) return null;

      const titleMatch = item.desc?.match(/(.+?)#/) || item.desc?.match(/(.+?)\n/);
      const title = titleMatch ? titleMatch[1].trim() : item.desc || "No title";

      return {
        id: item.id || item.video.id,
        title: title,
        description: item.desc || "",
        url: `https://www.tiktok.com/@${item.author?.uniqueId}/video/${item.id}`,
        video: {
          id: item.video.id,
          ratio: item.video.ratio || "9:16",
          duration: item.video.duration || 0,
          durationFormatted: formatDuration(item.video.duration || 0),
          cover: item.video.cover || item.video.originCover || null,
          playAddr: item.video.playAddr || null,
          downloadAddr: item.video.downloadAddr || null
        },
        author: {
          id: item.author?.id,
          nickname: item.author?.nickname || "Unknown",
          username: item.author?.uniqueId || "unknown",
          avatar: item.author?.avatarThumb || item.author?.avatarMedium || null,
          signature: item.author?.signature || "",
          verified: item.author?.verified || false
        },
        stats: {
          likes: formatNumber(item.stats?.diggCount || 0),
          likesRaw: item.stats?.diggCount || 0,
          shares: formatNumber(item.stats?.shareCount || 0),
          sharesRaw: item.stats?.shareCount || 0,
          comments: formatNumber(item.stats?.commentCount || 0),
          commentsRaw: item.stats?.commentCount || 0,
          views: formatNumber(item.stats?.playCount || 0),
          viewsRaw: item.stats?.playCount || 0,
          collects: formatNumber(item.stats?.collectCount || 0),
          collectsRaw: item.stats?.collectCount || 0
        },
        music: item.music ? {
          id: item.music.id,
          title: item.music.title || "Original Sound",
          author: item.music.authorName || "Unknown",
          cover: item.music.coverThumb || null,
          duration: item.music.duration || 0,
          playUrl: item.music.playUrl || null,
          isOriginal: item.music.isOriginalSound || false
        } : null,
        createdAt: item.createTime ? new Date(item.createTime * 1000).toISOString() : null,
        isAd: item.isAd || false,
        isPinned: item.isPinnedItem || false
      };
    }).filter(Boolean);

    return {
      results: results,
      hasMore: has_more === 1 ? 1 : 0,
      total: results.length,
      query: keywords,
      offset: offset
    };
  } catch (error) {
    if (error.response) {
      throw new Error(`TikTok API error: ${error.response.status} - ${error.response.statusText}`);
    }
    throw new Error(`Request failed: ${error.message}`);
  }
};

router.get("/search", async (req, res) => {
  try {
    const { query, offset = 0, limit } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Query parameter is required. Example: ?query=dance&offset=0"
      });
    }

    const offsetNum = parseInt(offset) || 0;
    const result = await searchTikTokVideos(query.trim(), offsetNum);

    if (limit && !isNaN(parseInt(limit))) {
      result.results = result.results.slice(0, parseInt(limit));
      result.total = result.results.length;
    }

    return res.status(200).json({
      status: true,
      ...result
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message || "Failed to search TikTok videos"
    });
  }
});

router.post("/search", async (req, res) => {
  try {
    const { query, offset = 0, limit } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Query is required in request body"
      });
    }

    const offsetNum = parseInt(offset) || 0;
    const result = await searchTikTokVideos(query.trim(), offsetNum);

    if (limit && !isNaN(parseInt(limit))) {
      result.results = result.results.slice(0, parseInt(limit));
      result.total = result.results.length;
    }

    return res.status(200).json({
      status: true,
      ...result
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message || "Failed to search TikTok videos"
    });
  }
});

module.exports = {
  path: "/api/tiktok",
  name: "TikTok Search API",
  type: "get/post",
  url: `${global.t || "http://localhost:3000"}/api/tiktok/search?query=dance&offset=0`,
  logo: "https://upload.wikimedia.org/wikipedia/en/a/a9/TikTok_logo.svg",
  category: "social",
  info: "Search TikTok videos by keywords with detailed metadata and statistics",
  router
};

