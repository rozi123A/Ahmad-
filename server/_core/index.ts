import "dotenv/config";
  import express from "express";
  import { createServer } from "http";
  import { createExpressMiddleware } from "@trpc/server/adapters/express";
  import { registerOAuthRoutes } from "./oauth";
  import { registerStorageProxy } from "./storageProxy";
  import { appRouter } from "../routers";
  import { getDb, initDb } from "../db";
  import { startBot } from "../bot";
  import path from "path";
  import { fileURLToPath } from "url";

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  import { createContext } from "./context";
  import { serveStatic, setupVite } from "./vite";

  async function startServer() {
    await initDb();

    const app = express();
    const server = createServer(app);

    // Configure body parser with larger size limit for file uploads
    app.use(express.json({ limit: "50mb" }));
    app.use(express.urlencoded({ limit: "50mb", extended: true }));

      // ── Ad view page — served inside Telegram's built-in browser ──
      const AD_IFRAME_CONTENT = encodeURIComponent(`<!DOCTYPE html>
  <html><head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{background:transparent}</style>
  </head><body>
  <script>(function(s){s.dataset.zone='11003103',s.src='https://al5sm.com/tag.min.js'})([document.documentElement,document.body].filter(Boolean).pop().appendChild(document.createElement('script')))<\/script>
  <script>
  window.addEventListener('load',function(){
    var fn=window['show_11003103'];
    if(typeof fn==='function') fn();
  });
  <\/script>
  </body></html>`);

      const AD_VIEW_HTML = `<!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
    <title>مشاهدة الإعلان</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      html,body{height:100%;background:#0d1117;color:#fff;font-family:'Segoe UI',sans-serif}
      body{display:flex;flex-direction:column;align-items:center;justify-content:flex-start}
      #ad-frame{
        width:100%;flex:1;border:none;
        min-height:calc(100vh - 60px);
        display:block;background:transparent;
      }
      .back-btn{
        width:100%;height:60px;border:none;
        background:linear-gradient(135deg,#10b981,#059669);
        color:#fff;font-weight:800;font-size:17px;
        cursor:pointer;letter-spacing:0.02em;flex-shrink:0;
      }
    </style>
  </head>
  <body>
    <iframe
      id="ad-frame"
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
      src="data:text/html,${AD_IFRAME_CONTENT}"
      scrolling="no"
    ></iframe>
    <button class="back-btn" onclick="try{window.close();}catch(e){} try{history.back();}catch(e){}">
      ✅ انقر للحصول على المكافأة — عدت
    </button>
  </body>
  </html>`;

      app.get("/ad-view", (_req, res) => {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache");
        res.send(AD_VIEW_HTML);
      });
    
    registerStorageProxy(app);
    registerOAuthRoutes(app);

    // tRPC API
    app.use(
      "/api/trpc",
      createExpressMiddleware({
        router: appRouter,
        createContext,
      })
    );

    // development mode uses Vite, production mode uses static files
    if (process.env.NODE_ENV === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Always use PORT env var — required by Render, Railway, and similar platforms
    const port = parseInt(process.env.PORT || "3000", 10);

    server.listen(port, "0.0.0.0", () => {
      console.log(`Server running on port ${port}`);
      // Start Telegram Bot
      startBot(app).catch(err => console.error("[Bot] Error starting bot:", err));
    });
  }

  startServer().catch(console.error);
  