const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive"
};

router.get("/ssweb", async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({
                status: false,
                error: "يرجى تقديم رابط الموقع باستخدام ?url="
            });
        }

        const screenshotUrl = `https://mini.s-shot.ru/2560x1600/PNG/2560/Z100/?${encodeURIComponent(url)}`;

        return res.status(200).json({
            status: true,
            url: url,
            screenshotUrl: screenshotUrl
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            error: "حدث خطأ أثناء معالجة الطلب. حاول مرة أخرى لاحقًا."
        });
    }
});

module.exports = {
    path: "/api/ssweb",
    name: "Website Screenshot",
    type: "get",
    url: `${global.t || "http://localhost:3000"}/api/ssweb/ssweb?url=https://example.com`,
    logo: "https://l.top4top.io/p_3353capxa0.jpg",
    category: "tools",
    info: "📸 احصل على لقطة شاشة عالية الجودة لأي موقع ويب",
    router
};
