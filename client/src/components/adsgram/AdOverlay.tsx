import { useState, useRef, useCallback } from "react";

interface AdOverlayProps {
  seconds?: number;
  rewardLabel?: string;
  onClaim: () => void;
  onClose: () => void;
}

const ZONE = "11020553";
const SRC  = "https://al5sm.com/tag.min.js";

/* ------------------------------------------------------------------ */
/* Utility: load Monetag script and return the show function           */
/* ------------------------------------------------------------------ */
function ensureScript(): Promise<(() => unknown) | null> {
  return new Promise((resolve) => {
    const existing = (window as any)[`show_${ZONE}`];
    if (typeof existing === "function") { resolve(existing); return; }

    const tag = document.querySelector(`script[data-zone="${ZONE}"]`);
    if (tag) {
      // Script already injected – wait for the function to register
      const t0 = Date.now();
      const poll = setInterval(() => {
        const fn = (window as any)[`show_${ZONE}`];
        if (typeof fn === "function" || Date.now() - t0 > 5000) {
          clearInterval(poll);
          resolve(typeof fn === "function" ? fn : null);
        }
      }, 100);
      return;
    }

    const s = document.createElement("script");
    s.dataset.zone = ZONE;
    s.src = SRC;
    s.async = true;
    document.head.appendChild(s);

    // Wait up to 8 s for show_ZONE to appear
    const t0 = Date.now();
    const poll = setInterval(() => {
      const fn = (window as any)[`show_${ZONE}`];
      if (typeof fn === "function" || Date.now() - t0 > 8000) {
        clearInterval(poll);
        resolve(typeof fn === "function" ? fn : null);
      }
    }, 200);
  });
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */
type Phase =
  | "idle"        // waiting for user to tap "Start"
  | "loading"     // loading Monetag script
  | "showing"     // ad is showing / user watching
  | "countdown"   // ad finished, countdown running
  | "ready"       // countdown done, claim available
  | "claimed";    // reward claimed

export default function AdOverlay({ seconds = 15, rewardLabel, onClaim, onClose }: AdOverlayProps) {
  const [phase,    setPhase]    = useState<Phase>("idle");
  const [timeLeft, setTimeLeft] = useState(seconds);
  const [errMsg,   setErrMsg]   = useState<string | null>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const returnRef = useRef(false); // did user return from ad window?

  /* ---- countdown ---- */
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

  /* ---- visibilitychange: detect user returning from ad browser ---- */
  const attachReturnListener = useCallback(() => {
    const handler = () => {
      if (document.visibilityState === "visible" && !returnRef.current) {
        returnRef.current = true;
        document.removeEventListener("visibilitychange", handler);
        // Small delay then start countdown
        setTimeout(startCountdown, 600);
      }
    };
    document.addEventListener("visibilitychange", handler);
    // Safety: if visibility never fires (same-window ad), start after 3 s
    setTimeout(() => {
      if (!returnRef.current) {
        returnRef.current = true;
        document.removeEventListener("visibilitychange", handler);
        startCountdown();
      }
    }, 3000);
  }, [startCountdown]);

  /* ---- main: called ON button click (user gesture required!) ---- */
  const handleStartAd = useCallback(async () => {
    if (phase !== "idle") return;
    setPhase("loading");
    setErrMsg(null);

    // intercept window.open so we can use tg.openLink if popup is blocked
    const tg = (window as any).Telegram?.WebApp;
    const originalOpen = window.open.bind(window);
    let adOpened = false;

    window.open = (url?: string | URL, target?: string, features?: string) => {
      if (url) {
        adOpened = true;
        const urlStr = String(url);
        try {
          // Try native open first
          const w = originalOpen(urlStr, target ?? "_blank", features ?? "");
          if (w) return w;
        } catch { /* blocked */ }
        // Fallback: Telegram openLink (opens in system browser)
        if (tg?.openLink) tg.openLink(urlStr);
      }
      return null;
    };

    try {
      const showFn = await ensureScript();

      if (!showFn) {
        window.open = originalOpen;
        setErrMsg("تعذّر تحميل الإعلان. تحقق من اتصالك وحاول مجدداً.");
        setPhase("idle");
        return;
      }

      setPhase("showing");

      // Call the Monetag show function — MUST be in user gesture call stack
      await Promise.race([
        Promise.resolve(showFn()),
        new Promise(r => setTimeout(r, 500)), // don't block UI
      ]);

      window.open = originalOpen;

      if (adOpened) {
        // Ad opened in external window — wait for user to return
        attachReturnListener();
      } else {
        // Ad shown inline (in-page format) or nothing opened — start countdown
        setTimeout(startCountdown, 800);
      }

    } catch (err) {
      window.open = originalOpen;
      setErrMsg("حدث خطأ أثناء تشغيل الإعلان. حاول مجدداً.");
      setPhase("idle");
    }
  }, [phase, startCountdown, attachReturnListener]);

  /* ---- claim ---- */
  const handleClaim = useCallback(() => {
    if (phase !== "ready") return;
    setPhase("claimed");
    onClaim();
    setTimeout(() => onClose(), 300);
  }, [phase, onClaim, onClose]);

  /* ---------------------------------------------------------------- */
  const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const ss = String(timeLeft % 60).padStart(2, "0");

  const phaseLabel: Record<Phase, string> = {
    idle:      "اضغط لبدء الإعلان",
    loading:   "⏳ جاري تحميل الإعلان...",
    showing:   "📺 يُعرض الإعلان الآن...",
    countdown: `انتظر ${mm}:${ss}`,
    ready:     "✅ استلم مكافأتك!",
    claimed:   "🎁 تم الاستلام!",
  };

  const steps = [
    { label: "اضغط زر بدء الإعلان",           done: phase !== "idle" },
    { label: "شاهد الإعلان كاملاً",             done: ["countdown","ready","claimed"].includes(phase) },
    { label: "انتظر العداد واستلم مكافأتك",      done: phase === "ready" || phase === "claimed" },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", flexDirection: "column", alignItems: "center",
      background: "linear-gradient(170deg,#0d1420 0%,#131c35 100%)",
      fontFamily: "'Inter','Segoe UI',sans-serif",
      padding: "0 14px",
    }}>

      {/* Glow blobs */}
      <div style={{ position:"absolute", top:-60, right:-60, width:200, height:200, borderRadius:"50%", background:"rgba(99,102,241,0.08)", pointerEvents:"none" }} />
      <div style={{ position:"absolute", bottom:-80, left:-60, width:240, height:240, borderRadius:"50%", background:"rgba(16,185,129,0.06)", pointerEvents:"none" }} />

      {/* Countdown pill */}
      <div style={{
        marginTop: 40,
        background: phase === "ready"
          ? "linear-gradient(135deg,rgba(22,163,74,0.9),rgba(21,128,61,0.9))"
          : "rgba(255,255,255,0.07)",
        backdropFilter: "blur(16px)",
        border: `1px solid ${phase==="ready" ? "rgba(74,222,128,0.5)" : "rgba(255,255,255,0.12)"}`,
        borderRadius: 50, padding: "10px 32px",
        fontWeight: 900, fontSize: 24, color: "#fff",
        letterSpacing: "0.08em", fontVariantNumeric: "tabular-nums",
        boxShadow: phase==="ready" ? "0 0 30px rgba(22,163,74,0.5)" : "0 2px 20px rgba(0,0,0,0.4)",
        transition: "all 0.4s",
      }}>
        {phase === "ready" ? "✅ جاهز!" : phase === "claimed" ? "🎁" : ["countdown"].includes(phase) ? `${mm}:${ss}` : "💎"}
      </div>

      {/* Card */}
      <div style={{
        marginTop: 18, width: "100%", maxWidth: 420,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: 24, overflow: "hidden",
        boxShadow: "0 16px 60px rgba(0,0,0,0.5)",
      }}>
        {/* Header */}
        <div style={{
          padding: "18px 18px 14px",
          background: "linear-gradient(135deg,rgba(14,165,233,0.12),rgba(99,102,241,0.08))",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{
            width:48, height:48, borderRadius:"50%", flexShrink:0,
            background: "linear-gradient(135deg,#0ea5e9,#6366f1)",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:24,
            boxShadow:"0 4px 16px rgba(14,165,233,0.4)",
          }}>📺</div>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:16, fontWeight:900, color:"#fff", margin:0 }}>
              {phase === "idle"      ? "شاهد إعلاناً واكسب نقاطاً"   :
               phase === "loading"   ? "جاري التحميل..."             :
               phase === "showing"   ? "الإعلان يُعرض الآن"          :
               phase === "countdown" ? "الإعلان اكتمل — انتظر العداد" :
               phase === "ready"     ? "مبروك! استلم مكافأتك"        :
                                       "تم الاستلام!"}
            </p>
            <p style={{ fontSize:12, color:"rgba(255,255,255,0.4)", margin:"4px 0 0" }}>
              {phaseLabel[phase]}
            </p>
          </div>
        </div>

        {/* Steps */}
        <div style={{ padding:"14px 18px", display:"flex", flexDirection:"column", gap:8 }}>
          {steps.map((step, i) => (
            <div key={i} style={{
              display:"flex", alignItems:"center", gap:12,
              background: step.done ? "rgba(22,163,74,0.08)" : "rgba(255,255,255,0.03)",
              border:`1px solid ${step.done ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.05)"}`,
              borderRadius:12, padding:"10px 14px", transition:"all 0.3s",
            }}>
              <span style={{ fontSize:18, minWidth:24, textAlign:"center" }}>
                {step.done ? "✅" : `${i+1}️⃣`}
              </span>
              <span style={{ fontSize:13, fontWeight: step.done ? 700 : 400,
                color: step.done ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.4)" }}>
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {/* Error */}
        {errMsg && (
          <div style={{ padding:"0 18px 10px" }}>
            <div style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", borderRadius:12, padding:"10px 14px" }}>
              <p style={{ fontSize:12, color:"rgba(239,68,68,0.85)", margin:0, textAlign:"center" }}>
                ⚠️ {errMsg}
              </p>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div style={{ padding:"10px 18px 20px", display:"flex", flexDirection:"column", gap:10 }}>

          {/* START AD — shown only in idle phase */}
          {phase === "idle" && (
            <button onClick={handleStartAd} style={{
              width:"100%", height:58, borderRadius:16, border:"none",
              background:"linear-gradient(135deg,#6366f1,#0ea5e9)",
              color:"#fff", fontWeight:900, fontSize:17,
              cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10,
              boxShadow:"0 4px 28px rgba(99,102,241,0.5)",
              animation:"startPulse 1.5s ease-in-out infinite",
            }}>
              <span style={{ fontSize:22 }}>▶️</span>
              ابدأ مشاهدة الإعلان
            </button>
          )}

          {/* LOADING spinner */}
          {(phase === "loading" || phase === "showing") && (
            <div style={{
              width:"100%", height:58, borderRadius:16,
              background:"rgba(99,102,241,0.1)", border:"1px solid rgba(99,102,241,0.2)",
              display:"flex", alignItems:"center", justifyContent:"center", gap:14,
            }}>
              <div style={{
                width:22, height:22, border:"3px solid rgba(99,102,241,0.3)",
                borderTopColor:"#6366f1", borderRadius:"50%",
                animation:"spin 0.8s linear infinite",
              }} />
              <span style={{ color:"rgba(255,255,255,0.5)", fontSize:14, fontWeight:600 }}>
                {phase === "loading" ? "جاري تحميل الإعلان..." : "يُعرض الإعلان — لا تغلق الشاشة"}
              </span>
            </div>
          )}

          {/* COUNTDOWN waiting */}
          {phase === "countdown" && (
            <div style={{
              width:"100%", height:58, borderRadius:16,
              background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)",
              display:"flex", alignItems:"center", justifyContent:"center", gap:12,
            }}>
              <span style={{ fontSize:22 }}>⏳</span>
              <span style={{ color:"rgba(255,255,255,0.45)", fontSize:16, fontWeight:700 }}>
                انتظر {mm}:{ss}
              </span>
            </div>
          )}

          {/* CLAIM button */}
          {(phase === "ready" || phase === "claimed") && (
            <button onClick={handleClaim} disabled={phase === "claimed"} style={{
              width:"100%", height:58, borderRadius:16, border:"none",
              background: phase==="claimed"
                ? "rgba(22,163,74,0.3)"
                : "linear-gradient(135deg,#16a34a,#15803d)",
              color:"#fff", fontWeight:900, fontSize:17,
              cursor: phase==="claimed" ? "not-allowed" : "pointer",
              display:"flex", alignItems:"center", justifyContent:"center", gap:10,
              boxShadow: phase==="ready" ? "0 4px 28px rgba(22,163,74,0.6)" : "none",
              animation: phase==="ready" ? "claimPulse 1.2s ease-in-out infinite" : "none",
            }}>
              <span style={{ fontSize:22 }}>🎁</span>
              {phase==="ready"
                ? `استلم مكافأتك${rewardLabel ? ` (${rewardLabel})` : ""}!`
                : "تم الاستلام ✓"}
            </button>
          )}

          {/* Skip */}
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
        @keyframes spin        { to { transform:rotate(360deg); } }
        @keyframes startPulse  { 0%,100%{box-shadow:0 4px 28px rgba(99,102,241,0.5)} 50%{box-shadow:0 4px 40px rgba(99,102,241,0.85),0 0 0 8px rgba(99,102,241,0.1)} }
        @keyframes claimPulse  { 0%,100%{box-shadow:0 4px 28px rgba(22,163,74,0.6)} 50%{box-shadow:0 4px 40px rgba(22,163,74,0.9),0 0 0 8px rgba(22,163,74,0.12)} }
      `}</style>
    </div>
  );
}
