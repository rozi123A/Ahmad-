import { useEffect, useRef, useState } from "react";
import { translations } from "@/lib/i18n";

interface AdOverlayProps {
  blockId?: string;
  telegramId?: number | string;
  seconds?: number;
  rewardLabel?: string;
  onClaim: () => void;
  onClose: () => void;
  monetagZoneId?: string;
  monetagScriptUrl?: string;
  lang?: string;
}

type OverlayState = "loading" | "gone";

const AD_FUNC = "show_11127757";
const AD_SCRIPT = "//thubanoa.com/1?z=11127757";

function loadAdScript(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof (window as any)[AD_FUNC] === "function") { resolve(); return; }
    if (document.querySelector(`script[src="${AD_SCRIPT}"]`)) {
      // already injected, poll until ready
      let tries = 0;
      const poll = setInterval(() => {
        tries++;
        if (typeof (window as any)[AD_FUNC] === "function") { clearInterval(poll); resolve(); }
        else if (tries > 40) { clearInterval(poll); resolve(); } // give up after 20s
      }, 500);
      return;
    }
    const s = document.createElement("script");
    s.src = AD_SCRIPT;
    s.async = true;
    (s as any)["data-cfasync"] = "false";
    s.onload = () => {
      let tries = 0;
      const poll = setInterval(() => {
        tries++;
        if (typeof (window as any)[AD_FUNC] === "function") { clearInterval(poll); resolve(); }
        else if (tries > 40) { clearInterval(poll); resolve(); }
      }, 500);
    };
    s.onerror = () => resolve(); // still resolve, we'll fail gracefully
    document.head.appendChild(s);
  });
}

export default function AdOverlay({
  seconds = 15, rewardLabel,
  onClaim, onClose, lang = "ar",
}: AdOverlayProps) {
  const t = translations[lang as keyof typeof translations] || translations["ar"];
  const [overlayState, setOverlayState] = useState<OverlayState>("loading");
  const doneRef    = useRef(false);
  const claimedRef = useRef(false);

  const safeClaim = () => {
    if (claimedRef.current) return;
    claimedRef.current = true;
    setOverlayState("gone");
    onClaim();
  };

  const safeClose = () => {
    if (claimedRef.current) return;
    claimedRef.current = true;
    setOverlayState("gone");
    onClose();
  };

  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    runAd();
  }, []);

  async function runAd() {
    try {
      await loadAdScript();
      const showAd = (window as any)[AD_FUNC];
      if (typeof showAd !== "function") {
        console.warn("[AdOverlay] show function not available — closing");
        safeClose();
        return;
      }
      // show_11127757() returns a Promise that resolves when user finishes watching
      await showAd();
      safeClaim();
    } catch (err: any) {
      console.error("[AdOverlay] Ad error:", err?.message ?? err);
      safeClose();
    }
  }

  if (overlayState === "gone") return null;

  // Loading screen while ad initialises
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "linear-gradient(170deg,#0d1420 0%,#131c35 100%)",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: 20,
    }}>
      <style>{`@keyframes adSpin { to { transform: rotate(360deg); } }`}</style>
      <div style={{
        width: 56, height: 56,
        border: "3.5px solid rgba(139,92,246,0.25)",
        borderTopColor: "#8B5CF6", borderRadius: "50%",
        animation: "adSpin 0.9s linear infinite",
      }} />
      <div style={{ textAlign: "center", padding: "0 32px" }}>
        <p style={{ color: "#fff", fontSize: 15, fontWeight: 700, margin: "0 0 6px" }}>
          {(t as any).ad_loading ?? "جارٍ تحميل الإعلان..."}
        </p>
        {rewardLabel && (
          <p style={{ color: "#A78BFA", fontSize: 13, fontWeight: 600, margin: "0 0 8px" }}>
            {rewardLabel}
          </p>
        )}
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, margin: 0 }}>
          شاهد الإعلان بالكامل للحصول على مكافأتك
        </p>
      </div>
    </div>
  );
}
