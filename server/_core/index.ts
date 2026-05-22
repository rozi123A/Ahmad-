import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { createServer } from "http";
import net from "net";
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

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// ── Keep-Alive: prevents Render free-tier sleep (pings every 14 min) ──
function startKeepAlive(baseUrl: string) {
  const INTERVAL_MS = 14 * 60 * 1000; // 14 minutes
  const pingUrl = `${baseUrl.replace(/\/$/, "")}/ping`;

  const ping = async () => {
    try {
      const res = await fetch(pingUrl, { signal: AbortSignal.timeout(10_000) });
      console.log(`[KeepAlive] ✓ Ping OK — ${new Date().toISOString()} (${res.status})`);
    } catch (err: any) {
      console.warn(`[KeepAlive] ✗ Ping failed — ${err?.message}`);
    }
  };

  // First ping after 1 minute, then every 14 minutes
  setTimeout(() => {
    ping();
    setInterval(ping, INTERVAL_MS);
  }, 60_000);

  console.log(`[KeepAlive] Started — pinging ${pingUrl} every 14 min`);
}

async function startServer() {
  await initDb();

  const app = express();
  const server = createServer(app);

  // Security headers
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'", "'unsafe-inline'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", "data:", "https:"], connectSrc: ["'self'", "https:"] } } }));

  // CORS — allow configured frontend origin
  app.use(cors({
    origin: process.env.FRONTEND_URL || process.env.WEBAPP_URL || "http://localhost:3000",
    credentials: true,
  }));

  // Body parser — 2mb limit to prevent DoS attacks
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ limit: "2mb", extended: true }));

  // ── /ping — health check + keep-alive target ──
  app.get("/ping", (_req, res) => {
    res.status(200).json({
      status: "alive",
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + "MB",
    });
  });

  // ── /healthz — alias for uptime monitors ──
  app.get("/healthz", (_req, res) => res.status(200).send("OK"));

    // ── Ad view page ──
    const monetagZone = process.env.MONETAG_ZONE_ID || "11043107";
    const monetagScript = process.env.MONETAG_SCRIPT_URL || "https://n6wxm.com/vignette.min.js";
    const AD_IFRAME_CONTENT = encodeURIComponent(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:transparent}</style>
</head><body>
<script>(function(s){s.dataset.zone='${monetagZone}',s.src='${monetagScript}'})([document.documentElement,document.body].filter(Boolean).pop().appendChild(document.createElement('script')))<\/script>
<script>
window.addEventListener('load',function(){
  var fn=window['show_${monetagZone}'];
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

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);

    // Start Telegram Bot
    startBot(app).catch(err => console.error("[Bot] Error starting bot:", err));

    // Start Keep-Alive self-ping (production only)
    const appUrl =
      process.env.RENDER_EXTERNAL_URL ||
      process.env.WEBAPP_URL ||
      process.env.FRONTEND_URL ||
      "";
    if (appUrl && process.env.NODE_ENV === "production") {
      startKeepAlive(appUrl);
    } else if (process.env.NODE_ENV !== "production") {
      console.log("[KeepAlive] Skipped in development mode");
    } else {
      console.warn("[KeepAlive] No app URL found — set RENDER_EXTERNAL_URL env var");
    }
  });
}

startServer().catch(console.error);
