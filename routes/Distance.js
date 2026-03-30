const express = require("express");
const axios = require("axios");
const moment = require("moment-timezone");

const router = express.Router();

const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive"
};

async function getCountryData(country) {
    try {
        const geoRes = await axios.get("https://nominatim.openstreetmap.org/search", {
            params: { q: country, format: "json", limit: 1 },
            headers
        });

        if (!geoRes.data.length) {
            return null;
        }

        const { lat, lon, display_name } = geoRes.data[0];

        const countryRes = await axios.get(
            `https://restcountries.com/v3.1/name/${encodeURIComponent(country)}?fullText=true`,
            { headers }
        );

        if (!countryRes.data.length) {
            return null;
        }

        const countryInfo = countryRes.data[0];

        let timezone = countryInfo.timezones ? countryInfo.timezones[0] : "غير متوفر";
        let currentTime = "غير متوفر";

        try {
            if (timezone !== "غير متوفر") {
                currentTime = moment().tz(timezone).format("YYYY-MM-DD HH:mm:ss");
            }
        } catch (error) {
            timezone = "غير متوفر";
        }

        let weather = "غير متوفر";
        let temperature = "غير متوفر";

        try {
            const weatherRes = await axios.get(`https://wttr.in/${country}?format=%C+%t`, {
                headers: {
                    ...headers,
                    "Accept": "text/plain"
                },
                timeout: 5000
            });
            const weatherData = weatherRes.data.split(" ");
            weather = weatherData[0] || "غير متوفر";
            temperature = weatherData[1] || "غير متوفر";
        } catch (e) {}

        return {
            name: display_name,
            lat: parseFloat(lat),
            lon: parseFloat(lon),
            flag: `https://flagcdn.com/w320/${countryInfo.cca2.toLowerCase()}.png`,
            capital: countryInfo.capital ? countryInfo.capital[0] : "غير متوفر",
            population: countryInfo.population?.toLocaleString() || "غير متوفر",
            area: countryInfo.area ? countryInfo.area.toLocaleString() + " كم²" : "غير متوفر",
            currency: Object.values(countryInfo.currencies || {})[0]?.name || "غير متوفر",
            language: Object.values(countryInfo.languages || {})[0] || "غير متوفر",
            timezone,
            currentTime,
            weather: { description: weather, temperature },
            callingCode: countryInfo.idd?.root
                ? `${countryInfo.idd.root}${countryInfo.idd.suffixes ? countryInfo.idd.suffixes[0] : ""}`
                : "غير متوفر",
            wiki: `https://en.wikipedia.org/wiki/${encodeURIComponent(country)}`,
            map: `https://www.google.com/maps/@${lat},${lon},6z`
        };

    } catch (error) {
        return null;
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(2) + " km";
}

router.get("/distance", async (req, res) => {
    try {
        const { country1, country2 } = req.query;

        if (!country1 || !country2) {
            return res.status(400).json({
                status: false,
                error: "يرجى تقديم اسم البلدين باستخدام ?country1= و ?country2="
            });
        }

        const [data1, data2] = await Promise.all([
            getCountryData(country1),
            getCountryData(country2)
        ]);

        if (!data1) {
            return res.status(404).json({
                status: false,
                error: `تعذر العثور على بيانات الدولة: ${country1}`
            });
        }

        if (!data2) {
            return res.status(404).json({
                status: false,
                error: `تعذر العثور على بيانات الدولة: ${country2}`
            });
        }

        const distance = calculateDistance(data1.lat, data1.lon, data2.lat, data2.lon);

        return res.status(200).json({
            status: true,
            country1: data1,
            country2: data2,
            distance
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            error: "حدث خطأ داخلي. حاول مرة أخرى لاحقًا."
        });
    }
});

module.exports = {
    path: "/api/country-distance",
    name: "Country Distance Calculator",
    type: "get",
    url: `${global.t || "http://localhost:3000"}/api/country-distance/distance?country1=Egypt&country2=France`,
    logo: "https://files.catbox.moe/2tt1xy.jpg",
    category: "ai",
    info: "🌍 احسب المسافة بين أي دولتين في العالم مع عرض معلومات شاملة: العاصمة، السكان، العملة، اللغة، الطقس، التوقيت المحلي، ورمز الاتصال",
    router
};

