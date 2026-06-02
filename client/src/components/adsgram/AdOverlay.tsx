import { useEffect, useRef, useState } from "react";
import { translations } from "@/lib/i18n";

interface AdOverlayProps {
  blockId?: string;
  seconds?: number;
  rewardLabel?: string;
  onClaim: () => void;
  onClose: () => void;
  monetagZoneId?: string;
  monetagScriptUrl?: string;
  lang?: string;
}

export default function AdOverlay({
  blockId,
  seconds = 15,
  rewardLabel,
  onClaim,
  onClose,
  monetagZoneId = "11003103",
  monetagScriptUrl = "https://al5sm.com/tag.min.js",
  lang = "ar",
}: AdOverlayProps) {
  const t = translations[lang as keyof typeof translations] || translations["ar"];
  const [state, setState] = useState<"loading" | "gone">("loading");
  const doneRef = useRef(false);
  const claimedRef = useRef(false);

  const safeClaim = () => {
    if (claimedRef.current) return;
    claimedRef.current = true;
    setState("gone");
    onClaim();
  };

  const safeClose = () => {
    if (claimedRef.current) return;
    claimedRef.current = true;
    setState("gone");
    onClose();
  };

  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    runMonetag();
  }, []);

  function runMonetag() {
    const zoneId = monetagZoneId;
    const showFnName = "show_" + zoneId;

    // If script already loaded and show function exists, call it immediately
    if (typeof (window as any)[showFnName] === "function") {
      try { (window as any)[showFnName](); } catch {}
      // Give the ad time to be seen, then claim
      setTimeout(safeClaim, (seconds + 2) * 1000);
      // Absolute safety fallback
      setTimeout(safeClaim, (seconds + 5) * 1000);
      return;
    }

    // Load the Monetag script
    const s = document.createElement("script");
    s.setAttribute("data-zone", zoneId);
    s.src = monetagScriptUrl;
    s.async = true;

    s.onload = () => {
      // Small delay for script to initialise its global
      setTimeout(() => {
        if (typeof (window as any)[showFnName] === "function") {
          try { (window as any)[showFnName](); } catch {}
        }
        // Wait for the ad to be seen, then claim
        setTimeout(safeClaim, (seconds + 2) * 1000);
      }, 400);
    };

    s.onerror = () => {
      // Script failed to load — still reward user after short delay
      setTimeout(safeClaim, 3000);
    };

    document.body.appendChild(s);

    // Absolute safety timeout — always claim, never leave user stuck
    setTimeout(safeClaim, (seconds + 8) * 1000);
  }

  if (state === "gone") return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "linear-gradient(170deg,#0d1420 0%,#131c35 100%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 20,
    }}>
      <style>{`@keyframes adSpin { to { transform: rotate(360deg); } }`}</style>
      <div style={{
        width: 56, height: 56,
        border: "3.5px solid rgba(139,92,246,0.25)",
        borderTopColor: "#8B5CF6",
        borderRadius: "50%",
        animation: "adSpin 0.9s linear infinite",
      }} />
      <div style={{ textAlign: "center", padding: "0 32px" }}>
        <p style={{ color: "#fff", fontSize: 15, fontWeight: 700, margin: 0, marginBottom: 6 }}>
          {t.ad_loading || "جارٍ تحميل الإعلان..."}
        </p>
        {rewardLabel && (
          <p style={{ color: "#A78BFA", fontSize: 13, fontWeight: 600, margin: 0 }}>{rewardLabel}</p>
        )}
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, margin: "8px 0 0" }}>
          شاهد الإعلان للحصول على مكافأتك
        </p>
      </div>
    </div>
  );
}
