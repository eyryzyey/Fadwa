const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

class UptodownHelper {
  static getHeaders() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1"
    };
  }

  static async scrape(url) {
    const { data: html } = await axios.get(url, {
      headers: this.getHeaders(),
      timeout: 30000
    });

    const $ = cheerio.load(html);

    const titleText = $("section.info h2.title").text().trim();

    const getTextByTh = (label) => {
      const selectors = [
        `section.info th:contains("${label}")`,
        `th:contains("${label}")`,
        `.info th:contains("${label}")`
      ];
      
      for (const selector of selectors) {
        const text = $(selector).next("td").text().trim();
        if (text) return text;
      }
      return "N/A";
    };

    const nama_aplikasi = titleText.replace(/^Informasi tentang\s*/i, "").trim();
    const versi = nama_aplikasi.match(/\d+(\.\d+){0,2}/)?.[0] || "N/A";
    const nama_paket = getTextByTh("Nama Paket");
    const lisensi = getTextByTh("Lisensi");
    const sistem_operasi = getTextByTh("Sistem Op.");
    
    const kategoriSelectors = [
      `section.info th:contains("Kategori")`,
      `th:contains("Kategori")`,
      `.info th:contains("Kategori")`
    ];
    let kategori = "N/A";
    for (const selector of kategoriSelectors) {
      kategori = $(selector).next("td").text().trim();
      if (kategori) break;
    }

    const bahasaSelectors = [
      `section.info th:contains("Bahasa")`,
      `th:contains("Bahasa")`,
      `.info th:contains("Bahasa")`
    ];
    let bahasa = "N/A";
    for (const selector of bahasaSelectors) {
      bahasa = $(selector).next("td").text().trim();
      if (bahasa) break;
    }

    const penerbitSelectors = [
      `section.info th:contains("Penerbit")`,
      `th:contains("Penerbit")`,
      `.info th:contains("Penerbit")`
    ];
    let penerbit = "N/A";
    for (const selector of penerbitSelectors) {
      penerbit = $(selector).next("td").text().trim();
      if (penerbit) break;
    }

    const ukuran = getTextByTh("Ukuran");
    const unduhan = getTextByTh("Unduhan");
    const tanggal = getTextByTh("Tanggal");

    const dataUrlSelectors = [
      "#detail-download-button",
      ".download-button",
      "[data-url]",
      "button[data-url]"
    ];
    
    let dataUrl = null;
    for (const selector of dataUrlSelectors) {
      dataUrl = $(selector).attr("data-url")?.trim();
      if (dataUrl) break;
    }

    let downloadLink = "Not Available";
    if (dataUrl && nama_aplikasi && versi) {
      const appNameSlug = nama_aplikasi
        .replace(/\d+(\.\d+){0,2}/, "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      const versionSlug = versi.replace(/\./g, "-");
      downloadLink = `https://dw.uptodown.net/dwn/${dataUrl}/${appNameSlug}-${versionSlug}.apk`;
    }

    return {
      title: titleText,
      nama_aplikasi,
      versi,
      nama_paket,
      lisensi,
      sistem_operasi,
      kategori,
      bahasa,
      penerbit,
      ukuran,
      unduhan,
      tanggal,
      download_link: downloadLink
    };
  }
}

router.get("/scrape", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: url",
        example: "/api/uptodown/scrape?url=https://facebook-lite.en.uptodown.com/android/download"
      });
    }

    if (!url.includes("uptodown.com")) {
      return res.status(400).json({
        status: false,
        error: "Invalid Uptodown URL"
      });
    }

    const result = await UptodownHelper.scrape(url);

    if (result.download_link === "Not Available") {
      return res.status(404).json({
        status: false,
        error: "Could not find a valid download link"
      });
    }

    return res.status(200).json({
      status: true,
      app: result
    });

  } catch (error) {
    console.error("Uptodown Error:", error.message);
    return res.status(500).json({
      status: false,
      error: error.message || "Internal server error"
    });
  }
});

module.exports = {
  path: "/api/uptodown",
  name: "Uptodown APK Scraper",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/uptodown/scrape?url=https://facebook-lite.en.uptodown.com/android/download`,
  logo: "https://en.uptodown.com/favicon.ico",
  category: "download",
  info: "Scrape APK download links from Uptodown",
  router
};

