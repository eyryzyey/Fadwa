const express = require("express");
const axios = require("axios");

const client_id = "acc6302297e040aeb6e4ac1fbdfd62c3";
const client_secret = "0e8439a1280a43aba9a5bc0a16f3f009";
const basic = Buffer.from(`${client_id}:${client_secret}`).toString("base64");
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";

const router = express.Router();

const toTime = (ms) => {
  let h = Math.floor(ms / 3600000);
  let m = Math.floor(ms / 60000) % 60;
  let s = Math.floor(ms / 1000) % 60;
  return [h, m, s].map((v) => v.toString().padStart(2, "0")).join(":");
};

async function spotifyCreds() {
  try {
    const response = await axios.post(
      TOKEN_ENDPOINT,
      "grant_type=client_credentials",
      {
        headers: {
          Authorization: "Basic " + basic,
        },
      }
    );
    return { status: true, data: response.data };
  } catch (error) {
    return { status: false, msg: "Failed to retrieve Spotify credentials." };
  }
}

router.get("/spotify", async (req, res) => {
  const { name } = req.query;

  if (!name) {
    return res.status(400).json({ error: "Name parameter is required" });
  }

  try {
    const creds = await spotifyCreds();
    if (!creds.status) return res.status(500).json({ error: creds.msg });

    const response = await axios.get(
      `https://api.spotify.com/v1/search?query=${encodeURIComponent(name)}&type=track&limit=20`,
      {
        headers: {
          Authorization: "Bearer " + creds.data.access_token,
        },
      }
    );

    const items = response.data.tracks?.items || [];
    if (items.length === 0) {
      return res.status(404).json({ msg: "Music not found!" });
    }

    const results = items.map((item) => ({
      title: item.name,
      id: item.id,
      duration: toTime(item.duration_ms),
      artist: item.artists.map((artist) => artist.name).join(" & "),
      url: item.external_urls.spotify,
    }));

    res.json({ status: true, results });
  } catch (error) {
    res.status(500).json({
      status: false,
      msg: "Error searching for music. " + error.message,
    });
  }
});

module.exports = {
  path: "/api/search",
  name: "SPOTIFY_SEARCH",
  type: "search",
  url: `${global.t}/api/search/spotify?name=example`,
  logo: "https://files.catbox.moe/0g12gb.jpg",
  router,
};
