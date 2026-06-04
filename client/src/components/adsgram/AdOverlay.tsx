import { useEffect, useRef, useState } from "react";
import { translations } from "@/lib/i18n";

const ADSGRAM_SDK_URL = "https://sad.adsgram.ai/js/adsgram-ad-sdk.js";
const ADSGRAM_UNIT_ID = "34098";

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

let _sdkPromise: Promise<void> | null = null;
function loadAdsgramSDK(): Promise<void> {
  if (_sdkPromise) return _sdkPromise;
  _sdkPromise = new Promise<void>((resolve, reject) => {
    if ((window as any).Adsgram) { resolve(); return; }
    console.log('[AdOverlay] Loading Adsgram SDK...');
    document.getElementById('adsgram-sdk')?.remove();
    const s = document.createElement('script');
    s.id = 'adsgram-sdk'; s.src = ADSGRAM_SDK_URL; s.async = true;
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return; settled = true; _sdkPromise = null;
      console.error('[AdOverlay] SDK timeout ❌');
      reject(new Error('Adsgram SDK timeout'));
    }, 10000);
    s.onload = () => {
      let tries = 0;
      const poll = setInterval(() => {
        tries++;
        if ((window as any).Adsgram) {
          clearInterval(poll); clearTimeout(timeout);
          if (!settled) { settled = true; console.log('[AdOverlay] SDK ready ✅'); resolve(); }
        } else if (tries > 50) {
          clearInterval(poll); clearTimeout(timeout);
          if (!settled) { settled = true; _sdkPromise = null; reject(new Error('window.Adsgram not found')); }
        }
      }, 200);
    };
    s.onerror = () => {
      clearTimeout(timeout);
      if (!settled) { settled = true; _sdkPromise = null; console.error('[AdOverlay] SDK script failed ❌'); reject(new Error('Adsgram script load error')); }
    };
    document.head.appendChild(s);
  });
  return _sdkPromise;
}

type OverlayState = "loading" | "fallback" | "gone";

export default function AdOverlay({ blockId, seconds = 15, rewardLabel, onClaim, onClose, lang = "ar" }: AdOverlayProps) {
  const t = translations[lang as keyof typeof translations] || translations["ar"];
  const [overlayState, setOverlayState] = useState<OverlayState>("loading");
  const doneRef = useRef(false);
  const claimedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unitId = blockId || ADSGRAM_UNIT_ID;

  const safeClaim = () => {
    if (claimedRef.current) return;
    claimedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    console.log('[AdOverlay] ✅ Reward claimed');
    setOverlayState("gone"); onClaim();
  };
  const safeClose = (reason = "unknown") => {
    if (claimedRef.current) return;
    claimedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    console.warn('[AdOverlay] Ad closed — no reward. Reason:', reason);
    setOverlayState("gone"); onClose();
  };

  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    runAdsgram(unitId);
  }, []);

  async function runAdsgram(id: string) {
    console.log('[AdOverlay] Starting ad — Unit ID:', id);
    try {
      await loadAdsgramSDK();
      const controller = (window as any).Adsgram.init({ blockId: id });
      setOverlayState("gone");
      console.log('[AdOverlay] Calling controller.show()...');
      const result = await controller.show();
      console.log('[AdOverlay] Result:', JSON.stringify(result));
      if (result.done) {
        console.log('[AdOverlay] ✅ Ad completed — reward!');
        safeClaim();
      } else if (result.error) {
        console.warn('[AdOverlay] ❌ Ad error — state:', result.state, '| desc:', result.description, '— fallback');
        showFallback('ad_error');
      } else {
        console.warn('[AdOverlay] ⚠️ User closed early — no reward');
        safeClose('closed_early');
      }
    } catch (err: any) {
      console.error('[AdOverlay] Exception:', err?.message ?? err);
      if (err && typeof err === 'object' && err.error === true) {
        console.warn('[AdOverlay] No fill — fallback');
        showFallback('no_fill');
      } else {
        showFallback('exception');
      }
    }
  }

  function showFallback(reason: string) {
    console.log('[AdOverlay] Monetag fallback — reason:', reason);
    setOverlayState("fallback");
    timerRef.current = setTimeout(() => {
      console.log('[AdOverlay] Fallback timer done — claiming reward');
      safeClaim();
    }, (seconds + 5) * 1000);
  }

  if (overlayState === "gone") return null;
  if (overlayState === "fallback") {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#0d1420", display: "flex", flexDirection: "column" }}>
        <iframe src="/ad-view.html" style={{ flex: 1, width: "100%", border: "none" }} allow="autoplay" title="ad" />
        <div style={{ padding: "10px 16px", background: "rgba(13,20,32,0.95)", display: "flex", justifyContent: "center" }}>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, margin: 0, textAlign: "center" }}>
            شاهد الإعلان للحصول على مكافأتك
          </p>
        </div>
      </div>
    );
  }
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "linear-gradient(170deg,#0d1420 0%,#131c35 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
      <style>{`@keyframes adSpin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: 56, height: 56, border: "3.5px solid rgba(139,92,246,0.25)", borderTopColor: "#8B5CF6", borderRadius: "50%", animation: "adSpin 0.9s linear infinite" }} />
      <div style={{ textAlign: "center", padding: "0 32px" }}>
        <p style={{ color: "#fff", fontSize: 15, fontWeight: 700, margin: 0, marginBottom: 6 }}>
          {t.ad_loading ?? "جارٍ تحميل الإعلان..."}
        </p>
        {rewardLabel && <p style={{ color: "#A78BFA", fontSize: 13, fontWeight: 600, margin: 0 }}>{rewardLabel}</p>}
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, margin: "8px 0 0" }}>شاهد الإعلان بالكامل للحصول على مكافأتك</p>
      </div>
    </div>
  );
}
