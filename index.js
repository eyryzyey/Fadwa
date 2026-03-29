// بسم الله الرحمن الرحيم ✨
// API Dynamic Loader (CommonJS Version)

const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(express.json());
app.set("json spaces", 2);
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 9012;

// 🌍 متغير عام
global.t = "https://fadwa-iz4q2gncq-hhhhhhhh1.vercel.app";

// 📁 مجلد الروتات
const routesDir = path.join(__dirname, "routes");
const apiList = [];

// 🧠 تحميل جميع الروتات ديناميكيًا (CommonJS)
function loadRoutes() {
  console.log("🔄 Loading routes...");
  const files = fs.readdirSync(routesDir);

  for (const file of files) {
    const filePath = path.join(routesDir, file);

    try {
      const routeModule = require(filePath);
      const route = routeModule.default || routeModule;

      if (route.path && route.router) {
        app.use(route.path, route.router);

        apiList.push({
          name: route.name || file.replace(".js", "").toUpperCase(),
          type: route.type || "default",
          url: Array.isArray(route.url)
            ? route.url
            : route.url
            ? [route.url]
            : [],
          logo: route.logo || null,
          status: "Active",
          category: route.category || "General",
          info: route.info || "API BY MTA",
        });

        console.log(`✅ Loaded: ${route.path}`);
      } else {
        console.warn(`⚠️ Route file missing {path, router}: ${file}`);
      }
    } catch (err) {
      console.error(`❌ Failed to load ${file}:`, err.message);
    }
  }
}

// تحميل الروتات
loadRoutes();

// 📜 API LIST
app.get("/api/list", (req, res) => {
  res.json(apiList);
});

// Clean URLs
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);


// ❌ 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// 🚀 Start Local Server
if (process.env.VERCEL !== "1") {
  app.listen(PORT, () =>
    console.log(`🟢 Server running on http://localhost:${PORT}`)
  );
}

// 📦 تصدير التطبيق
module.exports = app;
