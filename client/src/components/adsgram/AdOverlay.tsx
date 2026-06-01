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

  useEffect(() => {
    if (scriptRef.current) return;

    // Set zone and load Monetag script immediately — no blocking overlay
    (window as any).monetag_zone_id = monetagZoneId;
    const script = document.createElement("script");
    script.src = `${monetagScriptUrl}?zone=${monetagZoneId}&t=${Date.now()}`;
    script.async = true;
    script.setAttribute("data-zone", monetagZoneId);

    // Small delay before countdown so Monetag vignette renders first
    script.onload = () => { setTimeout(startCountdown, 800); };
    script.onerror = () => { openAdFallback(); };

    scriptRef.current = script;
    document.body.appendChild(script);

    // Fallback: if script doesn't fire onload within 5s, start anyway
    const maxWait = setTimeout(() => {
      if (phase === "loading") startCountdown();
    }, 5000);

    return () => {
      clearTimeout(maxWait);
      if (timerRef.current) clearInterval(timerRef.current);
      if (scriptRef.current) {
        scriptRef.current.remove();
        scriptRef.current = null;
      }
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

  // During loading: show a small non-blocking pill at top — do NOT block Monetag
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

  // During countdown / ready / claimed:
  // Render ONLY floating controls — Monetag's own vignette fills the screen behind
  return (
    <>
      {/* Countdown badge — top-right, above Monetag's vignette (like screenshot) */}
      <div style={{
        position: "fixed", top: 14, right: 14,
        zIndex: 999999,
        pointerEvents: "auto",
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

        {/* Reward pill below the badge */}
        {isReady && rewardLabel && (
          <div style={{
            marginTop: 6,
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

      {/* "Continue without reward" — bottom center, only during countdown */}
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
