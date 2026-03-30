const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const FormData = require("form-data");

const router = express.Router();

const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive"
};

async function getTokens() {
    const response = await axios.get("https://www.beautyscoretest.com/", { headers });
    const $ = cheerio.load(response.data);
    return {
        token: $('input[name="_token"]').val(),
        cookies: response.headers["set-cookie"]
    };
}

async function checkBeautyScore(imageUrl) {
    if (!imageUrl) throw new Error("الرجاء إرسال رابط صورة للتحليل");

    const { token, cookies } = await getTokens();

    const imageResponse = await axios.get(imageUrl, { 
        responseType: "arraybuffer",
        headers,
        timeout: 30000
    });
    const imageBuffer = Buffer.from(imageResponse.data);

    const form = new FormData();
    form.append("face", imageBuffer, "image.jpg");
    form.append("_token", token);

    const response = await axios.post("https://www.beautyscoretest.com/", form, {
        headers: {
            Origin: "https://www.beautyscoretest.com",
            Referer: "https://www.beautyscoretest.com/",
            Cookie: cookies.join("; "),
            ...form.getHeaders()
        },
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 303
    });

    let finalData = response.data;
    
    if (response.status === 302) {
        const redirect = response.headers.location;
        const redirectResponse = await axios.get(redirect, {
            headers: { 
                ...headers,
                Cookie: cookies.join("; ") 
            }
        });
        finalData = redirectResponse.data;
    }

    const $ = cheerio.load(finalData);
    
    const score = $(".entry__date-day").text().trim();
    const gender = $(".entry__meta-slack").text().split(":")[1]?.trim();
    const age = $(".entry__meta-pin").text().split(":")[1]?.trim();
    const expression = $(".entry__meta-facebook").text().split(":")[1]?.trim();
    const faceShape = $(".entry__meta-comments").text().split(":")[1]?.trim();

    if (!score) throw new Error("لم يتم تحديد الجمال");

    return {
        score,
        gender: gender || "غير متوفر",
        age: age || "غير متوفر",
        expression: expression || "غير متوفر",
        faceShape: faceShape || "غير متوفر"
    };
}

router.get("/beauty-score", async (req, res) => {
    try {
        const { imageUrl } = req.query;

        if (!imageUrl) {
            return res.status(400).json({
                status: false,
                error: "الرجاء إرسال رابط صورة للتحليل باستخدام ?imageUrl="
            });
        }

        const result = await checkBeautyScore(imageUrl);

        return res.status(200).json({
            status: true,
            results: result
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            error: error.message || "فشل التحليل، حاول مجدداً"
        });
    }
});

module.exports = {
    path: "/api/beauty-score",
    name: "Beauty Score",
    type: "get",
    url: `${global.t || "http://localhost:3000"}/api/beauty-score/beauty-score?imageUrl=https://example.com/image.jpg`,
    logo: "https://files.catbox.moe/0brsi5.jpg",
    category: "tools",
    info: "✨ حلل درجة جمال أي صورة شخصية واحصل على تقييم الذكاء الاصطناعي",
    router
};

