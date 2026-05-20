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

    // Trust Render/cloud reverse proxy (fixes ERR_ERL_UNEXPECTED_X_FORWARDED_FOR)
    app.set("trust proxy", 1);

    // Configure body parser with larger size limit for file uploads
    app.use(express.json({ limit: "50mb" }));
    app.use(express.urlencoded({ limit: "50mb", extended: true }));

      // ── Ad view page ──
        const AD_VIEW_HTML = [
          '<!DOCTYPE html>',
          '<html lang="ar" dir="rtl"><head>',
          '<meta charset="UTF-8"/>',
          '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>',
          '<title>\u0645\u0634\u0627\u0647\u062f\u0629 \u0627\u0644\u0625\u0639\u0644\u0627\u0646</title>',
          '<style>',
          '*{margin:0;padding:0;box-sizing:border-box}',
          'html,body{height:100%;background:#070711;color:#fff;font-family:Segoe UI,sans-serif;overflow:hidden}',
          'body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:24px;padding:24px}',
          '.icon{width:96px;height:96px;border-radius:50%;background:linear-gradient(135deg,#7C3AED,#4F46E5);display:flex;align-items:center;justify-content:center;font-size:48px;box-shadow:0 0 60px rgba(124,58,237,0.5)}',
          'h1{font-size:20px;font-weight:900;margin:0;text-align:center}',
          'p{color:rgba(255,255,255,0.4);font-size:13px;text-align:center;line-height:1.5;margin:0}',
          '.tw{position:relative;width:140px;height:140px}',
          '.tw svg{transform:rotate(-90deg)}',
          '.ti{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}',
          '.tn{font-size:34px;font-weight:900;font-variant-numeric:tabular-nums;transition:color .5s}',
          '.tl{font-size:10px;color:rgba(255,255,255,0.3);font-weight:700}',
          '.pb{width:100%;max-width:320px;height:5px;background:rgba(255,255,255,0.08);border-radius:99px;overflow:hidden}',
          '.pbi{height:100%;border-radius:99px;transition:width .9s linear,background .5s}',
          '.btn{width:100%;max-width:320px;height:60px;border-radius:22px;border:none;font-size:17px;font-weight:900;cursor:not-allowed;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.25);transition:all .4s}',
          '.btn.ready{cursor:pointer;background:linear-gradient(135deg,#10B981,#059669);color:#fff;box-shadow:0 8px 32px rgba(16,185,129,0.4)}',
          '</style></head><body>',
          '<div class="icon">&#128250;</div>',
          '<div><h1>\u0645\u0634\u0627\u0647\u062f\u0629 \u0627\u0644\u0625\u0639\u0644\u0627\u0646</h1>',
          '<p id="sub">\u0627\u0646\u062a\u0638\u0631 \u062d\u062a\u0649 \u0627\u0643\u062a\u0645\u0627\u0644 \u0627\u0644\u0639\u062f\u0627\u062f \u0644\u0627\u0633\u062a\u0644\u0627\u0645 \u0646\u0642\u0627\u0637\u0643</p></div>',
          '<div class="tw">',
          '<svg width="140" height="140">',
          '<circle cx="70" cy="70" r="62" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="8"/>',
          '<circle id="arc" cx="70" cy="70" r="62" fill="none" stroke="#7C3AED" stroke-width="8" stroke-dasharray="389.557" stroke-dashoffset="389.557" stroke-linecap="round" style="transition:stroke-dashoffset .9s linear,stroke .5s"/>',
          '</svg>',
          '<div class="ti"><span class="tn" id="tn" style="color:#fff">00:15</span><span class="tl">\u062b\u0627\u0646\u064a\u0629</span></div>',
          '</div>',
          '<div class="pb"><div class="pbi" id="pb" style="width:0%;background:linear-gradient(90deg,#7C3AED,#60A5FA)"></div></div>',
          '<button class="btn" id="cb" disabled onclick="claim()">&#9203; \u0627\u0646\u062a\u0638\u0631 00:15</button>',
          '<script src="https://5gvci.com/tag.min.js" data-zone="11035304" async><\/script>',
          '<script>',
          'var _o=window.open.bind(window);',
          'window.open=function(u){var s=u?String(u):"";if(s.indexOf("https://")==0||s.indexOf("http://")==0)return _o(s,"_blank");return null;};',
          'document.addEventListener("click",function(e){var a=e.target.closest("a");if(!a)return;var h=a.getAttribute("href")||"";if(h&&h.indexOf("https://")!==0&&h.indexOf("http://")!==0&&h.indexOf("#")!==0)e.preventDefault();},true);',
          'var S=15,left=S,C=389.557;',
          'var arc=document.getElementById("arc"),tn=document.getElementById("tn"),pb=document.getElementById("pb"),cb=document.getElementById("cb"),sub=document.getElementById("sub");',
          'function pad(n){return String(n).padStart(2,"0")}',
          'function tick(){if(left>0)left--;var m=pad(Math.floor(left/60)),s=pad(left%60),p=((S-left)/S)*100;',
          'arc.setAttribute("stroke-dashoffset",C*(1-p/100));tn.textContent=m+":"+s;pb.style.width=p+"%";',
          'if(left===0){arc.setAttribute("stroke","#10B981");tn.style.color="#10B981";pb.style.background="linear-gradient(90deg,#10B981,#34D399)";',
          'cb.disabled=false;cb.className="btn ready";cb.textContent="\u{1F381} \u0627\u0633\u062a\u0644\u0645 \u0627\u0644\u0645\u0643\u0627\u0641\u0623\u0629";',
          'sub.textContent="\u{1F389} \u0627\u0646\u062a\u0647\u0649 \u0627\u0644\u0625\u0639\u0644\u0627\u0646! \u0627\u0633\u062a\u0644\u0645 \u0645\u0643\u0627\u0641\u0623\u062a\u0643";',
          '}else{cb.textContent="\u23F3 \u0627\u0646\u062a\u0638\u0631 "+m+":"+s;setTimeout(tick,1000);}}',
          'setTimeout(tick,1000);',
          'function tryAd(){var f=window["show_11035304"];if(typeof f==="function"){f();return true;}return false;}',
          'if(!tryAd()){var at=0,poll=setInterval(function(){if(tryAd()||++at>=10)clearInterval(poll);},500);}',
          'function claim(){cb.disabled=true;cb.textContent="\u2705 \u062a\u0645! \u0639\u062f \u0625\u0644\u0649 \u0627\u0644\u062a\u0637\u0628\u064a\u0642";cb.className="btn";cb.style.background="rgba(16,185,129,0.15)";cb.style.color="#10B981";',
          'setTimeout(function(){try{window.close();}catch(e){}try{history.back();}catch(e){}},800);}',
          '<\/script></body></html>',
        ].join('\n');

        app.get("/ad-view", (_req, res) => {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.setHeader("Cache-Control", "no-cache, no-store");
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
  