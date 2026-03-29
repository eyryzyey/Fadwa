const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const { lookup } = require("mime-types");

const router = express.Router();

// Classe principale pour gérer les téléchargements Mega.nz
class MegaDL {
  constructor() {
    this.a = axios.create({
      timeout: 60000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Cache-Control": "no-cache"
      }
    });
  }

  // Récupérer les informations du fichier
  async i(u) {
    console.log("info →", u);
    
    // Validation et extraction de l'ID et de la clé depuis l'URL
    const m = u.match(/mega\.nz\/(?:#!|file\/)([a-zA-Z0-9_-]+)[!#]([a-zA-Z0-9_-]+)/);
    if (!m) throw new Error("Invalid Mega.nz URL format");
    
    const [, id, k] = m;
    
    // Appel API Mega pour obtenir les infos du fichier
    const { data } = await this.a.post(
      "https://g.api.mega.co.nz/cs",
      [{
        a: "g",
        g: 1,
        ssl: 2,
        v: 2,
        p: id
      }],
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
    
    const f = data[0] ?? null;
    if (!f?.at) throw new Error("File not found or access denied");
    
    // Décodage de la clé de chiffrement
    const kb = Buffer.from(
      k.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - k.length % 4) % 4),
      "base64"
    );
    
    const ka = Array.from(
      { length: Math.ceil(kb.length / 4) },
      (_, i) => kb.readUInt32BE(i * 4)
    );
    
    const fk = ka.length === 8 
      ? [ka[0] ^ ka[4], ka[1] ^ ka[5], ka[2] ^ ka[6], ka[3] ^ ka[7]] 
      : ka.slice(0, 4);
    
    const kbuf = Buffer.alloc(16);
    fk.forEach((v, i) => kbuf.writeUInt32BE(v >>> 0, i * 4));
    
    // Décryptage des attributs du fichier
    const ea = Buffer.from(
      f.at.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - f.at.length % 4) % 4),
      "base64"
    );
    
    const d = crypto.createDecipheriv("aes-128-cbc", kbuf, Buffer.alloc(16, 0));
    d.setAutoPadding(false);
    const dec = Buffer.concat([d.update(ea), d.final()]);
    const attr = dec.toString("utf8").replace(/\0+$/, "");
    
    const meta = attr.startsWith("MEGA{") 
      ? JSON.parse(attr.slice(4)) 
      : { n: "Unknown" };
    
    const ext = meta.n?.split(".").pop()?.toLowerCase() ?? "";
    
    // Formatage de la taille du fichier
    const size = f.s === 0 
      ? "0 Bytes" 
      : (() => {
          const i = Math.floor(Math.log(f.s) / Math.log(1024));
          return `${(f.s / Math.pow(1024, i)).toFixed(2)} ${["Bytes", "KB", "MB", "GB", "TB"][i]}`;
        })();
    
    console.log("info ok →", { name: meta.n, size: size });
    
    return {
      fileId: id,
      fileName: meta.n ?? "Unknown",
      fileSize: size,
      fileSizeBytes: f.s,
      mimeType: lookup(ext) || null,
      downloadUrl: f.g
    };
  }

  // Télécharger ou récupérer les infos du fichier
  async download({ url, output = "json", ...rest }) {
    try {
      console.log("download →", url, { output: output });
      
      const info = await this.i(url);
      
      if (output === "json") {
        console.log("Validating download URL...");
        const head = await this.a.head(info.downloadUrl, rest);
        const contentLength = head.headers["content-length"] ?? null;
        
        console.log("JSON ready →", contentLength, "bytes");
        
        return {
          ...info,
          downloadUrlValid: !!contentLength,
          contentLength: contentLength ? parseInt(contentLength, 10) : null,
          timestamp: new Date().toISOString(),
          region: "ID",
          timezone: "WITA"
        };
      }
      
      console.log(`Fetching full file → ${info.fileName} (${info.fileSize})`);
      
      const res = await this.a.get(info.downloadUrl, {
        responseType: "arraybuffer",
        ...rest
      });
      
      const buf = Buffer.from(res.data);
      console.log("File downloaded →", buf.length, "bytes");
      
      if (output === "base64") {
        return {
          base64: buf.toString("base64"),
          info: info
        };
      }
      
      return {
        buffer: buf,
        info: info
      };
      
    } catch (e) {
      console.error("Download error →", e.message);
      throw new Error(e.message);
    }
  }
}

// Endpoint GET /info - Récupérer les informations du fichier
router.get("/info", async (req, res) => {
  try {
    const { url } = req.query;
    
    // Validation des paramètres
    if (!url) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'url' is required",
        example: `${global.t || "http://localhost:3000"}/api/mega-dl/info?url=https://mega.nz/file/xxxxx#xxxxx`
      });
    }
    
    // Validation du format URL Mega.nz
    if (!url.match(/mega\.nz\/(?:#!|file\/)([a-zA-Z0-9_-]+)[!#]([a-zA-Z0-9_-]+)/)) {
      return res.status(400).json({
        status: false,
        error: "Invalid Mega.nz URL format",
        format: "https://mega.nz/file/[FILE_ID]#[KEY] or https://mega.nz/#![FILE_ID]![KEY]"
      });
    }
    
    const api = new MegaDL();
    const info = await api.i(url);
    
    return res.status(200).json({
      status: true,
      data: info
    });
    
  } catch (error) {
    console.error("Error in /info:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Failed to retrieve file information"
    });
  }
});

// Endpoint GET /download - Télécharger ou obtenir les liens de téléchargement
router.get("/download", async (req, res) => {
  try {
    const { url, output = "json" } = req.query;
    
    // Validation des paramètres
    if (!url) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'url' is required",
        example: `${global.t || "http://localhost:3000"}/api/mega-dl/download?url=https://mega.nz/file/xxxxx#xxxxx&output=json`
      });
    }
    
    // Validation du format URL Mega.nz
    if (!url.match(/mega\.nz\/(?:#!|file\/)([a-zA-Z0-9_-]+)[!#]([a-zA-Z0-9_-]+)/)) {
      return res.status(400).json({
        status: false,
        error: "Invalid Mega.nz URL format",
        format: "https://mega.nz/file/[FILE_ID]#[KEY] or https://mega.nz/#![FILE_ID]![KEY]"
      });
    }
    
    // Validation du paramètre output
    const validOutputs = ["json", "base64", "buffer"];
    if (!validOutputs.includes(output)) {
      return res.status(400).json({
        status: false,
        error: "Invalid output parameter",
        validOptions: validOutputs,
        default: "json"
      });
    }
    
    const api = new MegaDL();
    const result = await api.download({ url, output });
    
    // Si output est buffer, on retourne les données binaires directement
    if (output === "buffer" && result.buffer) {
      res.setHeader("Content-Type", result.info.mimeType || "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${result.info.fileName}"`);
      return res.send(result.buffer);
    }
    
    // Pour json et base64, on retourne le JSON
    return res.status(200).json({
      status: true,
      data: result
    });
    
  } catch (error) {
    console.error("Error in /download:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Failed to process download request"
    });
  }
});

// Endpoint POST /download - Alternative pour les URLs longues
router.post("/download", async (req, res) => {
  try {
    const { url, output = "json" } = req.body;
    
    // Validation des paramètres
    if (!url) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'url' is required in request body",
        example: {
          url: "https://mega.nz/file/xxxxx#xxxxx",
          output: "json"
        }
      });
    }
    
    // Validation du format URL Mega.nz
    if (!url.match(/mega\.nz\/(?:#!|file\/)([a-zA-Z0-9_-]+)[!#]([a-zA-Z0-9_-]+)/)) {
      return res.status(400).json({
        status: false,
        error: "Invalid Mega.nz URL format",
        format: "https://mega.nz/file/[FILE_ID]#[KEY] or https://mega.nz/#![FILE_ID]![KEY]"
      });
    }
    
    // Validation du paramètre output
    const validOutputs = ["json", "base64", "buffer"];
    if (!validOutputs.includes(output)) {
      return res.status(400).json({
        status: false,
        error: "Invalid output parameter",
        validOptions: validOutputs,
        default: "json"
      });
    }
    
    const api = new MegaDL();
    const result = await api.download({ url, output });
    
    // Si output est buffer, on retourne les données binaires directement
    if (output === "buffer" && result.buffer) {
      res.setHeader("Content-Type", result.info.mimeType || "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${result.info.fileName}"`);
      return res.send(result.buffer);
    }
    
    // Pour json et base64, on retourne le JSON
    return res.status(200).json({
      status: true,
      data: result
    });
    
  } catch (error) {
    console.error("Error in POST /download:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Failed to process download request"
    });
  }
});

module.exports = {
  path: "/api/mega-dl",
  name: "Mega.nz Downloader",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/mega-dl/download?url=https://mega.nz/file/xxxxx#xxxxx`,
  logo: "https://mega.nz/favicon.ico",
  category: "download",
  info: "Extract file information and generate download links from Mega.nz URLs with decryption support",
  router
};

