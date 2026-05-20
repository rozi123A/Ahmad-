import { useEffect, useState, useRef } from "react";

interface AdOverlayProps {
  seconds?: number;
  rewardLabel?: string;
  onClaim: () => void;
  onClose: () => void;
}

export default function AdOverlay({ seconds = 15, rewardLabel, onClaim, onClose }: AdOverlayProps) {
  const [timeLeft, setTimeLeft]   = useState(seconds);
  const [claimed,  setClaimed]    = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const origOpenRef = useRef<typeof window.open | null>(null);

  useEffect(() => {
    // Block intent:// market:// tg:// inside Telegram WebView
    origOpenRef.current = window.open.bind(window);
    (window as any).open = (url?: string | URL, ..._args: unknown[]) => {
      const str = url ? url.toString() : "";
      if (str.startsWith("https://") || str.startsWith("http://")) {
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.openLink) { tg.openLink(str, { try_instant_view: false }); return null; }
        return origOpenRef.current!(str, "_blank");
      }
      return null; // Block intent://, market://, tg://, etc.
    };

    // Trigger Monetag Rewarded Interstitial (zone 11035304) inline
    const tryShow = () => {
      try {
        const fn = (window as any)["show_11035304"];
        if (typeof fn === "function") { fn(); return true; }
      } catch {}
      return false;
    };
    if (!tryShow()) {
      let attempts = 0;
      const poll = setInterval(() => {
        if (tryShow() || ++attempts >= 8) clearInterval(poll);
      }, 500);
    }

    // Start countdown
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (origOpenRef.current) (window as any).open = origOpenRef.current;
    };
  }, []);

  const canClaim = timeLeft === 0 && !claimed;
  const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const ss = String(timeLeft % 60).padStart(2, "0");
  const prog = ((seconds - timeLeft) / seconds) * 100;
  const circumference = 2 * Math.PI * 62;

  const handleClaim = () => {
    if (!canClaim) return;
    setClaimed(true);
    onClaim();
    setTimeout(() => onClose(), 600);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "linear-gradient(180deg,#070711 0%,#0d1128 100%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 28, padding: "24px 20px",
      fontFamily: "'Segoe UI',sans-serif",
    }}>
      {/* Glow bg */}
      <div style={{
        position: "absolute", top: "-15%", left: "50%", transform: "translateX(-50%)",
        width: 320, height: 320, borderRadius: "50%",
        background: "radial-gradient(circle,rgba(124,58,237,0.22) 0%,transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Icon */}
      <div style={{
        width: 96, height: 96, borderRadius: "50%",
        background: "linear-gradient(135deg,#7C3AED,#4F46E5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 48, boxShadow: "0 0 60px rgba(124,58,237,0.5)",
        position: "relative", zIndex: 1,
      }}>
        📺
      </div>

      {/* Title */}
      <div style={{ textAlign: "center", zIndex: 1 }}>
        <p style={{ color: "#fff", fontSize: 20, fontWeight: 900, margin: 0 }}>
          مشاهدة الإعلان
        </p>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
          {canClaim
            ? "🎉 انتهى الإعلان! استلم مكافأتك"
            : "انتظر حتى اكتمال العداد لاستلام نقاطك"}
        </p>
      </div>

      {/* Circular countdown */}
      <div style={{ position: "relative", width: 140, height: 140, zIndex: 1 }}>
        <svg width="140" height="140" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="70" cy="70" r="62" fill="none"
            stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          <circle cx="70" cy="70" r="62" fill="none"
            stroke={canClaim ? "#10B981" : "#7C3AED"} strokeWidth="8"
            strokeDasharray={String(circumference)}
            strokeDashoffset={String(circumference * (1 - prog / 100))}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.5s" }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}>
          <span style={{
            fontSize: 34, fontWeight: 900,
            color: canClaim ? "#10B981" : "#fff",
            fontVariantNumeric: "tabular-nums",
            transition: "color 0.5s",
          }}>
            {mm}:{ss}
          </span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 700 }}>
            ثانية
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        width: "100%", maxWidth: 320, height: 5,
        background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden", zIndex: 1,
      }}>
        <div style={{
          height: "100%",
          width: prog + "%",
          background: canClaim
            ? "linear-gradient(90deg,#10B981,#34D399)"
            : "linear-gradient(90deg,#7C3AED,#60A5FA)",
          borderRadius: 99,
          transition: "width 0.9s linear, background 0.5s",
        }} />
      </div>

      {/* Claim button */}
      <button
        onClick={handleClaim}
        disabled={!canClaim}
        style={{
          width: "100%", maxWidth: 320, height: 60,
          borderRadius: 22, border: "none", zIndex: 1,
          cursor: canClaim ? "pointer" : "not-allowed",
          background: claimed
            ? "rgba(16,185,129,0.15)"
            : canClaim
              ? "linear-gradient(135deg,#10B981,#059669)"
              : "rgba(255,255,255,0.06)",
          color: canClaim ? "#fff" : "rgba(255,255,255,0.25)",
          fontSize: 17, fontWeight: 900,
          transition: "all 0.4s",
          boxShadow: canClaim && !claimed ? "0 8px 32px rgba(16,185,129,0.4)" : "none",
        }}
      >
        {claimed
          ? "✅ تم استلام المكافأة!"
          : canClaim
            ? ("🎁 استلم المكافأة" + (rewardLabel ? " (+" + rewardLabel + ")" : ""))
            : ("⏳ انتظر " + mm + ":" + ss)}
      </button>

      {/* Cancel */}
      {!claimed && (
        <button
          onClick={onClose}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "rgba(255,255,255,0.18)", fontSize: 12, padding: "4px 16px", zIndex: 1,
          }}
        >
          إلغاء
        </button>
      )}
    </div>
  );
}