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

  // Daily-rotating ad thumbnails — one per day (cycles every 5 days)
  function getDailyThumbnail(): React.ReactNode {
    const dayIndex = Math.floor(Date.now() / 86_400_000) % 5;

    const thumbnails: React.ReactNode[] = [
      // Day 0 — Real casino image
      <img
        src="/ad-thumbnail.png"
        alt="ad"
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />,

      // Day 1 — Crypto / earn money
      <div style={{
        width:"100%", height:"100%",
        background:"linear-gradient(135deg,#0f0c29,#302b63,#24243e)",
        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8,
      }}>
        <div style={{ fontSize:52 }}>₿</div>
        <p style={{ color:"#f59e0b", fontWeight:900, fontSize:22, margin:0, textAlign:"center", textShadow:"0 0 20px rgba(245,158,11,0.6)" }}>Earn Crypto Daily!</p>
        <p style={{ color:"rgba(255,255,255,0.6)", fontSize:13, margin:0 }}>Trade & earn up to 300% APY</p>
        <div style={{ display:"flex", gap:6, marginTop:4 }}>
          {["🪙","💎","🚀"].map((e,i) => <span key={i} style={{ fontSize:22 }}>{e}</span>)}
        </div>
      </div>,

      // Day 2 — Gaming / Win prizes
      <div style={{
        width:"100%", height:"100%",
        background:"linear-gradient(135deg,#1a0533,#3d0070,#6a0dad)",
        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8,
      }}>
        <div style={{ fontSize:50 }}>🎮</div>
        <p style={{ color:"#fff", fontWeight:900, fontSize:22, margin:0, textAlign:"center" }}>WIN BIG PRIZES!</p>
        <p style={{ color:"#e879f9", fontSize:13, margin:0 }}>Play & Win up to $10,000</p>
        <div style={{
          background:"linear-gradient(135deg,#a855f7,#ec4899)",
          borderRadius:20, padding:"6px 20px", marginTop:4,
          color:"#fff", fontWeight:800, fontSize:14,
        }}>PLAY FREE NOW</div>
      </div>,

      // Day 3 — Shopping / Deals
      <div style={{
        width:"100%", height:"100%",
        background:"linear-gradient(135deg,#0d1b2a,#1b4332,#2d6a4f)",
        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8,
      }}>
        <div style={{ fontSize:50 }}>🛍️</div>
        <p style={{ color:"#fff", fontWeight:900, fontSize:20, margin:0, textAlign:"center" }}>MEGA SALE — 90% OFF</p>
        <p style={{ color:"#6ee7b7", fontSize:13, margin:0 }}>Limited time offer today only!</p>
        <div style={{
          background:"#f59e0b", borderRadius:20, padding:"6px 20px", marginTop:4,
          color:"#000", fontWeight:900, fontSize:14,
        }}>SHOP NOW 🔥</div>
      </div>,

      // Day 4 — App / Download
      <div style={{
        width:"100%", height:"100%",
        background:"linear-gradient(135deg,#0ea5e9,#2563eb,#1e1b4b)",
        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8,
      }}>
        <div style={{ fontSize:50 }}>📱</div>
        <p style={{ color:"#fff", fontWeight:900, fontSize:20, margin:0, textAlign:"center" }}>New App — Install Free</p>
        <p style={{ color:"rgba(255,255,255,0.7)", fontSize:13, margin:0 }}>⭐⭐⭐⭐⭐  4.9 · 10M+ Downloads</p>
        <div style={{
          background:"#22c55e", borderRadius:20, padding:"6px 20px", marginTop:4,
          color:"#fff", fontWeight:800, fontSize:14,
        }}>INSTALL NOW ↓</div>
      </div>,
    ];

    return thumbnails[dayIndex];
  }

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
    const dailyThumb = useRef(getDailyThumbnail());

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

    // Loading screen — transparent so Monetag ad shows on top
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
          marginTop: 28, flexShrink: 0,
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

          {/* === DAILY ROTATING THUMBNAIL === */}
          {(phase === "idle" || phase === "error") && (
            <div
              onClick={handleStartAd}
              style={{
                position: "relative", width: "100%", height: 260,
                overflow: "hidden", cursor: "pointer",
                borderRadius: "24px 24px 0 0",
              }}
            >
              {dailyThumb.current}

              {/* gradient overlay at bottom */}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0, height: 80,
                background: "linear-gradient(to top,rgba(13,20,32,1) 0%,transparent 100%)",
                pointerEvents: "none",
              }}/>

              {/* play button */}
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                pointerEvents: "none",
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: "50%",
                  background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
                  border: "2px solid rgba(255,255,255,0.7)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 0 30px rgba(255,255,255,0.25)",
                  animation: "thumbPulse 2s ease-in-out infinite",
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                    <polygon points="6,3 20,12 6,21" />
                  </svg>
                </div>
              </div>

              {/* AD badge */}
              <div style={{
                position: "absolute", top: 12, left: 12,
                background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 6, padding: "2px 9px",
                color: "rgba(255,255,255,0.75)", fontSize: 10, fontWeight: 700,
                pointerEvents: "none",
              }}>AD · 18+</div>
            </div>
          )}

          {/* steps — no numbers, only checkmarks */}
          <div style={{ padding: "14px 14px 0" }}>
            {[
              { label: "اضغط على الإعلان للبدء", done: phase !== "idle" },
              { label: "شاهد الإعلان كاملاً", done: ["countdown","ready","claimed"].includes(phase) },
              { label: "استلم مكافأتك", done: phase === "ready" || phase === "claimed" },
            ].map((step, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 10, marginBottom: 7,
                background: step.done ? "rgba(22,163,74,0.08)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${step.done ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.05)"}`,
                borderRadius: 10, padding: "9px 12px", transition: "all 0.3s",
              }}>
                <span style={{ fontSize: 16, minWidth: 22, textAlign: "center" }}>
                  {step.done ? "✅" : "⬜"}
                </span>
                <span style={{
                  fontSize: 12, fontWeight: step.done ? 700 : 400,
                  color: step.done ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.4)",
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
                ابدأ المشاهدة
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
  