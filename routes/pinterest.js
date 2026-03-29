const express = require("express");
const axios = require("axios");

const router = express.Router();

class PinterestAPI {
  constructor() {
    this.api = {
      base: "https://www.pinterest.com",
      endpoints: {
        search: "/resource/BaseSearchResource/get/",
        pin: "/resource/PinResource/get/",
        user: "/resource/UserResource/get/"
      }
    };
    
    this.headers = {
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Referer": "https://www.pinterest.com/",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "X-App-Version": "a1b2c3d4",
      "X-Pinterest-AppState": "active",
      "X-Pinterest-PWS-Handler": "www/[username]/[slug].js",
      "X-Pinterest-Source-Url": "/search/pins/?rs=typed&q=search/",
      "X-Requested-With": "XMLHttpRequest",
      "Connection": "keep-alive"
    };
    
    this.client = axios.create({
      baseURL: this.api.base,
      headers: this.headers,
      timeout: 30000
    });
    
    this.cookies = "";
    
    this.client.interceptors.response.use(
      response => {
        const setCookieHeaders = response.headers["set-cookie"];
        if (setCookieHeaders) {
          const newCookies = setCookieHeaders.map(cookieString => {
            const cp = cookieString.split(";");
            return cp[0].trim();
          });
          this.cookies = newCookies.join("; ");
          this.client.defaults.headers.cookie = this.cookies;
        }
        return response;
      },
      error => Promise.reject(error)
    );
  }

  isUrl(str) {
    try {
      new URL(str);
      return true;
    } catch (_) {
      return false;
    }
  }

  isPin(url) {
    if (!url) return false;
    const patterns = [
      /^https?:\/\/(?:www\.)?pinterest\.com\/pin\/[\w.-]+/,
      /^https?:\/\/(?:www\.)?pinterest\.[\w.]+\/pin\/[\w.-]+/,
      /^https?:\/\/(?:www\.)?pinterest\.(?:ca|co\.uk|com\.au|de|fr|id|es|mx|br|pt|jp|kr|nz|ru|at|be|ch|cl|dk|fi|gr|ie|nl|no|pl|se|th|tr)\/pin\/[\w.-]+/,
      /^https?:\/\/pin\.it\/[\w.-]+/,
      /^https?:\/\/(?:www\.)?pinterest\.com\/amp\/pin\/[\w.-]+/,
      /^https?:\/\/(?:[a-z]{2}|www)\.pinterest\.com\/pin\/[\w.-]+/,
      /^https?:\/\/(?:www\.)?pinterest\.com\/pin\/[\d]+(?:\/)?$/,
      /^https?:\/\/(?:www\.)?pinterest\.[\w.]+\/pin\/[\d]+(?:\/)?$/,
      /^https?:\/\/(?:www\.)?pinterestcn\.com\/pin\/[\w.-]+/,
      /^https?:\/\/(?:www\.)?pinterest\.com\.[\w.]+\/pin\/[\w.-]+/
    ];
    const clean = url.trim().toLowerCase();
    return patterns.some(pattern => pattern.test(clean));
  }

  async initCookies() {
    try {
      await this.client.get("/");
      return true;
    } catch (error) {
      console.error("Failed to initialize cookies:", error.message);
      return false;
    }
  }

  async search({ query, limit = 10 }) {
    if (!query) {
      throw new Error("Query parameter is required");
    }

    if (!this.cookies) {
      const success = await this.initCookies();
      if (!success) {
        throw new Error("Failed to initialize session cookies");
      }
    }

    const params = {
      source_url: `/search/pins/?q=${encodeURIComponent(query)}`,
      data: JSON.stringify({
        options: {
          isPrefetch: false,
          query: query,
          scope: "pins",
          bookmarks: [""],
          no_fetch_context_on_resource: false,
          page_size: Math.min(parseInt(limit) || 10, 50)
        },
        context: {}
      }),
      _: Date.now()
    };

    const { data } = await this.client.get(this.api.endpoints.search, { params });
    
    const results = data.resource_response?.data?.results || [];
    const filteredResults = results.filter(v => v.images?.orig);

    if (filteredResults.length === 0) {
      throw new Error(`No results found for "${query}"`);
    }

    const pins = filteredResults.map(result => ({
      id: result.id,
      title: result.title || "",
      description: result.description || "",
      pin_url: `https://pinterest.com/pin/${result.id}`,
      media: {
        images: {
          original: result.images.orig,
          small: result.images["236x"],
          medium: result.images["474x"],
          large: result.images["736x"]
        },
        video: result.videos ? {
          video_list: result.videos.video_list,
          duration: result.videos.duration,
          video_url: result.videos.video_url
        } : null
      },
      uploader: {
        username: result.pinner?.username || "unknown",
        full_name: result.pinner?.full_name || "",
        profile_url: result.pinner?.username ? `https://pinterest.com/${result.pinner.username}` : null
      }
    }));

    return {
      query: query,
      total: pins.length,
      pins: pins
    };
  }

  async download({ url: pinUrl }) {
    if (!pinUrl) {
      throw new Error("URL parameter is required");
    }

    if (!this.isUrl(pinUrl)) {
      throw new Error("Invalid URL format");
    }

    if (!this.isPin(pinUrl)) {
      throw new Error("Invalid Pinterest URL format");
    }

    const pinId = pinUrl.split("/pin/")[1]?.replace("/", "");
    if (!pinId) {
      throw new Error("Could not extract Pin ID from URL");
    }

    if (!this.cookies) {
      const success = await this.initCookies();
      if (!success) {
        throw new Error("Failed to initialize session cookies");
      }
    }

    const params = {
      source_url: `/pin/${pinId}/`,
      data: JSON.stringify({
        options: {
          field_set_key: "detailed",
          id: pinId
        },
        context: {}
      }),
      _: Date.now()
    };

    const { data } = await this.client.get(this.api.endpoints.pin, { params });
    const pd = data.resource_response?.data;

    if (!pd) {
      throw new Error("Pin not found or access denied");
    }

    const mediaUrls = [];

    if (pd.videos?.video_list) {
      const videoFormats = Object.values(pd.videos.video_list)
        .sort((a, b) => (b.width || 0) - (a.width || 0));
      
      videoFormats.forEach(video => {
        mediaUrls.push({
          type: "video",
          quality: `${video.width}x${video.height}`,
          width: video.width,
          height: video.height,
          duration: pd.videos.duration || null,
          url: video.url,
          file_size: video.file_size || null,
          thumbnail: pd.images?.orig?.url || null
        });
      });
    }

    if (pd.images) {
      const imageSizes = {
        original: pd.images.orig,
        large: pd.images["736x"],
        medium: pd.images["474x"],
        small: pd.images["236x"],
        thumbnail: pd.images["170x"]
      };

      Object.entries(imageSizes).forEach(([quality, image]) => {
        if (image?.url) {
          mediaUrls.push({
            type: "image",
            quality: quality,
            width: image.width,
            height: image.height,
            url: image.url,
            size: `${image.width}x${image.height}`
          });
        }
      });
    }

    if (mediaUrls.length === 0) {
      throw new Error("No downloadable media found for this pin");
    }

    return {
      id: pd.id,
      title: pd.title || pd.grid_title || "",
      description: pd.description || "",
      created_at: pd.created_at,
      dominant_color: pd.dominant_color || null,
      link: pd.link || null,
      category: pd.category || null,
      media_urls: mediaUrls,
      statistics: {
        saves: pd.repin_count || 0,
        comments: pd.comment_count || 0,
        reactions: pd.reaction_counts || {},
        total_reactions: pd.total_reaction_count || 0,
        views: pd.view_count || 0
      },
      source: {
        name: pd.domain || null,
        url: pd.link || null,
        favicon: pd.favicon_url || null,
        provider: pd.provider_name || null
      },
      board: {
        id: pd.board?.id || null,
        name: pd.board?.name || null,
        url: pd.board?.url ? `https://pinterest.com${pd.board.url}` : null,
        owner: {
          id: pd.board?.owner?.id || null,
          username: pd.board?.owner?.username || null
        }
      },
      uploader: {
        id: pd.pinner?.id || null,
        username: pd.pinner?.username || null,
        full_name: pd.pinner?.full_name || null,
        profile_url: pd.pinner?.username ? `https://pinterest.com/${pd.pinner.username}` : null,
        is_verified: pd.pinner?.verified_identity || false
      },
      is_video: pd.is_video || false,
      is_downloadable: pd.is_downloadable !== false
    };
  }

  async profile({ username }) {
    if (!username) {
      throw new Error("Username parameter is required");
    }

    if (!this.cookies) {
      const success = await this.initCookies();
      if (!success) {
        throw new Error("Failed to initialize session cookies");
      }
    }

    const params = {
      source_url: `/${username}/`,
      data: JSON.stringify({
        options: {
          username: username,
          field_set_key: "profile",
          isPrefetch: false
        },
        context: {}
      }),
      _: Date.now()
    };

    const { data } = await this.client.get(this.api.endpoints.user, { params });
    const userx = data.resource_response?.data;

    if (!userx) {
      throw new Error("User not found");
    }

    return {
      id: userx.id,
      username: userx.username,
      full_name: userx.full_name || "",
      bio: userx.about || "",
      email: userx.email || null,
      type: userx.type || "user",
      profile_url: `https://pinterest.com/${userx.username}`,
      image: {
        small: userx.image_small_url || null,
        medium: userx.image_medium_url || null,
        large: userx.image_large_url || null,
        original: userx.image_xlarge_url || null
      },
      stats: {
        pins: userx.pin_count || 0,
        followers: userx.follower_count || 0,
        following: userx.following_count || 0,
        boards: userx.board_count || 0,
        likes: userx.like_count || 0
      },
      website: userx.website_url || null,
      location: userx.location || null,
      country: userx.country || null,
      is_verified: userx.verified_identity || false,
      is_partner: userx.is_partner || false,
      social_links: {
        twitter: userx.twitter_url || null,
        facebook: userx.facebook_url || null,
        instagram: userx.instagram_url || null,
        youtube: userx.youtube_url || null,
        etsy: userx.etsy_url || null
      },
      interests: userx.interests || []
    };
  }
}

router.get("/search", async (req, res) => {
  try {
    const { query, limit = 10 } = req.query;

    if (!query) {
      return res.status(400).json({
        status: false,
        error: "Query parameter is required. Example: ?query=nature&limit=10"
      });
    }

    const pinterest = new PinterestAPI();
    const result = await pinterest.search({ query, limit });

    return res.status(200).json({
      status: true,
      ...result
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message || "Failed to search Pinterest"
    });
  }
});

router.get("/download", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        status: false,
        error: "URL parameter is required. Example: ?url=https://pinterest.com/pin/123456"
      });
    }

    const pinterest = new PinterestAPI();
    const result = await pinterest.download({ url });

    return res.status(200).json({
      status: true,
      ...result
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message || "Failed to download pin data"
    });
  }
});

router.get("/profile", async (req, res) => {
  try {
    const { username } = req.query;

    if (!username) {
      return res.status(400).json({
        status: false,
        error: "Username parameter is required. Example: ?username=john_doe"
      });
    }

    const pinterest = new PinterestAPI();
    const result = await pinterest.profile({ username });

    return res.status(200).json({
      status: true,
      ...result
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message || "Failed to fetch profile"
    });
  }
});

router.post("/search", async (req, res) => {
  try {
    const { query, limit = 10 } = req.body;

    if (!query) {
      return res.status(400).json({
        status: false,
        error: "Query is required in request body"
      });
    }

    const pinterest = new PinterestAPI();
    const result = await pinterest.search({ query, limit });

    return res.status(200).json({
      status: true,
      ...result
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message || "Failed to search Pinterest"
    });
  }
});

router.post("/download", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        status: false,
        error: "URL is required in request body"
      });
    }

    const pinterest = new PinterestAPI();
    const result = await pinterest.download({ url });

    return res.status(200).json({
      status: true,
      ...result
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message || "Failed to download pin data"
    });
  }
});

router.post("/profile", async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        status: false,
        error: "Username is required in request body"
      });
    }

    const pinterest = new PinterestAPI();
    const result = await pinterest.profile({ username });

    return res.status(200).json({
      status: true,
      ...result
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message || "Failed to fetch profile"
    });
  }
});

module.exports = {
  path: "/api/pinterest",
  name: "Pinterest API",
  type: "get/post",
  url: `${global.t || "http://localhost:3000"}/api/pinterest/search?query=nature`,
  logo: "https://upload.wikimedia.org/wikipedia/commons/0/08/Pinterest-logo.png",
  category: "social",
  info: "Search pins, download media, and fetch user profiles from Pinterest",
  router
};

