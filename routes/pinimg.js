const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

// Headers احترافية
const defaultHeaders = {
  "User-Agent": "Mozilla/5.0 (Linux; Android 16; SM-A075F Build/BP2A.250605.031.A3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.7680.119 Mobile Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Language": "fr-FR,fr;q=0.9,ar-MA;q=0.8,ar;q=0.7,en-US;q=0.6,en;q=0.5",
  "Accept-Encoding": "gzip, deflate, br",
  "DNT": "1",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-User": "?1",
  "Sec-Fetch-Dest": "document",
  "Referer": "https://www.google.com/",
  "Cookie": "csrftoken=5b1cac6539433954c7762a5b24c53c42; _b=\"AZLfO1WpkLtNrriiX4XZxs9haoIeSLsmcDR9ZRJn4Z/b5ggBiIw+7KO4JXcKIltSRAk=\"; _auth=1; _pinterest_sess=TWc9PSZvZWgzQVVUWll1eUlWYTJuUWxualJ0NTNrdzlicEJsNlZWbUZUbjZRMGU4bVBoWSs1Wnp1cFhub0x4MWlUYXloRGRrUCtKSDFURGp3NmlLajladVJONm8ycHBTblBFZXN4c0VyZzVDU3BYMFJxZnZtV3JUeU0vV2U1YUFQMm5OTlZRV2k2Ky95MDlYb0xhSUdzN0owbHZuU1VxeHNVdDNwRzdVNE5RZ21iTWlvUFpaemdURmdHWFg3WHRFTkU5andjR1gycXR2OWc4cEpXMUdrZXRJTFFyMkpFY0NXU3BXcC9aaXVMaGQ4dndqaWtKcjNsOWtrSmJyN2NLei9WVmpYUTcxYjdpL2FjNFVNRW90RStoZktTWVBJMUFLbkRFdDBsSzRhbyt5ak52L1ZlNyt6dm9Sd0Y5ZWN3N1YyenVlbkVOWXJ1QXRkU1pBRU9mcjZvWGRqTXA0QkQ4MDYxUlg2NCtKMnNWZ2txVVhpRU5lMk9TL0FwYjVKZnpZUGRZeXBtVlF0RnFhazNLTjhab0lHVmtmUkJDOExBaWhXVmhYNklyTU02MzZabWVXWXZBZCtudlJwdUtxRWtFeDNwTjh4cXpGWlQzNEYrNGVtYlVTNHg0VzEwdkM0d1dFV1FiUUQxZ0dhWnJiR083R1dCM21HZG9NNDMwaDV1SDNyckhVOE9BNzRVTFhZRk1UdlFCbGUzc3RDSkl4WjFTbWprQTQ4bEdtN1F0NzloWVJ3amtKSG4weGdmNzhJa2hZQmdNQS9CYnZaT0MyQU9HZkdxd3BQZDdsa2FYRkViUjlsd0FwZVcvbjdMYUU4ZXNxSHJiUVdMaWNKSWZjL1lPVEhGRDJkTnFWM2VBdVhZandJQXpVcG9KR2w4ZlgvYUNxMFF6SzhmN3ZIM2haL0FBcCtuZVFzQkUyTGU3dE9KWjZXQzJkMUljYy9Yc2ZvM25lM1YwWmQzZCtzeFlUZDh3YkdCam5EUXpBT3huUXdZZjgxTTNyL3lPRDhLVEFoSjlQSk9BbEdRQ2kwYkVnOU9EclNLaFkvK3FDNS8zem9jak9BV3R4WVFtSmRubHRqb0NBL1lvbTlTcGZUSk41NmdWRGhPWWtLdzVCa3FPVDBJRTIrMGNWa0RXeVpKUXdtTlluMmJYL2ZFZ1NUdnBlNmVzTjUxclJZY0MzdWlJZUNkNjlGU0hjY1V5VVRBTFpFU0hGTi84S2ozN3VwWGtvR3BzUGw2MlRWVUNZb1M4U1BWdnorT0VPWkFZOWhkQ1l0TzJzUG1WbVdYbzM1S3c3Mlh0Mk95SEkyOFFYS2xVTXYvUUhoSDV2WFEvRWJCcjRheTVUSitVTTBzc0hPRWtEUmNOTUlyTFMvVWdvcEJOY1NHQ2I5TnE2bHNsMDFYOUpPcjFJQ0piNlhmYURDdUxTdE15MlZlUWdxTVJ2ZXdyMTJEN1o4QitldE1lZllCa3A2dkozRkk3SE14NEFDaE1sRnBiTVJjMEkvbHozN1dERVVPczdib1RZaTRoY1MrSTVCMmI0bnFLbmxyd0ZwYVYrZVMveXhxVzJYQVlvcS9pTWlpUm9KOFNCZmJ3NjdxS1Z0NmtRczBvcFY2aHhGejBmeWliZVQ1T2lSL0lFcjdkbnhvYjF2czBwVkgyams3SmtiN1dDcDRJZU1mKyt6Z0ZvNFhFMEFISGRTeUIvVUM3QzgwVXhTb29tYWVOMURnV1Q4aU9NaERqV1dnN2JZQnp1YVp3Z210U0FJQ1FpM292ZDRDNFR4OWxMbVVOQmx6Y1U5TUNscGFhRU8mdW5XdGlXYUEyM1NjSk15dDZqUDhBQXRDanlNPQ==; __Secure-s_a=QjFvSGplT2ZuOHd1OWNTOTlWRzlaeEp5QTkyT0VkWmxMcWlBNzlyb2hEVVR5MjJKUllyMDk0Ui9hL0VrTEJpZlBqbGJZbEV1MlFmSkZLVmM5cTVsZWhkdHZ3d3JMZ2xsVzVOYWViU1JsaXFyTnpOUldsVzFsV09ocVRwQkllR2V3bDJlL2xwbEpnaTVzTEs1SW9ERnY0VzltNjRGKzl4aG5yWlc0N0RMa1FWYlNtaEFGcUNQTXhkdVR0KzFlUXNuZVFiR1pXbHNQcnNVbzNraWIrOURiUHRQdURyOVhPSzdjcHRLdmZuSldBVDRkMDJibFNDNFJhYjFISTdaRkhGVzEwRGpmbGRWWjlBR3pzcFdiMG5mS2JyUnEzZ3BGTVgra1V5azFBR1dXRHczTjFvTE5HQkdCTGZxNDgyT21BRjhLeVVObWRtVWRJMk5odWQwSWRzbDFyNGltTmlSK2xQSWxBRXRlRjRpNVZFdUJnUEppeGxTUHliUWdjWGlsN1BiU1pzU20xYWppQ3V2V1grdk1yQWZDNzg4eXFGRnF5aFdOdTk1RnAvdi9UaWZTZHFMQjJLQ1BVZHpWTEI5SElXQk1KT1BqajBodzRsbSs0TmZkTlFGV0hYcngybi9oN2dHS2J6T1BWRzhlaVJTZmN4VEZQQ0JEY004OE1LSUJocTc5dzRTalBDRE96VDdXbHlPeHliRjlIUDZTbU91MS9Da1lLZE1iTjVDZjFvck9EcENNelRUaDIxSUJIOGxsV3o2aVYycm03NzRuV0o1OTlJTlg0RzdycXVxcmdJdGp4STQzaEVza2xUZEliNkpCODFMWkRiOFBLT21seTIxVGFoU3YxVTQ5T04rdlY4azZmK05oWnQyWUZKV3BnT0VyOGpzbmdOUGVtVTZVaEZhcHQvUk5TdE8reVRwclJ0QkQwc2ROcG5RV3M3dUZ2aTFpcmt0YStpdVMzVnY3amJteHZBSGJ5eFN2NnlsdzgydjRFUEU3TXg3cEJUbStteittcVNadnNPTmVvT1hwbmlla0crVFpNTmR6dnA1Q2c5T05FZkRTVmRTbE1pZjUzMXpNUDdiRytNQXJkOVZyWnMyOFp6Y2tsc2I2SW5lTEpCMWhPTVZBckFvejBabW96K3A4TUV5aGJHNzluTHdZNElNWnFMNktrcVQ0TmJKMTBvdXhmNjhscVFHNmdMWlhDMTFlN1B6OTdFMjZwa2RZb3Vha1ZtUGhvSGtoVHNremNwcmdubnY2QXVaZm0xeitQQjU2MmhCa2d1dFBmazk5SzYzeFh0cXJ6WTcramM1aE1heUsrMTVjMkh5YTFJVTlWbz0mNXErWmZNWXMxSEJGZHowUTZiZTdZTVEvSEtBPQ==; g_state={\"i_l\":0,\"i_ll\":1773701740903,\"i_b\":\"OOakZ1be1Nl+ALSJTKklcv1d7a6XRs+EJ/01HT386bE\",\"i_e\":{\"enable_itp_optimization\":0}}"
};

/**
 * استخراج الصور من صفحة Pinterest الرئيسية
 */
async function scrapePinterestImages() {
  try {
    // إرسال الطلب
    const response = await axios.get("https://fr.pinterest.com/", {
      headers: defaultHeaders,
      timeout: 30000,
      decompress: true
    });

    const $ = cheerio.load(response.data);
    const images = [];

    // Selectors متعددة للصور
    const selectors = [
      'img[src*="pinimg.com"]',
      'img[loading="lazy"]',
      'div[data-test-id="pin"] img',
      'div[role="article"] img',
      'img[class*="hCL"]',
      'img[class*="hCL"]'
    ];

    // تجميع الصور
    for (const selector of selectors) {
      $(selector).each((index, element) => {
        const $img = $(element);
        const src = $img.attr("src") || $img.attr("data-src") || $img.attr("data-lazy-src") || "";
        
        if (src && src.includes("pinimg.com") && !images.some(img => img.url === src)) {
          const alt = $img.attr("alt") || $img.attr("title") || "Image Pinterest";
          const width = $img.attr("width") || null;
          const height = $img.attr("height") || null;
          
          // تصفية الصور الصغيرة والايقونات
          if (!src.includes("/favicon") && !src.includes("/logo") && !src.includes("icon")) {
            images.push({
              url: src,
              alt: alt,
              width: width ? parseInt(width) : null,
              height: height ? parseInt(height) : null,
              type: src.includes("video") ? "video_thumbnail" : "image"
            });
          }
        }
      });
    }

    // استخراج الصور من البيانات المضمنة
    const scriptData = $('script#__PWS_DATA__').text();
    if (scriptData) {
      try {
        const pwsData = JSON.parse(scriptData);
        // البحث عن الصور في البيانات
        if (pwsData && pwsData.context && pwsData.context.user) {
          const userImage = pwsData.context.user.image_xlarge_url;
          if (userImage && !images.some(img => img.url === userImage)) {
            images.unshift({
              url: userImage,
              alt: "User profile",
              width: null,
              height: null,
              type: "profile_image"
            });
          }
        }
      } catch (e) {
        console.error("Error parsing PWS data:", e.message);
      }
    }

    // إزالة التكرارات
    const uniqueImages = [];
    const seenUrls = new Set();
    
    for (const img of images) {
      if (!seenUrls.has(img.url)) {
        seenUrls.add(img.url);
        uniqueImages.push(img);
      }
    }

    return uniqueImages;
  } catch (error) {
    console.error("Scraping error:", error.message);
    throw new Error(`Failed to scrape Pinterest: ${error.message}`);
  }
}

/**
 * دالة لإضافة زخرفة للنص (لإثراء البيانات)
 */
function addDecoration(text) {
  const decorations = [
    "✨", "🌟", "⭐", "💫", "⚡", "🔥", "💎", "🎨", "🖼️", "📸",
    "🎯", "💡", "🌈", "🎪", "🏆", "🎭", "🎪", "🎯", "💫", "✨"
  ];
  
  const randomDecoration = decorations[Math.floor(Math.random() * decorations.length)];
  const decorativeText = `${randomDecoration} ${text} ${randomDecoration}`;
  
  return {
    original: text,
    decorated: decorativeText,
    decoration: randomDecoration,
    style: "pinterest_inspired"
  };
}

/**
 * API endpoint لجلب صور Pinterest
 */
router.get("/images", async (req, res) => {
  try {
    const { limit = 20, decorate = true } = req.query;
    
    // التحقق من المدخلات
    const parsedLimit = parseInt(limit);
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return res.status(400).json({
        status: false,
        error: "Invalid limit parameter. Must be between 1 and 100"
      });
    }

    // جلب الصور
    const allImages = await scrapePinterestImages();
    
    // تحديد العدد المطلوب
    const limitedImages = allImages.slice(0, parsedLimit);
    
    // إضافة الزخرفة إذا طلبها المستخدم
    const resultImages = limitedImages.map(img => {
      if (decorate === "true" || decorate === true) {
        const decoratedAlt = addDecoration(img.alt);
        return {
          ...img,
          alt_decorated: decoratedAlt,
          timestamp: new Date().toISOString()
        };
      }
      return {
        ...img,
        timestamp: new Date().toISOString()
      };
    });
    
    // إحصائيات
    const stats = {
      total_found: allImages.length,
      returned: resultImages.length,
      limit_applied: parsedLimit,
      source: "pinterest_homepage",
      scraped_at: new Date().toISOString()
    };
    
    // الرد بالنجاح
    res.json({
      status: true,
      success: true,
      count: resultImages.length,
      images: resultImages,
      stats: stats,
      decoration_enabled: decorate === "true" || decorate === true
    });
    
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({
      status: false,
      success: false,
      error: error.message || "An error occurred while scraping Pinterest",
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * API endpoint لجلب تفاصيل صورة محددة
 */
router.get("/image/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        status: false,
        error: "Image ID is required"
      });
    }
    
    // جلب جميع الصور للبحث عن الصورة المطلوبة
    const allImages = await scrapePinterestImages();
    const image = allImages.find(img => img.url.includes(id) || img.url === id);
    
    if (!image) {
      return res.status(404).json({
        status: false,
        error: "Image not found"
      });
    }
    
    // إضافة زخرفة للصورة
    const decoratedAlt = addDecoration(image.alt);
    
    res.json({
      status: true,
      success: true,
      image: {
        ...image,
        alt_decorated: decoratedAlt,
        details: {
          resolution: image.width && image.height ? `${image.width}x${image.height}` : "unknown",
          format: image.url.split('.').pop() || "jpg",
          fetched_at: new Date().toISOString()
        }
      }
    });
    
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({
      status: false,
      error: error.message || "Failed to fetch image details"
    });
  }
});

/**
 * API endpoint لجلب صور حسب البحث
 */
router.get("/search", async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    
    if (!q || q.trim() === "") {
      return res.status(400).json({
        status: false,
        error: "Search query parameter 'q' is required"
      });
    }
    
    const parsedLimit = parseInt(limit);
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return res.status(400).json({
        status: false,
        error: "Invalid limit parameter. Must be between 1 and 100"
      });
    }
    
    // جلب الصور وتصفيتها حسب البحث
    const allImages = await scrapePinterestImages();
    const filteredImages = allImages.filter(img => 
      img.alt.toLowerCase().includes(q.toLowerCase()) ||
      img.url.toLowerCase().includes(q.toLowerCase())
    );
    
    const limitedImages = filteredImages.slice(0, parsedLimit);
    
    res.json({
      status: true,
      success: true,
      query: q,
      count: limitedImages.length,
      total_matching: filteredImages.length,
      images: limitedImages.map(img => ({
        ...img,
        decorated_alt: addDecoration(img.alt)
      }))
    });
    
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({
      status: false,
      error: error.message || "Search failed"
    });
  }
});

module.exports = {
  path: "/api/pinterest",
  name: "Pinterest Image Scraper API",
  type: "get",
  url: `${global.t || "http://localhost:3000"}/api/pinterest/images?limit=20&decorate=true`,
  logo: "https://i.pinimg.com/favicon.ico",
  category: "search",
  info: "جلب الصور من الصفحة الرئيسية لبينتريست مع زخرفة قوية ومعلومات مفصلة. يدعم البحث وتحديد عدد الصور وإضافة زخارف للنصوص",
  router
};
