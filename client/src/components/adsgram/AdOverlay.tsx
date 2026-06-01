import { useState, useRef, useCallback, useEffect } from "react";
import { translations } from "@/lib/i18n";
import { showMonetagAd } from "@/lib/monetag";

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
  lang = "ar",
}: AdOverlayProps) {
  const t = translations[lang as keyof typeof translations] || translations["ar"];
  const [phase, setPhase] = useState<Phase>("loading");
  const [timeLeft, setTimeLeft] = useState(seconds);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  useEffect(() => {
    // Use the interstitial ad (zone 11003103) — works inside Telegram WebApp
    showMonetagAd().then(() => {
      // Ad triggered — wait a moment then start countdown
      setTimeout(startCountdown, 600);
    }).catch(() => {
      // If ad fails, still start countdown so user isn't stuck
      setTimeout(startCountdown, 600);
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
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

  // Loading: small non-blocking pill so the interstitial can appear freely
  if (phase === "loading") {
    return (
      <div style={{
        position: "fixed", top: 14, left: "50%", transform: "translateX(-50%)",
        zIndex: 999999,
        background: "rgba(0,0,0,0.82)", backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.12)", borderRadius: 40,
        padding: "10px 22px", display: "flex", alignItems: "center", gap: 10,
        pointerEvents: "none",
      }}>
        <div style={{
          width: 16, height: 16,
          border: "2.5px solid rgba(14,165,233,0.3)", borderTopColor: "#0ea5e9",
          borderRadius: "50%", animation: "adSpin 0.8s linear infinite", flexShrink: 0,
        }} />
        <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>
          {t.ad_loading || "جاري تحميل الإعلان..."}
        </span>
        <style>{`@keyframes adSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Countdown / ready / claimed — floating controls above the Monetag interstitial
  return (
    <>
      {/* Top-right countdown badge */}
      <div style={{
        position: "fixed", top: 14, right: 14,
        zIndex: 999999,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
      }}>
        <button
          onClick={isReady ? handleClaim : undefined}
          style={{
            width: 54, height: 54, borderRadius: "50%", border: "none",
            background: isClaimed
              ? "#16a34a"
              : isReady
                ? "linear-gradient(135deg,#16a34a,#15803d)"
                : "rgba(0,0,0,0.82)",
            backdropFilter: "blur(10px)",
            outline: isReady ? "2.5px solid rgba(74,222,128,0.85)" : "2px solid rgba(255,255,255,0.22)",
            color: "#fff",
            fontWeight: 900,
            fontSize: isReady ? 22 : 19,
            cursor: isReady ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: isReady
              ? "0 0 28px rgba(22,163,74,0.75)"
              : "0 2px 16px rgba(0,0,0,0.7)",
            transition: "background 0.3s, box-shadow 0.3s",
            animation: isReady
              ? "readyPop 0.35s ease-out, claimGlow 1.2s ease-in-out infinite 0.35s"
              : "none",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          {isClaimed ? "✓" : isReady ? "✕" : timeLeft}
        </button>

        {isReady && rewardLabel && (
          <div style={{
            background: "linear-gradient(135deg,#16a34a,#15803d)",
            borderRadius: 30, padding: "4px 12px",
            color: "#fff", fontSize: 11, fontWeight: 800,
            textAlign: "center",
            boxShadow: "0 4px 14px rgba(22,163,74,0.5)",
            animation: "readyPop 0.4s ease-out",
            whiteSpace: "nowrap",
          }}>
            {rewardLabel}
          </div>
        )}
      </div>

      {/* Skip button — bottom center, only during countdown */}
      {phase === "countdown" && (
        <button
          onClick={onClose}
          style={{
            position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
            zIndex: 999999,
            background: "rgba(0,0,0,0.68)", backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.14)", borderRadius: 40,
            color: "rgba(255,255,255,0.48)", fontSize: 13, fontWeight: 600,
            padding: "11px 32px", cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {t?.redeem_continue_no_reward || "استمر بدون مكافأة"}
        </button>
      )}

      <style>{`
        @keyframes readyPop {
          0%   { transform: scale(0.6); }
          65%  { transform: scale(1.25); }
          100% { transform: scale(1); }
        }
        @keyframes claimGlow {
          0%,100% { box-shadow: 0 0 28px rgba(22,163,74,0.75); }
          50%      { box-shadow: 0 0 44px rgba(22,163,74,1); }
        }
      `}</style>
    </>
  );
}
