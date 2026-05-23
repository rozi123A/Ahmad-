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

  function getDailyThumbnail(): React.ReactNode {
    const dayIndex = Math.floor(Date.now() / 86_400_000) % 5;
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
      if (tg?.openLink) tg.openLink(adViewUrl);
      else window.open(adViewUrl, "_blank");
    }, [startCountdown]);

    const loadAdScript = useCallback(() => {
      if (scriptRef.current) { scriptRef.current.remove(); scriptRef.current = null; }
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

    // ── LOADING: transparent so Monetag shows ──
    if (phase === "loading") {
      return (
        <div style={{ position:"fixed", inset:0, zIndex:10, background:"transparent", pointerEvents:"none" }}>
          <div style={{
            position:"absolute", bottom:80, left:"50%", transform:"translateX(-50%)",
            background:"rgba(0,0,0,0.85)", backdropFilter:"blur(12px)",
            border:"1px solid rgba(255,255,255,0.15)", borderRadius:50,
            padding:"10px 22px", display:"flex", alignItems:"center", gap:10,
            pointerEvents:"auto",
          }}>
            <div style={{ width:18, height:18, border:"2px solid rgba(14,165,233,0.3)", borderTopColor:"#0ea5e9", borderRadius:"50%", animation:"adSpin 0.8s linear infinite", flexShrink:0 }}/>
            <span style={{ color:"#fff", fontSize:13, fontWeight:600 }}>جاري تحميل الإعلان...</span>
          </div>
          <style>{`@keyframes adSpin { to { transform: rotate(360deg); } }`}</style>
        </div>
      );
    }

    // ── COUNTDOWN: ad is visible, small timer badge in top-right corner only ──
    if (phase === "countdown") {
      return (
        <div style={{ position:"fixed", inset:0, zIndex:9999, background:"transparent", pointerEvents:"none" }}>

          {/* small countdown badge — top-right corner */}
          <div style={{
            position:"absolute", top:16, right:16,
            width:42, height:42, borderRadius:"50%",
            background:"rgba(0,0,0,0.75)", backdropFilter:"blur(8px)",
            border:"2px solid rgba(255,255,255,0.2)",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 2px 12px rgba(0,0,0,0.5)",
          }}>
            <span style={{ color:"#fff", fontSize:16, fontWeight:900, fontVariantNumeric:"tabular-nums", lineHeight:1 }}>
              {timeLeft}
            </span>
          </div>

          {/* "استمر بدون مكافأة" — bottom floating */}
          <button
            onClick={onClose}
            style={{
              position:"absolute", bottom:24, left:"50%", transform:"translateX(-50%)",
              background:"rgba(0,0,0,0.65)", backdropFilter:"blur(10px)",
              border:"1px solid rgba(255,255,255,0.12)", borderRadius:40,
              color:"rgba(255,255,255,0.4)", fontSize:13, fontWeight:600,
              padding:"11px 32px", cursor:"pointer", pointerEvents:"auto",
              whiteSpace:"nowrap",
            }}
          >
            استمر بدون مكافأة
          </button>
        </div>
      );
    }

    // ── READY: big X claim button floats over everything ──
    if (phase === "ready" || phase === "claimed") {
      return (
        <div style={{
          position:"fixed", inset:0, zIndex:9999,
          display:"flex", alignItems:"center", justifyContent:"center",
          background:"rgba(0,0,0,0.55)", backdropFilter:"blur(4px)",
          pointerEvents:"auto",
        }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:20 }}>
            <div style={{ fontSize:56, animation: phase==="ready" ? "readyBounce 0.5s ease-out" : "none" }}>🎁</div>
            <p style={{ color:"#fff", fontSize:17, fontWeight:800, margin:0, textAlign:"center", textShadow:"0 2px 12px rgba(0,0,0,0.6)" }}>
              مكافأتك جاهزة!
            </p>
            <button
              onClick={handleClaim}
              disabled={phase==="claimed"}
              style={{
                width:72, height:72, borderRadius:"50%", border:"none",
                background: phase==="claimed" ? "rgba(22,163,74,0.4)" : "linear-gradient(135deg,#16a34a,#15803d)",
                color:"#fff", fontWeight:900, fontSize:30,
                cursor: phase==="claimed" ? "not-allowed" : "pointer",
                display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow: phase==="claimed" ? "none" : "0 6px 40px rgba(22,163,74,0.6)",
                animation: phase==="ready" ? "claimPulse 1.2s ease-in-out infinite" : "none",
                transition:"transform 0.15s",
              }}
            >
              {phase==="claimed" ? "✅" : "✕"}
            </button>
            <span style={{ color:"rgba(255,255,255,0.5)", fontSize:12 }}>
              {phase==="claimed" ? "تم الاستلام!" : `اضغط لاستلام ${rewardLabel || "المكافأة"}`}
            </span>
          </div>
          <style>{`
            @keyframes claimPulse {
              0%,100% { box-shadow: 0 6px 40px rgba(22,163,74,0.6); transform: scale(1); }
              50%      { box-shadow: 0 6px 56px rgba(22,163,74,0.9); transform: scale(1.08); }
            }
            @keyframes readyBounce {
              0%  { transform: scale(0.4); opacity:0; }
              70% { transform: scale(1.25); }
              100%{ transform: scale(1);   opacity:1; }
            }
          `}</style>
        </div>
      );
    }

    // ── IDLE / ERROR: show thumbnail card + start button ──
    return (
      <div style={{
        position:"fixed", inset:0, zIndex:9999,
        display:"flex", flexDirection:"column", alignItems:"center",
        background:"linear-gradient(170deg,#0d1420 0%,#131c35 100%)",
        fontFamily:"'Inter','Segoe UI',sans-serif",
        padding:"0 14px", overflowY:"auto",
      }}>
        <div style={{ position:"absolute", top:-60, right:-60, width:200, height:200, borderRadius:"50%", background:"rgba(99,102,241,0.08)", pointerEvents:"none" }}/>
        <div style={{ position:"absolute", bottom:-80, left:-60, width:240, height:240, borderRadius:"50%", background:"rgba(16,185,129,0.06)", pointerEvents:"none" }}/>

        <div style={{
          marginTop:60, width:"100%", maxWidth:420, flexShrink:0,
          background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.09)",
          borderRadius:24, overflow:"hidden", boxShadow:"0 16px 60px rgba(0,0,0,0.5)",
        }}>
          {/* Thumbnail */}
          <div onClick={phase==="idle" ? handleStartAd : undefined}
            style={{ position:"relative", width:"100%", height:300, overflow:"hidden", cursor: phase==="idle" ? "pointer" : "default" }}
          >
            {dailyThumb.current}
            <div style={{ position:"absolute", bottom:0, left:0, right:0, height:60, background:"linear-gradient(to top,rgba(13,20,32,1),transparent)", pointerEvents:"none" }}/>
          </div>

          {/* Buttons */}
          <div style={{ padding:"14px 14px 18px", display:"flex", flexDirection:"column", gap:10 }}>
            {phase==="idle" && (
              <button onClick={handleStartAd} style={{
                width:"100%", height:58, borderRadius:16, border:"none",
                background:"linear-gradient(135deg,#6366f1,#0ea5e9)",
                color:"#fff", fontWeight:900, fontSize:17, cursor:"pointer",
                display:"flex", alignItems:"center", justifyContent:"center", gap:10,
                boxShadow:"0 4px 28px rgba(99,102,241,0.5)",
                animation:"startPulse 1.5s ease-in-out infinite",
              }}>
                <span style={{ fontSize:22 }}>▶️</span>
                ابدأ المشاهدة
              </button>
            )}
            {phase==="error" && (
              <button onClick={() => { setPhase("idle"); setTimeLeft(seconds); }} style={{
                width:"100%", height:58, borderRadius:16, border:"none",
                background:"linear-gradient(135deg,#dc2626,#b91c1c)",
                color:"#fff", fontWeight:900, fontSize:17, cursor:"pointer",
                display:"flex", alignItems:"center", justifyContent:"center", gap:10,
              }}>
                <span style={{ fontSize:22 }}>🔄</span>
                حاول مجدداً
              </button>
            )}
            <button onClick={onClose} style={{
              width:"100%", height:42, borderRadius:12, border:"1px solid rgba(255,255,255,0.08)",
              background:"transparent", color:"rgba(255,255,255,0.25)",
              fontWeight:600, fontSize:13, cursor:"pointer",
            }}>
              استمر بدون مكافأة
            </button>
          </div>
        </div>

        <div style={{ height:20, flexShrink:0 }}/>
        <style>{`
          @keyframes startPulse {
            0%,100% { box-shadow: 0 4px 28px rgba(99,102,241,0.5); }
            50%      { box-shadow: 0 4px 40px rgba(99,102,241,0.85); }
          }
        `}</style>
      </div>
    );
  }
