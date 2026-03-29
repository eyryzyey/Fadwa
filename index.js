<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Hub | منصة الخدمات البرمجية</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        :root {
            --bg: #050505;
            --surface: #0a0a0a;
            --surface-light: #111111;
            --text: #ffffff;
            --text-secondary: #888888;
            --accent: #00ff88;
            --accent-glow: rgba(0, 255, 136, 0.3);
            --border: #1a1a1a;
        }
        
        body {
            font-family: 'Space Grotesk', sans-serif;
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
            overflow-x: hidden;
            line-height: 1.6;
        }
        
        .noise {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            opacity: 0.03;
            z-index: 1000;
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        }
        
        .cursor {
            width: 20px;
            height: 20px;
            border: 2px solid var(--accent);
            border-radius: 50%;
            position: fixed;
            pointer-events: none;
            z-index: 9999;
            transition: transform 0.1s;
            mix-blend-mode: difference;
        }
        
        nav {
            position: fixed;
            top: 0;
            width: 100%;
            padding: 1.5rem 3rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 100;
            background: rgba(5, 5, 5, 0.8);
            backdrop-filter: blur(20px);
            border-bottom: 1px solid var(--border);
        }
        
        .logo {
            font-size: 1.5rem;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .logo::before {
            content: '◆';
            color: var(--accent);
        }
        
        .nav-links {
            display: flex;
            gap: 2rem;
            list-style: none;
        }
        
        .nav-links a {
            color: var(--text-secondary);
            text-decoration: none;
            font-size: 0.9rem;
            transition: color 0.3s;
            position: relative;
        }
        
        .nav-links a:hover {
            color: var(--text);
        }
        
        .nav-links a::after {
            content: '';
            position: absolute;
            bottom: -5px;
            left: 0;
            width: 0;
            height: 1px;
            background: var(--accent);
            transition: width 0.3s;
        }
        
        .nav-links a:hover::after {
            width: 100%;
        }
        
        .hero {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            padding: 8rem 2rem 4rem;
            position: relative;
        }
        
        .hero-bg {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 800px;
            height: 800px;
            background: radial-gradient(circle, var(--accent-glow) 0%, transparent 70%);
            opacity: 0.3;
            filter: blur(60px);
            animation: pulse 4s ease-in-out infinite;
        }
        
        @keyframes pulse {
            0%, 100% { transform: translate(-50%, -50%) scale(1); }
            50% { transform: translate(-50%, -50%) scale(1.1); }
        }
        
        .hero h1 {
            font-size: clamp(3rem, 8vw, 6rem);
            font-weight: 700;
            line-height: 1;
            margin-bottom: 1.5rem;
            position: relative;
            z-index: 1;
        }
        
        .hero h1 span {
            color: var(--accent);
            display: block;
        }
        
        .hero p {
            font-size: 1.2rem;
            color: var(--text-secondary);
            max-width: 600px;
            margin-bottom: 3rem;
            position: relative;
            z-index: 1;
        }
        
        .search-box {
            width: 100%;
            max-width: 600px;
            position: relative;
            z-index: 1;
        }
        
        .search-box input {
            width: 100%;
            padding: 1.2rem 1.5rem;
            padding-left: 3rem;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 12px;
            color: var(--text);
            font-size: 1rem;
            font-family: inherit;
            transition: all 0.3s;
        }
        
        .search-box input:focus {
            outline: none;
            border-color: var(--accent);
            box-shadow: 0 0 0 3px var(--accent-glow);
        }
        
        .search-box::before {
            content: '⌕';
            position: absolute;
            left: 1rem;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-secondary);
            font-size: 1.2rem;
        }
        
        .categories {
            padding: 4rem 3rem;
            max-width: 1400px;
            margin: 0 auto;
        }
        
        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 3rem;
        }
        
        .section-title {
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: var(--text-secondary);
        }
        
        .view-all {
            color: var(--accent);
            text-decoration: none;
            font-size: 0.9rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .api-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 1.5rem;
        }
        
        .api-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 1.5rem;
            transition: all 0.3s;
            cursor: pointer;
            position: relative;
            overflow: hidden;
        }
        
        .api-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 2px;
            background: linear-gradient(90deg, transparent, var(--accent), transparent);
            transform: translateX(-100%);
            transition: transform 0.5s;
        }
        
        .api-card:hover::before {
            transform: translateX(100%);
        }
        
        .api-card:hover {
            border-color: var(--accent);
            transform: translateY(-5px);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
        }
        
        .api-icon {
            width: 48px;
            height: 48px;
            background: var(--surface-light);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            margin-bottom: 1rem;
            border: 1px solid var(--border);
        }
        
        .api-card:hover .api-icon {
            background: var(--accent);
            color: var(--bg);
        }
        
        .api-name {
            font-size: 1.1rem;
            font-weight: 600;
            margin-bottom: 0.5rem;
        }
        
        .api-desc {
            color: var(--text-secondary);
            font-size: 0.9rem;
            margin-bottom: 1rem;
        }
        
        .api-meta {
            display: flex;
            gap: 1rem;
            font-size: 0.8rem;
            color: var(--text-secondary);
        }
        
        .api-meta span {
            display: flex;
            align-items: center;
            gap: 0.3rem;
        }
        
        .status {
            width: 8px;
            height: 8px;
            background: var(--accent);
            border-radius: 50%;
            animation: blink 2s infinite;
        }
        
        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        .tools-section {
            padding: 4rem 3rem;
            background: var(--surface);
            border-top: 1px solid var(--border);
            border-bottom: 1px solid var(--border);
        }
        
        .tools-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 2rem;
            max-width: 1400px;
            margin: 0 auto;
        }
        
        .tool-item {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 1.5rem;
            background: var(--bg);
            border-radius: 12px;
            border: 1px solid var(--border);
            transition: all 0.3s;
        }
        
        .tool-item:hover {
            border-color: var(--accent);
            transform: translateX(10px);
        }
        
        .tool-icon {
            font-size: 1.5rem;
        }
        
        .terminal {
            max-width: 900px;
            margin: 4rem auto;
            background: var(--surface);
            border-radius: 16px;
            border: 1px solid var(--border);
            overflow: hidden;
        }
        
        .terminal-header {
            background: var(--surface-light);
            padding: 1rem 1.5rem;
            display: flex;
            gap: 0.5rem;
            align-items: center;
        }
        
        .terminal-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
        }
        
        .terminal-dot:nth-child(1) { background: #ff5f56; }
        .terminal-dot:nth-child(2) { background: #ffbd2e; }
        .terminal-dot:nth-child(3) { background: #27ca40; }
        
        .terminal-body {
            padding: 1.5rem;
            font-family: 'Courier New', monospace;
            font-size: 0.9rem;
            line-height: 1.8;
        }
        
        .terminal-line {
            margin-bottom: 0.5rem;
        }
        
        .prompt { color: var(--accent); }
        .command { color: var(--text); }
        .output { color: var(--text-secondary); }
        
        footer {
            padding: 3rem;
            text-align: center;
            color: var(--text-secondary);
            font-size: 0.9rem;
            border-top: 1px solid var(--border);
        }
        
        .marquee {
            overflow: hidden;
            white-space: nowrap;
            padding: 2rem 0;
            border-top: 1px solid var(--border);
            border-bottom: 1px solid var(--border);
        }
        
        .marquee-content {
            display: inline-block;
            animation: marquee 20s linear infinite;
        }
        
        @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
        }
        
        .marquee span {
            margin: 0 3rem;
            color: var(--text-secondary);
            font-size: 0.9rem;
        }
        
        @media (max-width: 768px) {
            nav {
                padding: 1rem;
            }
            .nav-links {
                display: none;
            }
            .hero {
                padding: 6rem 1rem 3rem;
            }
            .categories {
                padding: 2rem 1rem;
            }
        }
    </style>
</head>
<body>
    <div class="noise"></div>
    <div class="cursor" id="cursor"></div>
    
    <nav>
        <div class="logo">API Hub</div>
        <ul class="nav-links">
            <li><a href="#download">تنزيل</a></li>
            <li><a href="#tools">أدوات</a></li>
            <li><a href="#search">بحث</a></li>
            <li><a href="#docs">توثيق</a></li>
        </ul>
    </nav>
    
    <section class="hero">
        <div class="hero-bg"></div>
        <h1>منصة <span>الخدمات البرمجية</span></h1>
        <p>واجهات برمجية قوية، أدوات ذكية، وخدمات متكاملة للمطورين</p>
        <div class="search-box">
            <input type="text" placeholder="ابحث عن API أو أداة...">
        </div>
    </section>
    
    <div class="marquee">
        <div class="marquee-content">
            <span>⚡ سرعة فائقة</span>
            <span>🔒 أمان تام</span>
            <span>📊 تحليلات ذكية</span>
            <span>🌍 شبكة عالمية</span>
            <span>⚡ سرعة فائقة</span>
            <span>🔒 أمان تام</span>
            <span>📊 تحليلات ذكية</span>
            <span>🌍 شبكة عالمية</span>
        </div>
    </div>
    
    <section class="categories" id="download">
        <div class="section-header">
            <h2 class="section-title">تنزيل وتحويل</h2>
            <a href="#" class="view-all">عرض الكل →</a>
        </div>
        <div class="api-grid">
            <div class="api-card">
                <div class="api-icon">📥</div>
                <h3 class="api-name">Video Downloader</h3>
                <p class="api-desc">تنزيل الفيديوهات من جميع المنصات بجودة عالية</p>
                <div class="api-meta">
                    <span><span class="status"></span> متاح</span>
                    <span>⚡ 50ms</span>
                </div>
            </div>
            <div class="api-card">
                <div class="api-icon">🎵</div>
                <h3 class="api-name">Audio Extractor</h3>
                <p class="api-desc">استخراج الصوت من الفيديو بصيغ متعددة</p>
                <div class="api-meta">
                    <span><span class="status"></span> متاح</span>
                    <span>⚡ 30ms</span>
                </div>
            </div>
            <div class="api-card">
                <div class="api-icon">🖼️</div>
                <h3 class="api-name">Image Converter</h3>
                <p class="api-desc">تحويل الصور بين جميع الصيغ مع ضغط ذكي</p>
                <div class="api-meta">
                    <span><span class="status"></span> متاح</span>
                    <span>⚡ 20ms</span>
                </div>
            </div>
            <div class="api-card">
                <div class="api-icon">📄</div>
                <h3 class="api-name">PDF Tools</h3>
                <p class="api-desc">دمج، تقسيم، وتحويل ملفات PDF</p>
                <div class="api-meta">
                    <span><span class="status"></span> متاح</span>
                    <span>⚡ 40ms</span>
                </div>
            </div>
        </div>
    </section>
    
    <section class="categories" id="tools">
        <div class="section-header">
            <h2 class="section-title">أدوات المطورين</h2>
            <a href="#" class="view-all">عرض الكل →</a>
        </div>
        <div class="api-grid">
            <div class="api-card">
                <div class="api-icon">🔐</div>
                <h3 class="api-name">JWT Generator</h3>
                <p class="api-desc">إنشاء وفحص توكنات JWT بسهولة</p>
                <div class="api-meta">
                    <span><span class="status"></span> متاح</span>
                    <span>⚡ 10ms</span>
                </div>
            </div>
            <div class="api-card">
                <div class="api-icon">🎨</div>
                <h3 class="api-name">Color Palette</h3>
                <p class="api-desc">توليد لوحات ألوان متناسقة من صورة</p>
                <div class="api-meta">
                    <span><span class="status"></span> متاح</span>
                    <span>⚡ 25ms</span>
                </div>
            </div>
            <div class="api-card">
                <div class="api-icon">📐</div>
                <h3 class="api-name">Regex Tester</h3>
                <p class="api-desc">اختبار وفحص التعبيرات النمطية</p>
                <div class="api-meta">
                    <span><span class="status"></span> متاح</span>
                    <span>⚡ 15ms</span>
                </div>
            </div>
            <div class="api-card">
                <div class="api-icon">🗜️</div>
                <h3 class="api-name">Minifier</h3>
                <p class="api-desc">ضغط CSS و JavaScript و HTML</p>
                <div class="api-meta">
                    <span><span class="status"></span> متاح</span>
                    <span>⚡ 20ms</span>
                </div>
            </div>
            <div class="api-card">
                <div class="api-icon">🔍</div>
                <h3 class="api-name">Diff Checker</h3>
                <p class="api-desc">مقارنة النصوص وإبراز الاختلافات</p>
                <div class="api-meta">
                    <span><span class="status"></span> متاح</span>
                    <span>⚡ 18ms</span>
                </div>
            </div>
            <div class="api-card">
                <div class="api-icon">⚙️</div>
                <h3 class="api-name">Base64 Tools</h3>
                <p class="api-desc">ترميز وفك ترميز Base64</p>
                <div class="api-meta">
                    <span><span class="status"></span> متاح</span>
                    <span>⚡ 12ms</span>
                </div>
            </div>
        </div>
    </section>
    
    <section class="categories" id="search">
        <div class="section-header">
            <h2 class="section-title">بحث وتحليل</h2>
            <a href="#" class="view-all">عرض الكل →</a>
        </div>
        <div class="api-grid">
            <div class="api-card">
                <div class="api-icon">🔎</div>
                <h3 class="api-name">Web Scraper</h3>
                <p class="api-desc">استخراج البيانات من المواقع بذكاء</p>
                <div class="api-meta">
                    <span><span class="status"></span> متاح</span>
                    <span>⚡ 100ms</span>
                </div>
            </div>
            <div class="api-card">
                <div class="api-icon">📰</div>
                <h3 class="api-name">News Aggregator</h3>
                <p class="api-desc">جمع الأخبار من مصادر متعددة</p>
                <div class="api-meta">
                    <span><span class="status"></span> متاح</span>
                    <span>⚡ 60ms</span>
                </div>
            </div>
            <div class="api-card">
                <div class="api-icon">📍</div>
                <h3 class="api-name">Geolocation</h3>
                <p class="api-desc">تحديد الموقع وتحليل العناوين</p>
                <div class="api-meta">
                    <span><span class="status"></span> متاح</span>
                    <span>⚡ 35ms</span>
                </div>
            </div>
            <div class="api-card">
                <div class="api-icon">📊</div>
                <h3 class="api-name">SEO Analyzer</h3>
                <p class="api-desc">تحليل SEO للمواقع والصفحات</p>
                <div class="api-meta">
                    <span><span class="status"></span> متاح</span>
                    <span>⚡ 80ms</span>
                </div>
            </div>
        </div>
    </section>
    
    <div class="terminal">
        <div class="terminal-header">
            <div class="terminal-dot"></div>
            <div class="terminal-dot"></div>
            <div class="terminal-dot"></div>
            <span style="margin-left: 1rem; color: var(--text-secondary); font-size: 0.8rem;">bash</span>
        </div>
        <div class="terminal-body">
            <div class="terminal-line"><span class="prompt">$</span> <span class="command">curl https://apihub.dev/v1/download/video -H "Authorization: Bearer YOUR_KEY"</span></div>
            <div class="terminal-line output">{</div>
            <div class="terminal-line output">&nbsp;&nbsp;"status": "success",</div>
            <div class="terminal-line output">&nbsp;&nbsp;"url": "https://cdn.apihub.dev/v/abc123.mp4",</div>
            <div class="terminal-line output">&nbsp;&nbsp;"quality": "1080p",</div>
            <div class="terminal-line output">&nbsp;&nbsp;"size": "15.4MB"</div>
            <div class="terminal-line output">}</div>
            <div class="terminal-line"><span class="prompt">$</span> <span class="command">_</span></div>
        </div>
    </div>
    
    <footer>
        <p>© 2026 API Hub — منصة خدمات المطورين</p>
    </footer>
    
    <script>
        const cursor = document.getElementById('cursor');
        document.addEventListener('mousemove', (e) => {
            cursor.style.left = e.clientX - 10 + 'px';
            cursor.style.top = e.clientY - 10 + 'px';
        });
        
        document.querySelectorAll('a, .api-card, button').forEach(el => {
            el.addEventListener('mouseenter', () => {
                cursor.style.transform = 'scale(1.5)';
            });
            el.addEventListener('mouseleave', () => {
                cursor.style.transform = 'scale(1)';
            });
        });
    </script>
</body>
</html>
