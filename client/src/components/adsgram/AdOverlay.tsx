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

type Phase = "waiting" | "countdown" | "ready" | "claimed";

export default function AdOverlay({
  seconds = 15,
  rewardLabel,
  onClaim,
  onClose,
  lang = "ar",
}: AdOverlayProps) {
  const t = translations[lang as keyof typeof translations] || translations["ar"];
  const [phase, setPhase] = useState<Phase>("waiting");
  const [timeLeft, setTimeLeft] = useState(seconds);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);

  const startCountdown = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
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
    const tg = (window as any).Telegram?.WebApp;

    // Open the ad page in Telegram's in-app browser
    const adUrl = `${window.location.origin}/ad-view.html`;
    if (tg?.openLink) {
      tg.openLink(adUrl);
    } else {
      window.open(adUrl, "_blank");
    }

    // When user returns from the ad page, start countdown
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        document.removeEventListener("visibilitychange", onVisibility);
        clearTimeout(maxWait);
        setTimeout(startCountdown, 300);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Safety fallback: if visibilitychange never fires (e.g. same-tab), start after 8s
    const maxWait = setTimeout(() => {
      document.removeEventListener("visibilitychange", onVisibility);
      startCountdown();
    }, 8000);

    return () => {
      clearTimeout(maxWait);
      document.removeEventListener("visibilitychange", onVisibility);
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

  // Waiting: full-screen so user knows something is happening
  if (phase === "waiting") {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "linear-gradient(170deg,#0d1420,#131c35)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 18,
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "rgba(14,165,233,0.12)",
          border: "2px solid rgba(14,165,233,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: "pulse 1.5s ease-in-out infinite",
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="4" width="20" height="14" rx="3" fill="rgba(14,165,233,0.8)"/>
            <polygon points="9,8 9,14 16,11" fill="#fff"/>
          </svg>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "#fff", fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
            {t.ad_loading || "جاري فتح الإعلان..."}
          </div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
            شاهد الإعلان ثم ارجع للحصول على مكافأتك
          </div>
        </div>
        <style>{`
          @keyframes pulse {
            0%,100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(14,165,233,0.4); }
            50%      { transform: scale(1.08); box-shadow: 0 0 0 12px rgba(14,165,233,0); }
          }
        `}</style>
      </div>
    );
  }

  // Countdown / ready / claimed — full screen background + controls
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "linear-gradient(170deg,#0d1420,#131c35)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 24,
    }}>
      {/* Center content */}
      <div style={{ textAlign: "center" }}>
        {isReady ? (
          <>
            <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
            <div style={{ color: "#4ade80", fontSize: 20, fontWeight: 800, marginBottom: 6 }}>
              أحسنت! الإعلان انتهى
            </div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
              اضغط ✕ لاستلام مكافأتك
            </div>
          </>
        ) : (
          <>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginBottom: 8 }}>
              جاري احتساب المكافأة...
            </div>
            <div style={{
              fontSize: 64, fontWeight: 900, color: "#fff",
              fontVariantNumeric: "tabular-nums", lineHeight: 1,
            }}>
              {timeLeft}
            </div>
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginTop: 8 }}>
              ثانية
            </div>
          </>
        )}
      </div>

      {/* Claim / skip buttons */}
      {isReady && (
        <button
          onClick={handleClaim}
          style={{
            padding: "16px 48px", borderRadius: 50, border: "none",
            background: isClaimed ? "#16a34a" : "linear-gradient(135deg,#16a34a,#15803d)",
            color: "#fff", fontSize: 18, fontWeight: 900, cursor: "pointer",
            boxShadow: "0 8px 32px rgba(22,163,74,0.5)",
            animation: "readyPop 0.35s ease-out",
            display: "flex", alignItems: "center", gap: 10,
          }}
        >
          {isClaimed ? "✓" : "✕"} {rewardLabel || "استلام المكافأة"}
        </button>
      )}

      {phase === "countdown" && (
        <button
          onClick={onClose}
          style={{
            padding: "10px 28px", borderRadius: 40, border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.05)",
            color: "rgba(255,255,255,0.35)", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          {t?.redeem_continue_no_reward || "استمر بدون مكافأة"}
        </button>
      )}

      <style>{`
        @keyframes readyPop {
          0%   { transform: scale(0.85); }
          65%  { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
