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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;

    if (blockId) {
      runAdsgram(blockId);
    } else {
      runMonetag();
    }

    return () => {};
  }, []);

  async function waitForAdsgram(maxMs = 8000): Promise<boolean> {
    const start = Date.now();
    while (!(window as any).Adsgram) {
      if (Date.now() - start > maxMs) return false;
      await new Promise(r => setTimeout(r, 200));
    }
    return true;
  }

  async function runAdsgram(id: string) {
    try {
      const loaded = await waitForAdsgram(8000);
      if (!loaded) {
        runMonetag();
        return;
      }
      const controller = await (window as any).Adsgram.init({ blockId: id });
      await controller.show();
      onClaim();
    } catch (err: any) {
      const msg = err?.description || err?.message || "";
      if (msg && typeof msg === "string" && msg.length < 120) setErrorMsg(msg);
      onClose();
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
          <p style={{ color: "#A78BFA", fontSize: 13, fontWeight: 600, margin: 0 }}>
            {rewardLabel}
          </p>
        )}
        {errorMsg && (
          <p style={{ color: "#FCA5A5", fontSize: 12, marginTop: 10, margin: 0 }}>{errorMsg}</p>
        )}
      </div>
    </div>
  );
}
