import { useState, useRef, useCallback } from "react";

interface AdOverlayProps {
  seconds?: number;
  rewardLabel?: string;
  onClaim: () => void;
  onClose: () => void;
}

/* ------------------------------------------------------------------ */
/* Config — replace ZONE_ID with your PropellerAds / Monetag Zone ID  */
/* ------------------------------------------------------------------ */
const AD_ZONE_ID  = (window as any).__AD_ZONE_ID__ || import.meta.env.VITE_AD_ZONE_ID || "";
const AD_SCRIPT   = (window as any).__AD_SCRIPT__  || import.meta.env.VITE_AD_SCRIPT_SRC || "https://czathooyou.com/tag.min.js"; // PropellerAds Interstitial CDN

type Phase =
  | "idle"       // waiting for user tap
  | "loading"    // loading ad script
  | "showing"    // ad visible in-page
  | "countdown"  // ad done, timer running
  | "ready"      // timer done, claim available
  | "claimed";

/* ------------------------------------------------------------------ */
/* Load ad script and wait for show_ZONEID function                    */
/* ------------------------------------------------------------------ */
function loadAdScript(zoneId: string, src: string): Promise<(() => unknown) | null> {
  return new Promise((resolve) => {
    const fnName = `show_${zoneId}`;
    if (typeof (window as any)[fnName] === "function") {
      resolve((window as any)[fnName]);
      return;
    }
    // Remove old script for this zone if any
    const old = document.querySelector(`script[data-zone="${zoneId}"]`);
    if (!old) {
      const s = document.createElement("script");
      s.dataset.zone = zoneId;
      s.src = src;
      s.async = true;
      document.head.appendChild(s);
    }
    // Poll until function appears (max 10s)
    const t0 = Date.now();
    const poll = setInterval(() => {
      const fn = (window as any)[fnName];
      if (typeof fn === "function") {
        clearInterval(poll);
        resolve(fn);
      } else if (Date.now() - t0 > 10_000) {
        clearInterval(poll);
        resolve(null);
      }
    }, 200);
  });
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */
export default function AdOverlay({ seconds = 15, rewardLabel, onClaim, onClose }: AdOverlayProps) {
  const [phase,    setPhase]    = useState<Phase>("idle");
  const [timeLeft, setTimeLeft] = useState(seconds);
  const [errMsg,   setErrMsg]   = useState<string | null>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const adDoneRef = useRef(false);

  /* countdown */
  const startCountdown = useCallback(() => {
    setPhase("countdown");
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setPhase("ready");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  /* detect user returning from external ad (visibilitychange fallback) */
  const watchForReturn = useCallback((timeoutMs = 5000) => {
    const handler = () => {
      if (document.visibilityState === "visible" && !adDoneRef.current) {
        adDoneRef.current = true;
        document.removeEventListener("visibilitychange", handler);
        setTimeout(startCountdown, 400);
      }
    };
    document.addEventListener("visibilitychange", handler);
    setTimeout(() => {
      if (!adDoneRef.current) {
        adDoneRef.current = true;
        document.removeEventListener("visibilitychange", handler);
        startCountdown();
      }
    }, timeoutMs);
  }, [startCountdown]);

  /* main: MUST be called from a user-gesture click handler */
  const handleStartAd = useCallback(async () => {
    if (phase !== "idle") return;

    if (!AD_ZONE_ID) {
      setErrMsg("Zone ID غير مضبوط — أضف VITE_AD_ZONE_ID في متغيرات البيئة.");
      return;
    }

    setPhase("loading");
    setErrMsg(null);

    /* Intercept window.open so popup-format ads open via Telegram instead */
    const tg = (window as any).Telegram?.WebApp;
    const origOpen = window.open.bind(window);
    let didOpen = false;
    (window as any).open = (url?: string | URL, _t?: string, _f?: string) => {
      didOpen = true;
      if (url) {
        const u = String(url);
        try { const w = origOpen(u, "_blank"); if (w) return w; } catch { /**/ }
        tg?.openLink?.(u);
      }
      return null;
    };

    try {
      const showFn = await loadAdScript(AD_ZONE_ID, AD_SCRIPT);
      if (!showFn) {
        window.open = origOpen;
        setErrMsg("تعذّر تحميل الإعلان. تحقق من الـ Zone ID أو اتصالك.");
        setPhase("idle");
        return;
      }

      setPhase("showing");

      /* Call show function — we are inside a click handler → user gesture ✓ */
      const result = await Promise.race([
        Promise.resolve(showFn()),
        new Promise<void>(r => setTimeout(r, 800)),
      ]);

      window.open = origOpen;

      /* PropellerAds Interstitial resolves its promise when ad closes */
      /* If it resolved with a value, treat as done; otherwise wait    */
      if (result !== undefined) {
        adDoneRef.current = true;
        setTimeout(startCountdown, 400);
      } else if (didOpen) {
        /* popunder opened in external window — wait for return */
        watchForReturn(8000);
      } else {
        /* In-page interstitial — wait a moment then start countdown */
        watchForReturn(3000);
      }
    } catch {
      window.open = origOpen;
      setErrMsg("حدث خطأ. حاول مجدداً.");
      setPhase("idle");
    }
  }, [phase, startCountdown, watchForReturn]);

  /* claim */
  const handleClaim = useCallback(() => {
    if (phase !== "ready") return;
    setPhase("claimed");
    onClaim();
    setTimeout(onClose, 300);
  }, [phase, onClaim, onClose]);

  /* ---------------------------------------------------------------- */
  const mm  = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const ss  = String(timeLeft % 60).padStart(2, "0");

  const steps = [
    { label: "اضغط زر بدء الإعلان",          done: phase !== "idle" },
    { label: "شاهد الإعلان كاملاً",            done: ["countdown","ready","claimed"].includes(phase) },
    { label: "انتظر العداد واستلم مكافأتك",   done: phase === "ready" || phase === "claimed" },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", flexDirection: "column", alignItems: "center",
      background: "linear-gradient(170deg,#0d1420 0%,#131c35 100%)",
      fontFamily: "'Inter','Segoe UI',sans-serif",
      padding: "0 14px",
    }}>
      {/* blobs */}
      <div style={{ position:"absolute", top:-60, right:-60, width:200, height:200, borderRadius:"50%", background:"rgba(99,102,241,0.08)", pointerEvents:"none" }}/>
      <div style={{ position:"absolute", bottom:-80, left:-60, width:240, height:240, borderRadius:"50%", background:"rgba(16,185,129,0.06)", pointerEvents:"none" }}/>

      {/* pill */}
      <div style={{
        marginTop: 40,
        background: phase==="ready"
          ? "linear-gradient(135deg,rgba(22,163,74,0.9),rgba(21,128,61,0.9))"
          : "rgba(255,255,255,0.07)",
        backdropFilter: "blur(16px)",
        border:`1px solid ${phase==="ready"?"rgba(74,222,128,0.5)":"rgba(255,255,255,0.12)"}`,
        borderRadius:50, padding:"10px 32px",
        fontWeight:900, fontSize:24, color:"#fff",
        letterSpacing:"0.08em", fontVariantNumeric:"tabular-nums",
        boxShadow: phase==="ready"?"0 0 30px rgba(22,163,74,0.5)":"0 2px 20px rgba(0,0,0,0.4)",
        transition:"all 0.4s",
      }}>
        {phase==="ready" ? "✅ جاهز!" : phase==="claimed" ? "🎁" : phase==="countdown" ? `${mm}:${ss}` : "💎"}
      </div>

      {/* card */}
      <div style={{
        marginTop:18, width:"100%", maxWidth:420,
        background:"rgba(255,255,255,0.04)",
        border:"1px solid rgba(255,255,255,0.09)",
        borderRadius:24, overflow:"hidden",
        boxShadow:"0 16px 60px rgba(0,0,0,0.5)",
      }}>
        {/* header */}
        <div style={{
          padding:"18px 18px 14px",
          background:"linear-gradient(135deg,rgba(14,165,233,0.12),rgba(99,102,241,0.08))",
          borderBottom:"1px solid rgba(255,255,255,0.06)",
          display:"flex", alignItems:"center", gap:14,
        }}>
          <div style={{
            width:48, height:48, borderRadius:"50%", flexShrink:0,
            background:"linear-gradient(135deg,#0ea5e9,#6366f1)",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:24,
            boxShadow:"0 4px 16px rgba(14,165,233,0.4)",
          }}>📺</div>
          <div style={{flex:1}}>
            <p style={{fontSize:16, fontWeight:900, color:"#fff", margin:0}}>
              {phase==="idle"      ? "شاهد إعلاناً واكسب نقاطاً"     :
               phase==="loading"   ? "جاري تحميل الإعلان..."          :
               phase==="showing"   ? "الإعلان يُعرض الآن..."          :
               phase==="countdown" ? "شكراً! انتظر العداد"            :
               phase==="ready"     ? "مبروك! استلم مكافأتك"           :
                                     "تم الاستلام!"}
            </p>
            <p style={{fontSize:12, color:"rgba(255,255,255,0.4)", margin:"4px 0 0"}}>
              {phase==="idle"      ? "اضغط لبدء الإعلان"                          :
               phase==="loading"   ? "انتظر لحظة..."                              :
               phase==="showing"   ? "لا تغلق الشاشة — شاهد الإعلان كاملاً"      :
               phase==="countdown" ? `انتظر ${mm}:${ss} ثم استلم`                 :
               phase==="ready"     ? "اضغط زر الاستلام أدناه"                    :
                                     "تمت إضافة النقاط لحسابك ✓"}
            </p>
          </div>
        </div>

        {/* steps */}
        <div style={{padding:"14px 18px", display:"flex", flexDirection:"column", gap:8}}>
          {steps.map((step, i) => (
            <div key={i} style={{
              display:"flex", alignItems:"center", gap:12,
              background: step.done?"rgba(22,163,74,0.08)":"rgba(255,255,255,0.03)",
              border:`1px solid ${step.done?"rgba(74,222,128,0.2)":"rgba(255,255,255,0.05)"}`,
              borderRadius:12, padding:"10px 14px", transition:"all 0.3s",
            }}>
              <span style={{fontSize:18, minWidth:24, textAlign:"center"}}>
                {step.done ? "✅" : `${i+1}️⃣`}
              </span>
              <span style={{fontSize:13, fontWeight:step.done?700:400,
                color:step.done?"rgba(255,255,255,0.85)":"rgba(255,255,255,0.4)"}}>
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {/* error */}
        {errMsg && (
          <div style={{padding:"0 18px 10px"}}>
            <div style={{background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", borderRadius:12, padding:"10px 14px"}}>
              <p style={{fontSize:12, color:"rgba(239,68,68,0.85)", margin:0, textAlign:"center"}}>⚠️ {errMsg}</p>
            </div>
          </div>
        )}

        {/* buttons */}
        <div style={{padding:"10px 18px 20px", display:"flex", flexDirection:"column", gap:10}}>

          {/* START */}
          {phase === "idle" && (
            <button onClick={handleStartAd} style={{
              width:"100%", height:58, borderRadius:16, border:"none",
              background:"linear-gradient(135deg,#6366f1,#0ea5e9)",
              color:"#fff", fontWeight:900, fontSize:17, cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center", gap:10,
              boxShadow:"0 4px 28px rgba(99,102,241,0.5)",
              animation:"startPulse 1.5s ease-in-out infinite",
            }}>
              <span style={{fontSize:22}}>▶️</span>
              ابدأ مشاهدة الإعلان
            </button>
          )}

          {/* LOADING */}
          {(phase==="loading" || phase==="showing") && (
            <div style={{
              width:"100%", height:58, borderRadius:16,
              background:"rgba(99,102,241,0.1)", border:"1px solid rgba(99,102,241,0.2)",
              display:"flex", alignItems:"center", justifyContent:"center", gap:14,
            }}>
              <div style={{
                width:22, height:22, border:"3px solid rgba(99,102,241,0.3)",
                borderTopColor:"#6366f1", borderRadius:"50%",
                animation:"spin 0.8s linear infinite",
              }}/>
              <span style={{color:"rgba(255,255,255,0.5)", fontSize:14, fontWeight:600}}>
                {phase==="loading" ? "جاري تحميل الإعلان..." : "يُعرض الإعلان — لا تغلق الشاشة"}
              </span>
            </div>
          )}

          {/* COUNTDOWN */}
          {phase==="countdown" && (
            <div style={{
              width:"100%", height:58, borderRadius:16,
              background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)",
              display:"flex", alignItems:"center", justifyContent:"center", gap:12,
            }}>
              <span style={{fontSize:22}}>⏳</span>
              <span style={{color:"rgba(255,255,255,0.5)", fontSize:16, fontWeight:700}}>
                انتظر {mm}:{ss}
              </span>
            </div>
          )}

          {/* CLAIM */}
          {(phase==="ready" || phase==="claimed") && (
            <button onClick={handleClaim} disabled={phase==="claimed"} style={{
              width:"100%", height:58, borderRadius:16, border:"none",
              background: phase==="claimed"
                ? "rgba(22,163,74,0.3)"
                : "linear-gradient(135deg,#16a34a,#15803d)",
              color:"#fff", fontWeight:900, fontSize:17,
              cursor: phase==="claimed"?"not-allowed":"pointer",
              display:"flex", alignItems:"center", justifyContent:"center", gap:10,
              boxShadow: phase==="ready"?"0 4px 28px rgba(22,163,74,0.6)":"none",
              animation: phase==="ready"?"claimPulse 1.2s ease-in-out infinite":"none",
            }}>
              <span style={{fontSize:22}}>🎁</span>
              {phase==="ready"
                ? `استلم مكافأتك${rewardLabel ? ` (${rewardLabel})` : ""}!`
                : "تم الاستلام ✓"}
            </button>
          )}

          {/* SKIP */}
          <button onClick={onClose} style={{
            width:"100%", height:44, borderRadius:14, border:"none",
            background:"rgba(255,255,255,0.04)", color:"rgba(255,255,255,0.3)",
            fontWeight:600, fontSize:13, cursor:"pointer",
          }}>
            استمر بدون مكافأة
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin       { to { transform:rotate(360deg); } }
        @keyframes startPulse { 0%,100%{box-shadow:0 4px 28px rgba(99,102,241,0.5)} 50%{box-shadow:0 4px 40px rgba(99,102,241,0.85),0 0 0 8px rgba(99,102,241,0.1)} }
        @keyframes claimPulse { 0%,100%{box-shadow:0 4px 28px rgba(22,163,74,0.6)} 50%{box-shadow:0 4px 40px rgba(22,163,74,0.9),0 0 0 8px rgba(22,163,74,0.12)} }
      `}</style>
    </div>
  );
}
