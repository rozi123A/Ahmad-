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

    if (blockId) {
      runAdsgram(blockId);
    } else {
      runMonetag();
    }
  }, []);

  async function waitForAdsgram(maxMs = 10000): Promise<boolean> {
    const start = Date.now();
    while (!(window as any).Adsgram) {
      if (Date.now() - start > maxMs) return false;
      await new Promise(r => setTimeout(r, 200));
    }
    return true;
  }

  async function runAdsgram(id: string) {
    try {
      const loaded = await waitForAdsgram(10000);
      if (!loaded) {
        runMonetag();
        return;
      }

      // Adsgram.init() is SYNCHRONOUS — do NOT await it
      const AdController = (window as any).Adsgram.init({ blockId: id });

      // Remove our overlay COMPLETELY before Adsgram shows its own UI
      setState("gone");

      // Wait 2 animation frames so React flushes DOM and our overlay is gone
      await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

      // Now let Adsgram show its native full-screen ad
      await AdController.show();

      onClaim();
    } catch (err: any) {
      const description = err?.description || err?.message || "";
      const isBannerNotFound = description?.toLowerCase?.().includes("banner") ||
                               description?.toLowerCase?.().includes("no ads");

      if (isBannerNotFound || !description) {
        // No ads available right now — silently close
        onClose();
      } else {
        setErrorMsg(description.slice(0, 120));
        setState("error");
        setTimeout(onClose, 2500);
      }
    }
  }

  function runMonetag() {
    (window as any).monetag_zone_id = monetagZoneId;
    const script = document.createElement("script");
    script.src = `${monetagScriptUrl}?zone=${monetagZoneId}&t=${Date.now()}`;
    script.async = true;
    script.setAttribute("data-zone", monetagZoneId);
    script.onload = () => { setTimeout(onClaim, (seconds + 2) * 1000); };
    script.onerror = () => { onClose(); };
    document.body.appendChild(script);
    setTimeout(onClaim, (seconds + 3) * 1000);
  }

  // Remove from DOM entirely so nothing can block Adsgram's native overlay
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
              <p style={{ color: "#A78BFA", fontSize: 13, fontWeight: 600, margin: 0 }}>
                {rewardLabel}
              </p>
            )}
          </div>
        </>
      )}

      {state === "error" && (
        <div style={{ textAlign: "center", padding: "0 32px" }}>
          <p style={{ color: "#FCA5A5", fontSize: 14, margin: 0 }}>
            {errorMsg || "لا توجد إعلانات متاحة الآن، حاول لاحقاً"}
          </p>
        </div>
      )}
    </div>
  );
}
