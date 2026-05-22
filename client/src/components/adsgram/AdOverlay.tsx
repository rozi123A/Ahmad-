import { useState, useRef, useCallback } from "react";

  interface AdOverlayProps {
    seconds?: number;
    rewardLabel?: string;
    onClaim: () => void;
    onClose: () => void;
    monetagZoneId?: string;
    monetagScriptUrl?: string;
  }

  type Phase = "idle" | "loading" | "countdown" | "ready" | "claimed" | "error";

  export default function AdOverlay({
    seconds = 15,
    rewardLabel,
    onClaim,
    onClose,
    monetagZoneId = "11043107",
    monetagScriptUrl = "https://n6wxm.com/vignette.min.js",
  }: AdOverlayProps) {
    const [phase, setPhase] = useState<Phase>("idle");
    const [timeLeft, setTimeLeft] = useState(seconds);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const scriptRef = useRef<HTMLScriptElement | null>(null);
    const adDoneRef = useRef(false);

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

    const openAdFallback = useCallback(() => {
      const tg = (window as any).Telegram?.WebApp;
      const adViewUrl = `${window.location.origin}/ad-view`;
      adDoneRef.current = false;
      const handler = () => {
        if (document.visibilityState === "visible" && !adDoneRef.current) {
          adDoneRef.current = true;
          document.removeEventListener("visibilitychange", handler);
          clearTimeout(fallbackTimer);
          setTimeout(startCountdown, 400);
        }
      };
      document.addEventListener("visibilitychange", handler);
      const fallbackTimer = setTimeout(() => {
        if (!adDoneRef.current) {
          adDoneRef.current = true;
          document.removeEventListener("visibilitychange", handler);
          startCountdown();
        }
      }, 12_000);
      if (tg?.openLink) {
        tg.openLink(adViewUrl);
      } else {
        window.open(adViewUrl, "_blank");
      }
    }, [startCountdown]);

    const loadAdScript = useCallback(() => {
      if (scriptRef.current) {
        scriptRef.current.remove();
        scriptRef.current = null;
      }
      (window as any).monetag_zone_id = monetagZoneId;
      const script = document.createElement("script");
      script.src = `${monetagScriptUrl}?zone=${monetagZoneId}&t=${Date.now()}`;
      script.async = true;
      script.setAttribute("data-zone", monetagZoneId);
      script.onload = () => { setTimeout(startCountdown, 2000); };
      script.onerror = () => { openAdFallback(); };
      scriptRef.current = script;
      document.body.appendChild(script);
    }, [monetagZoneId, monetagScriptUrl, startCountdown, openAdFallback]);

    const handleStartAd = useCallback(() => {
      if (phase !== "idle") return;
      setPhase("loading");
      loadAdScript();
    }, [phase, loadAdScript]);

    const handleClaim = useCallback(() => {
      if (phase !== "ready") return;
      setPhase("claimed");
      onClaim();
      setTimeout(onClose, 300);
    }, [phase, onClaim, onClose]);

    const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
    const ss = String(timeLeft % 60).padStart(2, "0");

    const steps = [
      { label: "اضغط زر بدء الإعلان", done: phase !== "idle" },
      { label: "شاهد الإعلان كاملاً", done: ["countdown", "ready", "claimed"].includes(phase) },
      { label: "انتظر العداد واستلم مكافأتك", done: phase === "ready" || phase === "claimed" },
    ];

    // While ad loads — hide our overlay so Monetag renders on top
    if (phase === "loading") {
      return (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10,
          background: "transparent", pointerEvents: "none",
        }}>
          <div style={{
            position: "absolute", bottom: 80, left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.15)", borderRadius: 50,
            padding: "10px 22px",
            display: "flex", alignItems: "center", gap: 10,
            pointerEvents: "auto",
            boxShadow: "0 4px 30px rgba(0,0,0,0.6)",
          }}>
            <div style={{
              width: 18, height: 18,
              border: "2px solid rgba(14,165,233,0.3)", borderTopColor: "#0ea5e9",
              borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0,
            }} />
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>جاري تحميل الإعلان...</span>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      );
    }

    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", flexDirection: "column", alignItems: "center",
        background: "linear-gradient(170deg,#0d1420 0%,#131c35 100%)",
        fontFamily: "'Inter','Segoe UI',sans-serif",
        padding: "0 14px", overflowY: "auto",
      }}>
        <div style={{ position:"absolute", top:-60, right:-60, width:200, height:200, borderRadius:"50%", background:"rgba(99,102,241,0.08)", pointerEvents:"none" }}/>
        <div style={{ position:"absolute", bottom:-80, left:-60, width:240, height:240, borderRadius:"50%", background:"rgba(16,185,129,0.06)", pointerEvents:"none" }}/>

        {/* timer pill */}
        <div style={{
          marginTop: 32, flexShrink: 0,
          background: phase === "ready"
            ? "linear-gradient(135deg,rgba(22,163,74,0.9),rgba(21,128,61,0.9))"
            : "rgba(255,255,255,0.07)",
          backdropFilter: "blur(16px)",
          border: `1px solid ${phase === "ready" ? "rgba(74,222,128,0.5)" : "rgba(255,255,255,0.12)"}`,
          borderRadius: 50, padding: "10px 32px",
          fontWeight: 900, fontSize: 24, color: "#fff",
          letterSpacing: "0.08em", fontVariantNumeric: "tabular-nums",
          boxShadow: phase === "ready" ? "0 0 30px rgba(22,163,74,0.5)" : "0 2px 20px rgba(0,0,0,0.4)",
          transition: "all 0.4s",
        }}>
          {phase === "ready" ? "✅ جاهز!" : phase === "claimed" ? "🎁" : phase === "countdown" ? `${mm}:${ss}` : "💎"}
        </div>

        {/* card */}
        <div style={{
          marginTop: 14, width: "100%", maxWidth: 420, flexShrink: 0,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 24, overflow: "hidden",
          boxShadow: "0 16px 60px rgba(0,0,0,0.5)",
        }}>

          {/* === REAL AD THUMBNAIL IMAGE === */}
          {(phase === "idle" || phase === "error") && (
            <div style={{ position: "relative", width: "100%", cursor: "pointer" }} onClick={handleStartAd}>
              <img
                src="/ad-thumbnail.png"
                alt="ad preview"
                style={{
                  width: "100%",
                  display: "block",
                  objectFit: "cover",
                  maxHeight: 220,
                }}
              />
              {/* dark overlay gradient at bottom */}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0, height: 70,
                background: "linear-gradient(to top,rgba(13,20,32,1),transparent)",
              }}/>
              {/* play button centered */}
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{
                  width: 60, height: 60, borderRadius: "50%",
                  background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
                  border: "2px solid rgba(255,255,255,0.6)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 0 30px rgba(255,255,255,0.2)",
                  animation: "thumbPulse 2s ease-in-out infinite",
                }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
                    <polygon points="6,3 20,12 6,21" />
                  </svg>
                </div>
              </div>
              {/* Ad badge */}
              <div style={{
                position: "absolute", top: 10, left: 10,
                background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 6, padding: "2px 8px",
                color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: 700,
              }}>AD · 18+</div>
            </div>
          )}

          {/* header */}
          <div style={{
            padding: "14px 18px 12px",
            background: "linear-gradient(135deg,rgba(14,165,233,0.12),rgba(99,102,241,0.08))",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg,#0ea5e9,#6366f1)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
              boxShadow: "0 4px 16px rgba(14,165,233,0.4)",
            }}>📺</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 15, fontWeight: 900, color: "#fff", margin: 0 }}>
                {phase === "idle" ? "شاهد إعلاناً واكسب نقاطاً" :
                 phase === "countdown" ? "شكراً! انتظر العداد" :
                 phase === "ready" ? "مبروك! استلم مكافأتك" :
                 phase === "error" ? "حدث خطأ، حاول مجدداً" :
                 "تم الاستلام!"}
              </p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", margin: "3px 0 0" }}>
                {phase === "idle" ? "اضغط على الصورة أو الزر أدناه للبدء" :
                 phase === "countdown" ? `انتظر ${mm}:${ss} ثم استلم` :
                 phase === "ready" ? "اضغط زر الاستلام أدناه" :
                 phase === "error" ? "فشل تحميل الإعلان" :
                 "تمت إضافة النقاط لحسابك ✓"}
              </p>
            </div>
          </div>

          {/* steps */}
          <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
            {steps.map((step, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 10,
                background: step.done ? "rgba(22,163,74,0.08)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${step.done ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.05)"}`,
                borderRadius: 10, padding: "9px 12px", transition: "all 0.3s",
              }}>
                <span style={{ fontSize: 16, minWidth: 22, textAlign: "center" }}>
                  {step.done ? "✅" : `${i + 1}️⃣`}
                </span>
                <span style={{
                  fontSize: 12, fontWeight: step.done ? 700 : 400,
                  color: step.done ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.4)"
                }}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>

          {/* buttons */}
          <div style={{ padding: "8px 14px 18px", display: "flex", flexDirection: "column", gap: 9 }}>
            {phase === "idle" && (
              <button onClick={handleStartAd} style={{
                width: "100%", height: 56, borderRadius: 16, border: "none",
                background: "linear-gradient(135deg,#6366f1,#0ea5e9)",
                color: "#fff", fontWeight: 900, fontSize: 16, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                boxShadow: "0 4px 28px rgba(99,102,241,0.5)",
                animation: "startPulse 1.5s ease-in-out infinite",
              }}>
                <span style={{ fontSize: 20 }}>▶️</span>
                ابدأ مشاهدة الإعلان
              </button>
            )}

            {phase === "error" && (
              <button onClick={() => { setPhase("idle"); setTimeLeft(seconds); }} style={{
                width: "100%", height: 56, borderRadius: 16, border: "none",
                background: "linear-gradient(135deg,#dc2626,#b91c1c)",
                color: "#fff", fontWeight: 900, fontSize: 16, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              }}>
                <span style={{ fontSize: 20 }}>🔄</span>
                حاول مجدداً
              </button>
            )}

            {phase === "countdown" && (
              <div style={{
                width: "100%", height: 56, borderRadius: 16,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
              }}>
                <span style={{ fontSize: 20 }}>⏳</span>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 16, fontWeight: 700 }}>
                  انتظر {mm}:{ss}
                </span>
              </div>
            )}

            {(phase === "ready" || phase === "claimed") && (
              <button onClick={handleClaim} disabled={phase === "claimed"} style={{
                width: "100%", height: 56, borderRadius: 16, border: "none",
                background: phase === "claimed"
                  ? "rgba(22,163,74,0.3)"
                  : "linear-gradient(135deg,#16a34a,#15803d)",
                color: "#fff", fontWeight: 900, fontSize: 16,
                cursor: phase === "claimed" ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                boxShadow: phase === "claimed" ? "none" : "0 4px 28px rgba(22,163,74,0.45)",
              }}>
                <span style={{ fontSize: 20 }}>{phase === "claimed" ? "✅" : "🎁"}</span>
                {phase === "claimed" ? "تم الاستلام!" : `استلم ${rewardLabel || "المكافأة"}`}
              </button>
            )}

            <button onClick={onClose} style={{
              width: "100%", height: 40, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)",
              background: "transparent", color: "rgba(255,255,255,0.25)",
              fontWeight: 600, fontSize: 12, cursor: "pointer",
            }}>
              استمر بدون مكافأة
            </button>
          </div>
        </div>

        <div style={{ height: 20, flexShrink: 0 }} />

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes startPulse {
            0%,100% { box-shadow: 0 4px 28px rgba(99,102,241,0.5); }
            50%      { box-shadow: 0 4px 40px rgba(99,102,241,0.85); }
          }
          @keyframes thumbPulse {
            0%,100% { transform: scale(1); box-shadow: 0 0 30px rgba(255,255,255,0.2); }
            50%      { transform: scale(1.08); box-shadow: 0 0 45px rgba(255,255,255,0.35); }
          }
        `}</style>
      </div>
    );
  }
  