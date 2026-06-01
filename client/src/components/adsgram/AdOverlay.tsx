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
  const [showManual, setShowManual] = useState(false);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);

  const startCountdown = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    setShowManual(false);
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
    const adUrl = `${window.location.origin}/ad-view.html`;

    // Open the ad page in Telegram's browser
    if (tg?.openLink) {
      tg.openLink(adUrl);
    } else {
      window.open(adUrl, "_blank");
    }

    // ── 1. Telegram WebApp native event (most reliable in Telegram) ──
    const onActivated = () => {
      cleanup();
      setTimeout(startCountdown, 300);
    };
    tg?.onEvent?.("activated", onActivated);

    // ── 2. Page Visibility API ──
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        cleanup();
        setTimeout(startCountdown, 300);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // ── 3. Window focus (desktop / some mobile browsers) ──
    const onFocus = () => {
      cleanup();
      setTimeout(startCountdown, 300);
    };
    window.addEventListener("focus", onFocus);

    // ── 4. Show manual button after 4 s (if none of the above fired) ──
    const manualTimer = setTimeout(() => setShowManual(true), 4000);

    // ── 5. Hard fallback: start countdown after 12 s no matter what ──
    const maxWait = setTimeout(() => {
      cleanup();
      startCountdown();
    }, 12_000);

    function cleanup() {
      tg?.offEvent?.("activated", onActivated);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      clearTimeout(manualTimer);
      clearTimeout(maxWait);
    }

    return () => {
      cleanup();
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

  // ── Waiting screen ──
  if (phase === "waiting") {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "linear-gradient(170deg,#0d1420,#131c35)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 20,
        padding: 24,
      }}>
        {/* Pulsing TV icon */}
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: "rgba(14,165,233,0.1)",
          border: "2px solid rgba(14,165,233,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: "pulse 1.6s ease-in-out infinite",
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="4" width="20" height="14" rx="3" fill="rgba(14,165,233,0.9)"/>
            <line x1="8" y1="21" x2="16" y2="21" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round"/>
            <line x1="12" y1="18" x2="12" y2="21" stroke="rgba(255,255,255,0.5)" strokeWidth="2"/>
            <polygon points="9.5,8.5 9.5,13.5 15.5,11" fill="#fff"/>
          </svg>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ color: "#fff", fontSize: 17, fontWeight: 700, marginBottom: 8 }}>
            {t.ad_loading || "جاري فتح الإعلان..."}
          </div>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, lineHeight: 1.6 }}>
            شاهد الإعلان ثم اضغط رجوع
            <br />للحصول على مكافأتك
          </div>
        </div>

        {/* Manual button — appears after 4s if events don't fire */}
        {showManual && (
          <button
            onClick={() => { startCountdown(); }}
            style={{
              marginTop: 8,
              padding: "13px 36px", borderRadius: 50, border: "none",
              background: "linear-gradient(135deg,#0ea5e9,#2563eb)",
              color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 8px 24px rgba(14,165,233,0.4)",
              animation: "readyPop 0.3s ease-out",
            }}
          >
            ✓ شاهدت الإعلان
          </button>
        )}

        <style>{`
          @keyframes pulse {
            0%,100% { transform:scale(1); box-shadow:0 0 0 0 rgba(14,165,233,0.35); }
            50%      { transform:scale(1.07); box-shadow:0 0 0 14px rgba(14,165,233,0); }
          }
          @keyframes readyPop {
            0%   { transform:scale(0.85); opacity:0; }
            100% { transform:scale(1); opacity:1; }
          }
        `}</style>
      </div>
    );
  }

  // ── Countdown / ready / claimed screen ──
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "linear-gradient(170deg,#0d1420,#131c35)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 28,
      padding: 24,
    }}>
      {isReady ? (
        <>
          <div style={{ fontSize: 64 }}>🎉</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#4ade80", fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
              أحسنت!
            </div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
              اضغط الزر لاستلام مكافأتك
            </div>
          </div>
          <button
            onClick={handleClaim}
            style={{
              padding: "16px 52px", borderRadius: 50, border: "none",
              background: isClaimed ? "#16a34a" : "linear-gradient(135deg,#16a34a,#15803d)",
              color: "#fff", fontSize: 19, fontWeight: 900, cursor: "pointer",
              boxShadow: "0 8px 32px rgba(22,163,74,0.5)",
              animation: "readyPop 0.35s ease-out",
              display: "flex", alignItems: "center", gap: 10,
            }}
          >
            {isClaimed ? "✓" : "✕"}&nbsp;{rewardLabel || "استلام المكافأة"}
          </button>
        </>
      ) : (
        <>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, marginBottom: 12 }}>
              جاري احتساب المكافأة
            </div>
            <div style={{
              fontSize: 80, fontWeight: 900, color: "#fff",
              fontVariantNumeric: "tabular-nums", lineHeight: 1,
              textShadow: "0 0 40px rgba(14,165,233,0.4)",
            }}>
              {timeLeft}
            </div>
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 14, marginTop: 10 }}>
              ثانية
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: "10px 28px", borderRadius: 40,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.3)", fontSize: 13, fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t?.redeem_continue_no_reward || "استمر بدون مكافأة"}
          </button>
        </>
      )}

      <style>{`
        @keyframes readyPop {
          0%   { transform:scale(0.75); }
          70%  { transform:scale(1.06); }
          100% { transform:scale(1); }
        }
      `}</style>
    </div>
  );
}
