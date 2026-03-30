const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/plain, application/json, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive"
};

async function getWeather(city) {
    try {
        const response = await axios.get(`https://wttr.in/${city}?format=%C+%t`, {
            headers,
            timeout: 10000
        });
        
        const weatherData = response.data.trim().split(" ");
        
        return {
            city,
            weather: weatherData[0] || "غير متوفر",
            temperature: weatherData[1] || "غير متوفر"
        };
    } catch (error) {
        return null;
    }
}

router.get("/weather", async (req, res) => {
    try {
        const { city } = req.query;

        if (!city) {
            return res.status(400).json({
                status: false,
                error: "يرجى تقديم اسم المدينة باستخدام ?city="
            });
        }

        const data = await getWeather(city);

        if (!data) {
            return res.status(500).json({
                status: false,
                error: "حدث خطأ أثناء جلب الطقس. حاول مرة أخرى لاحقًا."
            });
        }

        return res.status(200).json({
            status: true,
            results: data
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            error: "حدث خطأ داخلي. حاول مرة أخرى لاحقًا."
        });
    }
});

module.exports = {
    path: "/api/weather",
    name: "Weather API",
    type: "get",
    url: `${global.t || "http://localhost:3000"}/api/weather/weather?city=Riyadh`,
    logo: "https://files.catbox.moe/j5vt6s.jpg",
    category: "tools",
    info: "🌤️ احصل على حالة الطقس ودرجة الحرارة لأي مدينة في العالم بشكل فوري",
    router
};

