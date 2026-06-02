import { useEffect, useRef, useState } from "react";
import { translations } from "@/lib/i18n";

const ADSGRAM_SDK_URL = "https://sad.adsgram.ai/js/sad.min.js";

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

    const old = document.getElementById("adsgram-sdk");
    if (old) old.remove();

    const script = document.createElement("script");
    script.id = "adsgram-sdk";
    script.src = ADSGRAM_SDK_URL;
    script.async = true;

    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) { settled = true; reject(new Error("Adsgram SDK timeout")); }
    }, 10000);

    script.onload = () => {
      let attempts = 0;
      const poll = setInterval(() => {
        attempts++;
        if ((window as any).Adsgram) {
          clearInterval(poll); clearTimeout(timeout);
          if (!settled) { settled = true; resolve(); }
        } else if (attempts > 40) {
          clearInterval(poll); clearTimeout(timeout);
          if (!settled) { settled = true; reject(new Error("window.Adsgram not ready")); }
        }
      }, 250);
    };

    script.onerror = () => {
      clearTimeout(timeout);
      if (!settled) { settled = true; reject(new Error("Failed to load Adsgram SDK")); }
    };

    document.head.appendChild(script);
  });
}

export default function AdOverlay({
  blockId,
  seconds = 15,
  rewardLabel,
  onClaim,
  onClose,
  monetagZoneId = "11043107",
  monetagScriptUrl = "https://n6wxm.com/vignette.min.js",
  lang = "ar",
}: AdOverlayProps) {
  const t = translations[lang as keyof typeof translations] || translations["ar"];
  const [state, setState] = useState<"loading" | "gone" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (blockId) runAdsgram(blockId);
    else runMonetag();
  }, []);

  async function runAdsgram(id: string) {
    try {
      // Load SDK dynamically — works even if index.html preload failed
      await loadAdsgramSDK();

      // init() is SYNCHRONOUS
      const AdController = (window as any).Adsgram.init({ blockId: id });

      // Remove our overlay so Adsgram's native UI renders freely
      setState("gone");
      await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

      const result = await AdController.show();
      if (result?.done) {
        onClaim();
      } else {
        onClose();
      }
    } catch (err: any) {
      const msg = err?.description || err?.message || "";
      if (msg && msg.length < 120) {
        setErrorMsg(msg);
        setState("error");
        setTimeout(onClose, 2500);
      } else {
        onClose();
      }
    }
  }

  function runMonetag() {
    (window as any).monetag_zone_id = monetagZoneId;
    const script = document.createElement("script");
    script.src = monetagScriptUrl + "?zone=" + monetagZoneId + "&t=" + Date.now();
    script.async = true;
    script.setAttribute("data-zone", monetagZoneId);
    script.onload = () => { setTimeout(onClaim, (seconds + 2) * 1000); };
    script.onerror = () => { onClose(); };
    document.body.appendChild(script);
    setTimeout(onClaim, (seconds + 3) * 1000);
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

      {state === "loading" && (
        <>
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
          </div>
        </>
      )}

      {state === "error" && (
        <div style={{ textAlign: "center", padding: "0 32px" }}>
          <p style={{ color: "#FCA5A5", fontSize: 14, margin: 0 }}>
            {errorMsg || "لا توجد إعلانات متاحة الآن"}
          </p>
        </div>
      )}
    </div>
  );
}
