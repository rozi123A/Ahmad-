import { useState, useRef, useCallback, useEffect } from "react";

  interface AdOverlayProps {
    seconds?: number;
    rewardLabel?: string;
    onClaim: () => void;
    onClose: () => void;
    monetagZoneId?: string;
    monetagScriptUrl?: string;
  }

  type Phase = "loading" | "countdown" | "ready" | "claimed";

  function getDailyThumbnail(): React.ReactNode {
    const dayIndex = Math.floor(Math.random() * 5);
    const thumbnails: React.ReactNode[] = [
      <img src="/ad-thumbnail.png" alt="ad" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />,
      <div style={{ width:"100%", height:"100%", background:"linear-gradient(135deg,#0f0c29,#302b63,#24243e)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10 }}>
        <div style={{ fontSize:64 }}>₿</div>
        <p style={{ color:"#f59e0b", fontWeight:900, fontSize:26, margin:0, textAlign:"center", textShadow:"0 0 20px rgba(245,158,11,0.6)" }}>Earn Crypto Daily!</p>
        <p style={{ color:"rgba(255,255,255,0.6)", fontSize:15, margin:0 }}>Trade & earn up to 300% APY</p>
        <div style={{ display:"flex", gap:8, marginTop:6 }}>{["🪙","💎","🚀"].map((e,i) => <span key={i} style={{ fontSize:28 }}>{e}</span>)}</div>
      </div>,
      <div style={{ width:"100%", height:"100%", background:"linear-gradient(135deg,#1a0533,#3d0070,#6a0dad)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10 }}>
        <div style={{ fontSize:64 }}>🎮</div>
        <p style={{ color:"#fff", fontWeight:900, fontSize:26, margin:0, textAlign:"center" }}>WIN BIG PRIZES!</p>
        <p style={{ color:"#e879f9", fontSize:15, margin:0 }}>Play & Win up to $10,000</p>
        <div style={{ background:"linear-gradient(135deg,#a855f7,#ec4899)", borderRadius:20, padding:"8px 24px", marginTop:6, color:"#fff", fontWeight:800, fontSize:16 }}>PLAY FREE NOW</div>
      </div>,
      <div style={{ width:"100%", height:"100%", background:"linear-gradient(135deg,#0d1b2a,#1b4332,#2d6a4f)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10 }}>
        <div style={{ fontSize:64 }}>🛍️</div>
        <p style={{ color:"#fff", fontWeight:900, fontSize:24, margin:0, textAlign:"center" }}>MEGA SALE — 90% OFF</p>
        <p style={{ color:"#6ee7b7", fontSize:15, margin:0 }}>Limited time offer today only!</p>
        <div style={{ background:"#f59e0b", borderRadius:20, padding:"8px 24px", marginTop:6, color:"#000", fontWeight:900, fontSize:16 }}>SHOP NOW 🔥</div>
      </div>,
      <div style={{ width:"100%", height:"100%", background:"linear-gradient(135deg,#0ea5e9,#2563eb,#1e1b4b)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10 }}>
        <div style={{ fontSize:64 }}>📱</div>
        <p style={{ color:"#fff", fontWeight:900, fontSize:24, margin:0, textAlign:"center" }}>New App — Install Free</p>
        <p style={{ color:"rgba(255,255,255,0.7)", fontSize:15, margin:0 }}>⭐⭐⭐⭐⭐  4.9 · 10M+ Downloads</p>
        <div style={{ background:"#22c55e", borderRadius:20, padding:"8px 24px", marginTop:6, color:"#fff", fontWeight:800, fontSize:16 }}>INSTALL NOW ↓</div>
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
    const [phase, setPhase] = useState<Phase>("loading");
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
      if (tg?.openLink) tg.openLink(adViewUrl);
      else window.open(adViewUrl, "_blank");
    }, [startCountdown]);

    // Auto-start ad on mount
    useEffect(() => {
      if (scriptRef.current) return;
      (window as any).monetag_zone_id = monetagZoneId;
      const script = document.createElement("script");
      script.src = `${monetagScriptUrl}?zone=${monetagZoneId}&t=${Date.now()}`;
      script.async = true;
      script.setAttribute("data-zone", monetagZoneId);
      script.onload = () => { setTimeout(startCountdown, 2000); };
      script.onerror = () => { openAdFallback(); };
      scriptRef.current = script;
      document.body.appendChild(script);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (scriptRef.current) { scriptRef.current.remove(); scriptRef.current = null; }
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleClaim = useCallback(() => {
      if (phase !== "ready") return;
      setPhase("claimed");
      onClaim();
      setTimeout(onClose, 400);
    }, [phase, onClaim, onClose]);

    const isReady   = phase === "ready";
    const isClaimed = phase === "claimed";

    return (
      <>
        {/* Ad thumbnail shown during countdown / ready */}
        {(phase === "countdown" || phase === "ready" || phase === "claimed") && (
          <div style={{
            position:"fixed", inset:0, zIndex:9999,
            background:"linear-gradient(170deg,#0d1420 0%,#131c35 100%)",
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            {/* thumbnail fills screen */}
            <div style={{ width:"100%", maxWidth:480, height:"100%", maxHeight:360, overflow:"hidden", borderRadius:0 }}>
              {dailyThumb.current}
            </div>
          </div>
        )}

        {/* Overlay controls — transparent on top of ad */}
        {(phase === "countdown" || phase === "ready" || phase === "claimed") && (
          <div style={{ position:"fixed", inset:0, zIndex:10000, background:"transparent", pointerEvents:"none" }}>

            {/* Top-right badge: countdown → ✕ */}
            <button
              onClick={isReady ? handleClaim : undefined}
              style={{
                position:"absolute", top:16, right:16,
                width:50, height:50, borderRadius:"50%", border:"none",
                background: isClaimed
                  ? "rgba(22,163,74,0.9)"
                  : isReady
                    ? "linear-gradient(135deg,#16a34a,#15803d)"
                    : "rgba(0,0,0,0.75)",
                backdropFilter:"blur(8px)",
                outline: isReady ? "2.5px solid rgba(74,222,128,0.8)" : "2px solid rgba(255,255,255,0.2)",
                color:"#fff",
                fontWeight:900,
                fontSize: isReady ? 24 : 18,
                cursor: isReady ? "pointer" : "default",
                display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow: isReady ? "0 0 24px rgba(22,163,74,0.7)" : "0 2px 14px rgba(0,0,0,0.6)",
                pointerEvents:"auto",
                transition:"background 0.3s, box-shadow 0.3s",
                animation: isReady ? "readyPop 0.35s ease-out, claimGlow 1.2s ease-in-out infinite 0.35s" : "none",
                fontVariantNumeric:"tabular-nums",
                lineHeight:1,
              }}
            >
              {isClaimed ? "✅" : isReady ? "✕" : timeLeft}
            </button>

            {/* "Continue without reward" — only during countdown */}
            {phase === "countdown" && (
              <button
                onClick={onClose}
                style={{
                  position:"absolute", bottom:28, left:"50%", transform:"translateX(-50%)",
                  background:"rgba(0,0,0,0.6)", backdropFilter:"blur(10px)",
                  border:"1px solid rgba(255,255,255,0.12)", borderRadius:40,
                  color:"rgba(255,255,255,0.4)", fontSize:13, fontWeight:600,
                  padding:"11px 32px", cursor:"pointer", pointerEvents:"auto",
                  whiteSpace:"nowrap",
                }}
              >
                {t?.redeem_continue_no_reward || "استمر بدون مكافأة"}
              </button>
            )}
          </div>
        )}

        {/* Loading state: spinner pill */}
        {phase === "loading" && (
          <div style={{
            position:"fixed", inset:0, zIndex:9999,
            background:"linear-gradient(170deg,#0d1420 0%,#131c35 100%)",
            display:"flex", alignItems:"center", justifyContent:"center",
            pointerEvents:"none",
          }}>
            <div style={{
              background:"rgba(0,0,0,0.85)", backdropFilter:"blur(14px)",
              border:"1px solid rgba(255,255,255,0.12)", borderRadius:50,
              padding:"14px 28px", display:"flex", alignItems:"center", gap:12,
            }}>
              <div style={{
                width:20, height:20,
                border:"2.5px solid rgba(14,165,233,0.3)", borderTopColor:"#0ea5e9",
                borderRadius:"50%", animation:"adSpin 0.8s linear infinite", flexShrink:0,
              }}/>
              <span style={{ color:"#fff", fontSize:14, fontWeight:700 }}>جاري تحميل الإعلان...</span>
            </div>
          </div>
        )}

        <style>{`
          @keyframes adSpin   { to { transform: rotate(360deg); } }
          @keyframes readyPop {
            0%  { transform: scale(0.6); }
            65% { transform: scale(1.25); }
            100%{ transform: scale(1); }
          }
          @keyframes claimGlow {
            0%,100% { box-shadow: 0 0 24px rgba(22,163,74,0.7); }
            50%      { box-shadow: 0 0 42px rgba(22,163,74,1); }
          }
        `}</style>
      </>
    );
  }
