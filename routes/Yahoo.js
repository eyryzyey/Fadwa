const express = require("express");

const axios = require("axios");

const cheerio = require("cheerio");

const router = express.Router();

async function fetchYahooResults(query) {

    try {

        const yahooURL = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`;

        const { data } = await axios.get(yahooURL);

        const $ = cheerio.load(data);

        let results = [];

        $("ol.reg.searchCenterMiddle > li").each((index, element) => {

            let titleElement = $(element).find("h3.title a");

            let title = titleElement.text().trim();

            let link = titleElement.attr("href");

            let snippet = $(element).find("div.compText p").text().trim();

            let favicon = $(element).find("a.thmb.algo-favicon img").attr("src");

            results.push({ title, link, snippet, favicon });

        });

        return { search_results: results };

    } catch (error) {

        console.error("Error fetching Yahoo search results:", error);

        return { error: "Failed to fetch search results" };

    }

}

// **API Route**

router.get("/yahoo", async (req, res) => {

    const { q } = req.query;

    if (!q) {

        return res.status(400).json({ error: "Missing 'q' parameter" });

    }

    const results = await fetchYahooResults(q);

    res.json(results);

});

module.exports = {

    path: '/api/search',
    name: 'yahoo',
    type: 'search',
    url: `${global.t}/api/search/yahoo?q=morocco`,
    logo: 'https://g.top4top.io/p_33532rqnm0.jpg',

    router,

};
