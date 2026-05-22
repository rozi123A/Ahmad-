import { useState, useRef, useCallback } from "react";
  import { Clock } from "lucide-react";

  interface AdOverlayProps {
    seconds?: number;
    rewardLabel?: string;
    onClaim: () => void;
    onClose: () => void;
  }

  type Phase = "idle" | "showing" | "countdown" | "ready" | "claimed";

  export default function AdOverlay({ seconds = 15, rewardLabel, onClaim, onClose }: AdOverlayProps) {
    const [phase,    setPhase]    = useState<Phase>("idle");
    const [timeLeft, setTimeLeft] = useState(seconds);
    const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
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

    // Wait for user to return from Telegram in-app browser
    const waitForReturn = useCallback((timeoutMs = 10_000) => {
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
      }, timeoutMs);
    }, [startCountdown]);

    const handleStartAd = useCallback(() => {
      if (phase !== "idle") return;

      const tg = (window as any).Telegram?.WebApp;
      // Build the ad-view URL from current origin
      const adViewUrl = `${window.location.origin}/ad-view`;

      setPhase("showing");

      if (tg?.openLink) {
        // Opens in Telegram's built-in in-app browser (X button, minimize, etc.)
        tg.openLink(adViewUrl);
      } else {
        // Fallback for non-Telegram environments
        window.open(adViewUrl, "_blank");
      }

      // Start waiting for user to close the browser and return
      waitForReturn(12_000);
    }, [phase, waitForReturn]);

    const handleClaim = useCallback(() => {
      if (phase !== "ready") return;
      setPhase("claimed");
      onClaim();
      setTimeout(onClose, 300);
    }, [phase, onClaim, onClose]);

    const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
    const ss = String(timeLeft % 60).padStart(2, "0");

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
        {/* bg blobs */}
        <div style={{ position:"absolute", top:-60, right:-60, width:200, height:200, borderRadius:"50%", background:"rgba(99,102,241,0.08)", pointerEvents:"none" }}/>
        <div style={{ position:"absolute", bottom:-80, left:-60, width:240, height:240, borderRadius:"50%", background:"rgba(16,185,129,0.06)", pointerEvents:"none" }}/>

        {/* timer pill */}
        <div style={{
          marginTop: 40,
          background: phase==="ready"
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
          {phase==="ready" ? "✅ جاهز!" : phase==="claimed" ? "🎁" : phase==="countdown" ? `${mm}:${ss}` : "💎"}
        </div>

        {/* card */}
        <div style={{
          marginTop: 18, width: "100%", maxWidth: 420,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 24, overflow: "hidden",
          boxShadow: "0 16px 60px rgba(0,0,0,0.5)",
        }}>
          {/* header */}
          <div style={{
            padding: "18px 18px 14px",
            background: "linear-gradient(135deg,rgba(14,165,233,0.12),rgba(99,102,241,0.08))",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg,#0ea5e9,#6366f1)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
              boxShadow: "0 4px 16px rgba(14,165,233,0.4)",
            }}>📺</div>
            <div style={{flex:1}}>
              <p style={{fontSize:16, fontWeight:900, color:"#fff", margin:0}}>
                {phase==="idle"      ? "شاهد إعلاناً واكسب نقاطاً"     :
                 phase==="showing"   ? "الإعلان مفتوح في Telegram..."    :
                 phase==="countdown" ? "شكراً! انتظر العداد"            :
                 phase==="ready"     ? "مبروك! استلم مكافأتك"           :
                                       "تم الاستلام!"}
              </p>
              <p style={{fontSize:12, color:"rgba(255,255,255,0.4)", margin:"4px 0 0"}}>
                {phase==="idle"      ? "سيفتح الإعلان في متصفح Telegram"              :
                 phase==="showing"   ? "أغلق الإعلان بعد مشاهدته للعودة هنا"          :
                 phase==="countdown" ? `انتظر ${mm}:${ss} ثم استلم`                  :
                 phase==="ready"     ? "اضغط زر الاستلام أدناه"                      :
                                       "تمت إضافة النقاط لحسابك ✓"}
              </p>
            </div>
          </div>

          {/* steps */}
          <div style={{padding:"14px 18px", display:"flex", flexDirection:"column", gap:8}}>
            {steps.map((step, i) => (
              <div key={i} style={{
                display:"flex", alignItems:"center", gap:12,
                background: step.done ? "rgba(22,163,74,0.08)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${step.done ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.05)"}`,
                borderRadius:12, padding:"10px 14px", transition:"all 0.3s",
              }}>
                <span style={{fontSize:18, minWidth:24, textAlign:"center"}}>
                  {step.done ? "✅" : `${i+1}️⃣`}
                </span>
                <span style={{fontSize:13, fontWeight: step.done ? 700 : 400,
                  color: step.done ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.4)"}}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>

          {/* buttons */}
          <div style={{padding:"10px 18px 20px", display:"flex", flexDirection:"column", gap:10}}>

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

            {phase === "showing" && (
              <div style={{
                width:"100%", borderRadius:16,
                background:"rgba(14,165,233,0.08)", border:"1px solid rgba(14,165,233,0.2)",
                padding:"14px 16px", textAlign:"center",
              }}>
                <p style={{color:"rgba(255,255,255,0.6)", fontSize:14, fontWeight:600, margin:"0 0 6px"}}>
                  📲 الإعلان مفتوح في Telegram
                </p>
                <p style={{color:"rgba(255,255,255,0.3)", fontSize:12, margin:0}}>
                  شاهد الإعلان ثم اضغط ✕ للعودة هنا
                </p>
                <div style={{
                  margin:"12px auto 0",
                  width:24, height:24,
                  border:"3px solid rgba(14,165,233,0.3)",
                  borderTopColor:"#0ea5e9", borderRadius:"50%",
                  animation:"spin 0.8s linear infinite",
                }}/>
              </div>
            )}

            {phase === "countdown" && (
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

            {(phase === "ready" || phase === "claimed") && (
              <button onClick={handleClaim} disabled={phase === "claimed"} style={{
                width:"100%", height:58, borderRadius:16, border:"none",
                background: phase==="claimed"
                  ? "rgba(22,163,74,0.3)"
                  : "linear-gradient(135deg,#16a34a,#15803d)",
                color:"#fff", fontWeight:900, fontSize:17,
                cursor: phase==="claimed" ? "not-allowed" : "pointer",
                display:"flex", alignItems:"center", justifyContent:"center", gap:10,
                boxShadow: phase==="claimed" ? "none" : "0 4px 28px rgba(22,163,74,0.45)",
              }}>
                <span style={{fontSize:22}}>{phase==="claimed" ? "✅" : "🎁"}</span>
                {phase==="claimed" ? "تم الاستلام!" : `استلم ${rewardLabel || "المكافأة"}`}
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

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes startPulse {
            0%,100% { box-shadow: 0 4px 28px rgba(99,102,241,0.5); }
            50%      { box-shadow: 0 4px 40px rgba(99,102,241,0.85); }
          }
        `}</style>
      </div>
    );
  }
  