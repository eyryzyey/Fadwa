const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const FormData = require("form-data");

const router = express.Router();

class Luluvdo {
  constructor() {
    this.headers = {
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      Referer: "https://luluvid.com/",
      Connection: "keep-alive"
    };
    this.proxies = [
      "https://cors.luckydesigner.workers.dev/?",
      "https://cors.vaportrade.net/",
      "https://cors.eu.org/"
    ];
  }

  async download({ url, output = "json" }) {
    const idMatch = url.match(/(?:\/[de])\/([a-zA-Z0-9_-]+)/);
    const id = idMatch?.[1];
    if (!id) {
      throw new Error("Invalid URL: ID not found");
    }

    const client = axios.create({
      headers: this.headers,
      withCredentials: true,
      timeout: 15000
    });

    const availableProxies = [...this.proxies].sort(() => 0.5 - Math.random());

    for (const proxyUrl of availableProxies) {
      try {
        const formLink = `https://luluvid.com/d/${id}_h`;
        const getResponse = await client.get(`${proxyUrl}${formLink}`, {
          headers: this.headers
        });

        const $ = cheerio.load(getResponse.data);
        const formResult = new FormData();
        const formFields = {};

        $("form#F1 input, Form#F1 input").each((_, el) => {
          const name = $(el).attr("name");
          const value = $(el).attr("value") || $(el).val();
          if (name && value) {
            formResult.append(name, value);
            formFields[name] = value;
          }
        });

        if (!formFields.hash) {
          continue;
        }

        const postResponse = await client.post(`${proxyUrl}${formLink}`, formResult, {
          headers: {
            ...this.headers,
            ...formResult.getHeaders()
          }
        });

        const postData = postResponse.data;
        if (postData.includes("g-recaptcha")) {
          continue;
        }

        const $$ = cheerio.load(postData);
        const result = {
          proxy_used: proxyUrl,
          size: $$("table tr:nth-child(1) td:nth-child(2)").text().trim() || "N/A",
          bytes: $$("table tr:nth-child(2) td:nth-child(2)").text().trim() || "N/A",
          ip: $$("table tr:nth-child(3) td:nth-child(2)").text().trim() || "N/A",
          link: $$("a.btn.btn-gradient.submit-btn").attr("href") || "N/A",
          expired: $$("div.text-center.text-danger").text().trim() || "N/A"
        };

        if (result.link && result.link !== "N/A") {
          let media = null;
          if (output === "file") {
            const { data: buffer, headers } = await client.get(result.link, {
              headers: {
                Referer: formLink,
                "X-Forwarded-For": result.ip
              },
              responseType: "arraybuffer"
            });
            media = {
              buffer: Buffer.from(buffer),
              contentType: headers["content-type"] || "application/octet-stream",
              fileName: result.link.split("/").pop() || "downloaded_file"
            };
            return { ...result, ...media };
          }
          return result;
        }
      } catch (error) {
        continue;
      }
    }
    throw new Error("Failed to download after trying all available proxies.");
  }
}

router.get("/download", async (req, res) => {
  try {
    const { url, output } = req.query;

    if (!url) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: url"
      });
    }

    if (!url.includes("lulu")) {
      return res.status(400).json({
        status: false,
        error: "Invalid URL. Only luluvid.com URLs are supported."
      });
    }

    const luluvdo = new Luluvdo();
    const result = await luluvdo.download({
      url: url,
      output: output || "json"
    });

    if (output === "file" && result.buffer) {
      res.setHeader("Content-Type", result.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${result.fileName}"`);
      return res.status(200).send(result.buffer);
    }

    return res.status(200).json({
      status: true,
      proxyUsed: result.proxy_used,
      size: result.size,
      bytes: result.bytes,
      ip: result.ip,
      downloadLink: result.link,
      expired: result.expired
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message
    });
  }
});

module.exports = {
  path: "/api/luluvdo",
  name: "Luluvdo Downloader",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/luluvdo/download?url=https://luluvid.com/d/abc123`,
  logo: "https://luluvid.com/favicon.ico",
  category: "download",
  info: "Download videos from Luluvid with proxy fallback support",
  router
};
