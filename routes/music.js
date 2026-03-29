const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const { FormData } = require("formdata-node");
const { Blob } = require("formdata-node");
const { CookieJar } = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");
const { fileTypeFromBuffer } = require("file-type");

const router = express.Router();

// Configuration
const CONFIG = {
  DOMAIN_URL: process.env.DOMAIN_URL || "localhost:3000",
  BASE_URL: "https://aplmusicdownloader.net/wp-admin/admin-ajax.php",
  REFERER: "https://aplmusicdownloader.net/"
};

class APLDownloader {
  constructor() {
    this.baseUrl = CONFIG.BASE_URL;
    this.uploadUrl = `https://${CONFIG.DOMAIN_URL}/api/tools/upload`;
    this.jar = new CookieJar();
    this.client = wrapper(
      axios.create({
        jar: this.jar,
        withCredentials: true,
        timeout: 60000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Connection": "keep-alive",
          "Upgrade-Insecure-Requests": "1",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "same-origin",
          "Cache-Control": "max-age=0"
        }
      })
    );
  }

  async download({ url }) {
    try {
      console.log("Creating form data...");
      const form = this.createForm(url);
      
      console.log("Sending POST request...");
      const response = await this.client.post(this.baseUrl, form, {
        headers: {
          ...form.headers,
          "Origin": "https://aplmusicdownloader.net",
          "Referer": CONFIG.REFERER,
          "X-Requested-With": "XMLHttpRequest"
        }
      });

      const data = response.data?.data?.data;
      if (!data) throw new Error("Invalid response from server");

      const redirectUrl = data["1"]?.redirect_url;
      if (!redirectUrl) throw new Error("Redirect URL not found in response");

      console.log("Redirect URL:", redirectUrl);
      console.log("Fetching HTML...");
      
      const html = await this.getHtml(redirectUrl);
      
      console.log("Extracting metadata from script...");
      const extracted = this.extractFromScript(html);
      
      if (!extracted?.output?.url) {
        throw new Error("Target URL not found in script data");
      }

      console.log("Target Media URL:", extracted.output.url);
      console.log("Following final redirect...");
      
      const finalUrl = await this.getFinalUrl(extracted.output.url);
      console.log("Final URL:", finalUrl);
      
      console.log("Downloading and uploading media...");
      const uploadResult = await this.uploadData(finalUrl);
      
      console.log("Upload successful");
      
      return {
        status: true,
        title: extracted.output.title || "Unknown",
        artist: extracted.output.artist || "Unknown",
        album: extracted.output.album || "Unknown",
        cover: extracted.output.cover || null,
        duration: extracted.output.duration || null,
        downloadUrl: finalUrl,
        uploaded: uploadResult
      };
      
    } catch (error) {
      console.error("Download process error:", error.message);
      throw error;
    }
  }

  createForm(url) {
    const form = new FormData();
    form.set("post_id", "8");
    form.set("form_id", "cdda83e");
    form.set("referer_title", "Apple Music Downloader - Convert & Download Music to MP3");
    form.set("queried_id", "8");
    form.set("form_fields[music_url]", url);
    form.set("action", "elementor_pro_forms_send_form");
    form.set("referrer", CONFIG.REFERER);
    return form;
  }

  async getHtml(url) {
    try {
      const { data } = await this.client.get(url, {
        headers: {
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Referer": CONFIG.REFERER
        }
      });
      return data;
    } catch (error) {
      console.error("Error fetching HTML:", error.message);
      throw new Error(`Failed to fetch HTML: ${error.message}`);
    }
  }

  extractFromScript(html) {
    try {
      const $ = cheerio.load(html);
      
      // Essayer plusieurs sélecteurs de fallback
      let script = $("#amd-script-js-extra").html();
      
      if (!script) {
        script = $("script").filter(function() {
          return $(this).html().includes("amdDownloadData");
        }).html();
      }
      
      if (!script) {
        // Chercher dans tous les scripts inline
        $("script").each((i, el) => {
          const content = $(el).html();
          if (content && content.includes("var amdDownloadData")) {
            script = content;
            return false;
          }
        });
      }

      if (!script) throw new Error("Script containing download data not found");

      const match = script.match(/var amdDownloadData = ({[\s\S]+?});/);
      if (!match) throw new Error("Could not parse download data from script");

      return JSON.parse(match[1]);
    } catch (error) {
      console.error("Error extracting script data:", error.message);
      return null;
    }
  }

  async getFinalUrl(url) {
    try {
      const res = await this.client.get(url, {
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400
      });
      
      // Si redirect, récupérer le header Location
      if (res.headers.location) return res.headers.location;
      
      // Sinon retourner l'URL finale de la réponse
      return res.request?.res?.responseUrl || url;
      
    } catch (error) {
      if (error.response && error.response.status >= 300 && error.response.status < 400) {
        return error.response.headers.location || url;
      }
      console.error("Error following redirect:", error.message);
      return url;
    }
  }

  async uploadBuffer(buffer, mimeType = "audio/mpeg", fileName = "audio.mp3") {
    try {
      const formData = new FormData();
      formData.append("file", new Blob([buffer], { type: mimeType }), fileName);
      
      const { data: uploadResponse } = await axios.post(this.uploadUrl, formData, {
        headers: {
          ...formData.headers,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        },
        timeout: 120000
      });
      
      if (!uploadResponse) {
        throw new Error("Upload failed: No response from server");
      }
      
      return uploadResponse;
    } catch (error) {
      if (error.response) {
        throw new Error(`Upload failed: Server responded with status ${error.response.status}`);
      } else if (error.request) {
        throw new Error("Upload failed: No response received from server");
      } else {
        throw new Error("Upload failed: " + error.message);
      }
    }
  }

  async uploadData(url) {
    try {
      const res = await this.client.get(url, {
        responseType: "arraybuffer",
        timeout: 120000,
        headers: {
          "Accept": "audio/mpeg,audio/*,*/*;q=0.9"
        }
      });
      
      const buffer = Buffer.from(res.data);
      
      if (buffer.length === 0) {
        throw new Error("Downloaded file is empty");
      }
      
      const type = await fileTypeFromBuffer(buffer);
      const mimeType = type?.mime || "audio/mpeg";
      const extension = type?.ext || "mp3";
      
      const upload = await this.uploadBuffer(buffer, mimeType, `audio.${extension}`);
      
      return {
        ...upload,
        originalSize: buffer.length,
        mimeType: mimeType
      };
      
    } catch (error) {
      console.error("Error uploading file:", error.message);
      throw error;
    }
  }
}

// Endpoint GET /download
router.get("/download", async (req, res) => {
  try {
    const { url } = req.query;
    
    // Validation des paramètres
    if (!url) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'url' is required",
        example: `${global.t || "http://localhost:3000"}/api/apple-music/download?url=https://music.apple.com/us/song/...`,
        usage: "Provide an Apple Music song URL to download"
      });
    }
    
    // Validation du format URL Apple Music
    const appleMusicRegex = /music\.apple\.com\/[a-z]{2}\/(?:song|album|playlist)\/[^/]+\/(\d+)/;
    if (!appleMusicRegex.test(url)) {
      return res.status(400).json({
        status: false,
        error: "Invalid Apple Music URL format",
        format: "https://music.apple.com/[country]/song/[song-name]/[id]",
        example: "https://music.apple.com/us/song/example/123456789"
      });
    }
    
    const apl = new APLDownloader();
    const result = await apl.download({ url });
    
    return res.status(200).json({
      status: true,
      data: result
    });
    
  } catch (error) {
    console.error("API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error",
      message: "Failed to process Apple Music download request"
    });
  }
});

// Endpoint POST /download (pour les URLs longues)
router.post("/download", async (req, res) => {
  try {
    const { url } = req.body;
    
    // Validation des paramètres
    if (!url) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'url' is required in request body",
        example: {
          url: "https://music.apple.com/us/song/example/123456789"
        }
      });
    }
    
    // Validation du format URL Apple Music
    const appleMusicRegex = /music\.apple\.com\/[a-z]{2}\/(?:song|album|playlist)\/[^/]+\/(\d+)/;
    if (!appleMusicRegex.test(url)) {
      return res.status(400).json({
        status: false,
        error: "Invalid Apple Music URL format",
        format: "https://music.apple.com/[country]/song/[song-name]/[id]"
      });
    }
    
    const apl = new APLDownloader();
    const result = await apl.download({ url });
    
    return res.status(200).json({
      status: true,
      data: result
    });
    
  } catch (error) {
    console.error("API Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error"
    });
  }
});

module.exports = {
  path: "/api/apple-music",
  name: "Apple Music Downloader",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/apple-music/download?url=https://music.apple.com/us/song/example/123456789`,
  logo: "https://music.apple.com/favicon.ico",
  category: "download",
  info: "Download Apple Music songs as MP3 files by providing a song URL",
  router
};

