import { useEffect, useRef, useState } from "react";
import { translations } from "@/lib/i18n";

const ADSGRAM_SDK = "https://sad.adsgram.ai/js/sad.min.js";

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

function loadAdsgramSDK(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).Adsgram) { resolve(); return; }
    const existing = document.getElementById("adsgram-sdk");
    if (existing) { existing.remove(); }
    const s = document.createElement("script");
    s.id = "adsgram-sdk";
    s.src = ADSGRAM_SDK;
    s.async = true;
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) { settled = true; reject(new Error("Adsgram SDK timeout")); }
    }, 8000);
    s.onload = () => {
      let tries = 0;
      const poll = setInterval(() => {
        tries++;
        if ((window as any).Adsgram) {
          clearInterval(poll); clearTimeout(timeout);
          if (!settled) { settled = true; resolve(); }
        } else if (tries > 30) {
          clearInterval(poll); clearTimeout(timeout);
          if (!settled) { settled = true; reject(new Error("Adsgram not ready")); }
        }
      }, 200);
    };
    s.onerror = () => {
      clearTimeout(timeout);
      if (!settled) { settled = true; reject(new Error("Adsgram load failed")); }
    };
    document.head.appendChild(s);
  });
}

export default function AdOverlay({
  blockId,
  seconds = 15,
  rewardLabel,
  onClaim,
  onClose,
  lang = "ar",
}: AdOverlayProps) {
  const t = translations[lang as keyof typeof translations] || translations["ar"];
  const [state, setState] = useState<"loading" | "iframe" | "gone">("loading");
  const doneRef = useRef(false);
  const claimedRef = useRef(false);
  const iframeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const safeClaim = () => {
    if (claimedRef.current) return;
    claimedRef.current = true;
    if (iframeTimerRef.current) clearTimeout(iframeTimerRef.current);
    setState("gone");
    onClaim();
  };

  const safeClose = () => {
    if (claimedRef.current) return;
    claimedRef.current = true;
    if (iframeTimerRef.current) clearTimeout(iframeTimerRef.current);
    setState("gone");
    onClose();
  };

  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (blockId) runAdsgram(blockId);
    else runMonetag();
  }, []);

  async function runAdsgram(id: string) {
    try {
      await loadAdsgramSDK();
      const AdController = (window as any).Adsgram.init({ blockId: id });
      setState("gone");
      const result = await AdController.show();
      if (result?.done) {
        safeClaim();
      } else if (result?.error) {
        // No fill — fall back to Monetag iframe
        setState("iframe");
        startIframeTimer();
      } else {
        // User closed ad early
        safeClose();
      }
    } catch {
      // Adsgram failed — fall back to Monetag iframe
      setState("iframe");
      startIframeTimer();
    }
  }

  function startIframeTimer() {
    iframeTimerRef.current = setTimeout(safeClaim, (seconds + 5) * 1000);
  }

  function runMonetag() {
    setState("iframe");
    startIframeTimer();
  }

  if (state === "gone") return null;

  if (state === "iframe") {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "#0d1420",
        display: "flex", flexDirection: "column",
      }}>
        <iframe
          src="/ad-view.html"
          style={{ flex: 1, width: "100%", border: "none" }}
          allow="autoplay"
          title="ad"
        />
      </div>
    );
  }

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
