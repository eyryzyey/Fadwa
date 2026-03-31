const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

function formatDate(n, locale = "id") {
  let d = new Date(n);
  return d.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric"
  });
}

async function searchGitHub(query) {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}`;
  
  const headers = {
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "accept": "application/vnd.github.v3+json",
    "accept-language": "en-US,en;q=0.9",
    "accept-encoding": "gzip, deflate, br",
    "referer": "https://github.com/",
    "origin": "https://github.com"
  };

  const { data } = await axios.get(url, { headers });

  if (!data.items || data.items.length === 0) {
    throw new Error("No repositories found");
  }

  return data.items.map((repo) => ({
    fullName: repo.full_name,
    htmlUrl: repo.html_url,
    cloneUrl: repo.clone_url,
    isFork: repo.fork,
    owner: repo.owner.login,
    createdAt: formatDate(repo.created_at),
    updatedAt: formatDate(repo.updated_at),
    watchers: repo.watchers,
    forks: repo.forks,
    stars: repo.stargazers_count,
    openIssues: repo.open_issues,
    description: repo.description || "",
    language: repo.language || "Unknown"
  }));
}

router.get("/search", async (req, res) => {
  try {
    const { q, query } = req.query;

    const searchQuery = q || query;

    if (!searchQuery || typeof searchQuery !== "string" || searchQuery.trim().length === 0) {
      return res.status(400).json({
        status: false,
        error: "Missing or invalid parameter: 'q' or 'query' is required",
        example: "/api/github/search?q=nodejs"
      });
    }

    const results = await searchGitHub(searchQuery.trim());

    return res.status(200).json({
      status: true,
      query: searchQuery.trim(),
      total: results.length,
      results: results
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message || "Failed to search GitHub"
    });
  }
});

module.exports = {
  path: "/api/github",
  name: "GitHub Repository Search",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/github/search?q=nodejs`,
  logo: "https://cdn-icons-png.flaticon.com/512/733/733553.png",
  category: "search",
  info: "Search for repositories on GitHub",
  router
};

