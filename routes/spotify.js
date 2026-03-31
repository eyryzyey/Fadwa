const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

async function searchSong(query) {
  const url = `https://spotdown.org/api/song-details?url=${encodeURIComponent(query)}`;
  
  const headers = {
    accept: "application/json, text/plain, */*",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    referer: "https://spotdown.org/",
    origin: "https://spotdown.org"
  };

  const { data } = await axios.get(url, { headers });

  if (!data.songs || data.songs.length === 0) {
    throw new Error("No songs found");
  }

  return data.songs[0];
}

async function getDownloadUrl(songUrl) {
  const { data } = await axios.post(
    "https://spotdown.org/api/download",
    { url: songUrl },
    {
      headers: {
        accept: "application/json, text/plain, */*",
        "content-type": "application/json",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        referer: "https://spotdown.org/",
        origin: "https://spotdown.org"
      }
    }
  );

  return data;
}

router.get("/download", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== "string" || url.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Missing or invalid parameter: 'url' is required",
        example: "/api/spotify/download?url=https://open.spotify.com/track/1Yk0cQdMLx5RzzFTYwmuld"
      });
    }

    if (!url.includes("open.spotify.com")) {
      return res.status(400).json({
        status: false,
        error: "Invalid Spotify URL"
      });
    }

    const song = await searchSong(url.trim());

    return res.status(200).json({
      status: true,
      platform: "spotify",
      title: song.title,
      artist: song.artist,
      duration: song.duration || "Unknown",
      cover: song.cover || "",
      downloadUrl: song.url
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message || "Failed to download from Spotify"
    });
  }
});

module.exports = {
  path: "/api/spotify",
  name: "Spotify Downloader",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/spotify/download?url=https://open.spotify.com/track/1Yk0cQdMLx5RzzFTYwmuld`,
  logo: "https://cdn-icons-png.flaticon.com/512/174/174872.png",
  category: "download",
  info: "Download songs from Spotify",
  router
};

