const express = require("express");
const axios = require("axios");

const router = express.Router();

class FlacAPI {
 constructor() {
   this.cfg = {
     baseURL: "https://flac-tg-a67a86d7badb.herokuapp.com/api",
     timeout: 60000,
     headers: {
       Accept: "*/*",
       "Accept-Language": "id-ID",
       "Content-Type": "application/json",
       "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
     },
     services: ["tidal", "qobuz", "amazon", "deezer"],
     qualities: ["HI_RES_LOSSLESS", "LOSSLESS", "HIGH"],
     defaultLimit: 20
   };
   this.client = axios.create({
     baseURL: this.cfg.baseURL,
     timeout: this.cfg.timeout,
     headers: this.cfg.headers
   });
 }

 validate(params, required = []) {
   const missing = required.filter(k => !params?.[k]);
   if (missing.length > 0) throw new Error(`Missing: ${missing.join(", ")}`);
   return true;
 }

 async search({ q, source = "spotify", limit, ...rest }) {
   this.validate({ q: q }, ["q"]);
   const trackLimit = limit || this.cfg.defaultLimit;
   
   const searchRes = await this.client.get("/search", {
     params: {
       q: q,
       source: source,
       track_limit: trackLimit,
       ...rest
     }
   });

   const tracks = searchRes?.data?.data?.tracks || [];
   
   if (tracks.length === 0) {
     return {
       success: false,
       tracks: []
     };
   }

   const firstTrack = tracks[0];
   const spotifyId = firstTrack?.spotify_id || firstTrack?.id;
   let metadata = null;

   if (spotifyId) {
     try {
       const url = source === "deezer" 
         ? `https://www.deezer.com/track/${spotifyId.replace("deezer:", "")}` 
         : `https://open.spotify.com/track/${spotifyId}`;
       
       const metaRes = await this.client.get("/metadata", {
         params: { url: url }
       });
       metadata = metaRes?.data?.data || null;
     } catch (error) {
       // Metadata fetch skipped silently
     }
   }

   return {
     success: true,
     tracks: tracks,
     metadata: metadata,
     source: source,
     count: tracks.length
   };
 }

 async download({ track, url, service, quality, ...rest }) {
   let trackData = null;
   let isrc = null;
   let deezerId = null;
   let spotifyId = null;

   if (url) {
     this.validate({ url: url }, ["url"]);
     const metaRes = await this.client.get("/metadata", {
       params: { url: url }
     });
     trackData = metaRes?.data?.data?.track;
     if (!trackData) throw new Error("Track not found from URL");
     isrc = trackData.isrc;
     spotifyId = trackData.spotify_id;
     deezerId = spotifyId?.startsWith("deezer:") ? spotifyId.replace("deezer:", "") : null;
   } else if (track) {
     trackData = track;
     isrc = track.isrc;
     spotifyId = track.spotify_id || track.id;
     deezerId = spotifyId?.startsWith("deezer:") ? spotifyId.replace("deezer:", "") : null;
   } else {
     throw new Error("Provide track object or url");
   }

   const availParams = {};
   if (spotifyId && !spotifyId.startsWith("deezer:")) availParams.spotify_id = spotifyId;
   if (isrc) availParams.isrc = isrc;
   if (deezerId) availParams.deezer_id = deezerId;

   const availRes = await this.client.get("/availability", {
     params: availParams
   });

   const availability = availRes?.data?.data || {};
   const availServices = this.cfg.services.filter(s => availability[s]);
   let selectedService = service || availServices[0] || "tidal";

   if (!availability[selectedService]) {
     selectedService = availServices[0] || "tidal";
   }

   const payload = {
     track_name: trackData.name || trackData.title,
     artist_name: trackData.artists || trackData.artist,
     album_name: trackData.album_name || trackData.album,
     album_artist: trackData.album_artist || trackData.artists || trackData.artist,
     cover_url: trackData.images || trackData.cover_url,
     spotify_id: spotifyId,
     isrc: isrc,
     service: selectedService,
     item_id: spotifyId,
     duration_ms: trackData.duration_ms,
     embed_lyrics: true,
     embed_max_quality_cover: true,
     quality: quality || this.cfg.qualities[0],
     ...rest
   };

   const downloadRes = await this.client.post("/download", payload);
   const result = downloadRes?.data?.data || {};

   let fileURL = null;
   if (result?.file_path) {
     const fileName = result.file_path.split("/").pop();
     fileURL = `${this.cfg.baseURL}/files/${encodeURIComponent(fileName)}`;
   }

   return {
     success: result?.success || false,
     message: result?.message || "Download completed",
     file: {
       path: result?.file_path,
       url: fileURL,
       name: result?.file_path?.split("/")?.pop()
     },
     audio: {
       bitDepth: result?.actual_bit_depth,
       sampleRate: result?.actual_sample_rate,
       service: result?.service || selectedService
     },
     track: {
       name: payload.track_name,
       artist: payload.artist_name,
       album: payload.album_name
     },
     availability: availability,
     alreadyExists: result?.already_exists || false
   };
 }
}

router.get("/search", async (req, res) => {
 try {
   const { q, source, limit } = req.query;

   if (!q) {
     return res.status(400).json({
       status: false,
       error: "Missing required parameter: q"
     });
   }

   const api = new FlacAPI();
   const result = await api.search({ q, source, limit });

   return res.status(200).json({
     status: true,
     ...result
   });

 } catch (error) {
   return res.status(500).json({
     status: false,
     error: error.message
   });
 }
});

router.get("/download", async (req, res) => {
 try {
   const { url, service, quality } = req.query;

   if (!url) {
     return res.status(400).json({
       status: false,
       error: "Missing required parameter: url"
     });
   }

   const api = new FlacAPI();
   const result = await api.download({ url, service, quality });

   return res.status(200).json({
     status: true,
     ...result
   });

 } catch (error) {
   return res.status(500).json({
     status: false,
     error: error.message
   });
 }
});

router.post("/download", async (req, res) => {
 try {
   const { track, service, quality } = req.body;

   if (!track) {
     return res.status(400).json({
       status: false,
       error: "Missing required parameter: track"
     });
   }

   const api = new FlacAPI();
   const result = await api.download({ track, service, quality });

   return res.status(200).json({
     status: true,
     ...result
   });

 } catch (error) {
   return res.status(500).json({
     status: false,
     error: error.message
   });
 }
});

module.exports = {
 path: "/api/flac",
 name: "FLAC Music Downloader",
 type: "get",
 url: `${global.t || "http://localhost:3000"}/api/flac/search?q=hello`,
 logo: "https://open.spotify.com/favicon.ico",
 category: "download",
 info: "Search and download high-quality FLAC music from Tidal, Qobuz, Amazon, and Deezer",
 router
};

