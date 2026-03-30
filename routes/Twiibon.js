const express = require("express");
const axios = require("axios");

const router = express.Router();

const BASE = {
  api: "https://api.twibbonize.com/v2",
  frame: "https://frame.cdn.twibbonize.com",
  campaign: "https://campaign.cdn.twibbonize.com",
  avatar: "https://campaign.cdn.twibbonize.com"
};

const HEADERS = {
  accept: "application/json, text/plain, */*",
  "accept-language": "id-ID",
  "accept-encoding": "gzip, deflate, br",
  "cache-control": "no-cache",
  origin: "https://www.twibbonize.com",
  pragma: "no-cache",
  referer: "https://www.twibbonize.com/",
  "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
  connection: "keep-alive"
};

class Twibbonize {
  constructor() {
    this.client = axios.create({
      baseURL: BASE.api,
      headers: HEADERS
    });
  }

  parseAvatar(av) {
    return av ? `${BASE.avatar}/${av}` : null;
  }

  parseThumb(th) {
    return th ? `${BASE.campaign}/${th}` : null;
  }

  parseFrames(frames = []) {
    return frames.map(f => `${BASE.frame}/${f}`);
  }

  parseCampaign(c) {
    return {
      ...c,
      thumbnail: this.parseThumb(c?.thumbnail),
      campaignCreator: c?.campaignCreator ? {
        ...c.campaignCreator,
        avatar: this.parseAvatar(c.campaignCreator?.avatar)
      } : null
    };
  }

  async detail(url) {
    try {
      const res = await this.client.get(`/campaign/${url}`);
      const d = res?.data?.data;
      const campaign = this.parseCampaign(d?.campaign || {});
      const modules = (d?.modules || []).map(m => ({
        ...m,
        data: {
          ...m?.data,
          frames: this.parseFrames(m?.data?.frames || [])
        }
      }));

      return {
        ...d,
        campaign: campaign,
        modules: modules
      };
    } catch (e) {
      throw new Error(`Detail fetch failed: ${e?.message}`);
    }
  }

  async search({ query, limit = 5, detail = true, ...rest }) {
    try {
      const res = await this.client.get("/campaign/search", {
        params: {
          sort: "support",
          page: 1,
          numItems: 30,
          reactive: 1,
          keyword: query,
          category: "FRM,BKG",
          ...rest
        }
      });

      const raw = res?.data?.data?.campaigns || [];
      const total = res?.data?.data?.total || 0;
      let campaigns = raw.map(c => this.parseCampaign(c));

      if (detail) {
        const detailed = [];
        let count = 0;
        for (const c of campaigns) {
          if (count >= limit) break;
          const d = await this.detail(c?.url);
          detailed.push(d ? { ...c, ...d } : c);
          count++;
        }
        campaigns = detailed;
      } else {
        campaigns = campaigns.slice(0, limit);
      }

      return {
        status: true,
        total: total,
        count: campaigns.length,
        campaigns: campaigns
      };
    } catch (e) {
      throw new Error(`Search failed: ${e?.message}`);
    }
  }
}

router.get("/search", async (req, res) => {
  try {
    const { q, limit, detail } = req.query;

    if (!q) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: q"
      });
    }

    const api = new Twibbonize();
    const data = await api.search({
      query: q,
      limit: parseInt(limit) || 5,
      detail: detail !== "false"
    });

    if (!data) {
      return res.status(404).json({
        status: false,
        error: "No results found"
      });
    }

    return res.status(200).json({
      status: true,
      query: q,
      total: data.total,
      count: data.count,
      campaigns: data.campaigns
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message
    });
  }
});

router.get("/detail", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        status: false,
        error: "Missing required parameter: url"
      });
    }

    const api = new Twibbonize();
    const data = await api.detail(url);

    if (!data) {
      return res.status(404).json({
        status: false,
        error: "Campaign not found"
      });
    }

    return res.status(200).json({
      status: true,
      url: url,
      data: data
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message
    });
  }
});

module.exports = {
  path: "/api/twibbonize",
  name: "Twibbonize Campaign Search",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/twibbonize/search?q=event`,
  logo: "https://www.twibbonize.com/favicon.ico",
  category: "search",
  info: "Search and get details of Twibbonize photo frame campaigns",
  router
};

