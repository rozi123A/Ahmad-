import { useState, useRef, useCallback, useEffect } from "react";
import { translations } from "@/lib/i18n";

interface AdOverlayProps {
  seconds?: number;
  rewardLabel?: string;
  onClaim: () => void;
  onClose: () => void;
  monetagZoneId?: string;
  monetagScriptUrl?: string;
  lang?: string;
}

type Phase = "loading" | "countdown" | "ready" | "claimed";

export default function AdOverlay({
  seconds = 15,
  rewardLabel,
  onClaim,
  onClose,
  monetagZoneId = "11043107",
  monetagScriptUrl = "https://n6wxm.com/vignette.min.js",
  lang = "ar",
}: AdOverlayProps) {
  const t = translations[lang as keyof typeof translations] || translations["ar"];
  const [phase, setPhase] = useState<Phase>("loading");
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
    if (tg?.openLink) tg.openLink(adViewUrl);
    else window.open(adViewUrl, "_blank");
  }, [startCountdown]);

  // Load Monetag script — it will display its own real ad overlay
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
      {/* Loading spinner while Monetag loads its real ad */}
      {phase === "loading" && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(13,20,32,0.92)",
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <div style={{
            background: "rgba(0,0,0,0.85)", backdropFilter: "blur(14px)",
            border: "1px solid rgba(255,255,255,0.12)", borderRadius: 50,
            padding: "14px 28px", display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{
              width: 20, height: 20,
              border: "2.5px solid rgba(14,165,233,0.3)", borderTopColor: "#0ea5e9",
              borderRadius: "50%", animation: "adSpin 0.8s linear infinite", flexShrink: 0,
            }} />
            <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>{t.ad_loading}</span>
          </div>
        </div>
      )}

      {/* Controls floating on top — transparent so Monetag's real ad shows through */}
      {(phase === "countdown" || phase === "ready" || phase === "claimed") && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10000,
          background: "transparent",
          pointerEvents: "none",
        }}>
          {/* Top-right badge: countdown number → ✕ to claim */}
          <button
            onClick={isReady ? handleClaim : undefined}
            style={{
              position: "absolute", top: 16, right: 16,
              width: 52, height: 52, borderRadius: "50%", border: "none",
              background: isClaimed
                ? "rgba(22,163,74,0.95)"
                : isReady
                  ? "linear-gradient(135deg,#16a34a,#15803d)"
                  : "rgba(0,0,0,0.80)",
              backdropFilter: "blur(10px)",
              outline: isReady ? "2.5px solid rgba(74,222,128,0.8)" : "2px solid rgba(255,255,255,0.2)",
              color: "#fff",
              fontWeight: 900,
              fontSize: isReady ? 22 : 18,
              cursor: isReady ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: isReady ? "0 0 24px rgba(22,163,74,0.7)" : "0 2px 14px rgba(0,0,0,0.6)",
              pointerEvents: "auto",
              transition: "background 0.3s, box-shadow 0.3s",
              animation: isReady ? "readyPop 0.35s ease-out, claimGlow 1.2s ease-in-out infinite 0.35s" : "none",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}
          >
            {isClaimed ? "✓" : isReady ? "✕" : timeLeft}
          </button>

          {/* Reward label pill — appears when ready to claim */}
          {isReady && rewardLabel && (
            <div style={{
              position: "absolute", top: 76, right: 8,
              background: "linear-gradient(135deg,#16a34a,#15803d)",
              borderRadius: 30, padding: "5px 14px",
              color: "#fff", fontSize: 12, fontWeight: 800,
              boxShadow: "0 4px 16px rgba(22,163,74,0.5)",
              pointerEvents: "none",
              animation: "readyPop 0.4s ease-out",
              whiteSpace: "nowrap",
            }}>
              {rewardLabel}
            </div>
          )}

          {/* "Continue without reward" button — only during countdown */}
          {phase === "countdown" && (
            <button
              onClick={onClose}
              style={{
                position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)",
                background: "rgba(0,0,0,0.65)", backdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.14)", borderRadius: 40,
                color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: 600,
                padding: "11px 32px", cursor: "pointer", pointerEvents: "auto",
                whiteSpace: "nowrap",
              }}
            >
              {t?.redeem_continue_no_reward || "استمر بدون مكافأة"}
            </button>
          )}
        </div>
      )}

      <style>{`
        @keyframes adSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes readyPop {
          0%   { transform: scale(0.6); }
          65%  { transform: scale(1.25); }
          100% { transform: scale(1); }
        }
        @keyframes claimGlow {
          0%,100% { box-shadow: 0 0 24px rgba(22,163,74,0.7); }
          50%      { box-shadow: 0 0 42px rgba(22,163,74,1); }
        }
      `}</style>
    </>
  );
}
