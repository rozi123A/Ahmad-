import { useEffect, useRef, useState } from "react";
  import { translations } from "@/lib/i18n";

  // ✅ إعدادات الإنتاج النهائية
  const ADSGRAM_BLOCK_ID = "34209";
  const ADSGRAM_SDK_URL  = "https://sad.adsgram.ai/js/adsgram-ad-sdk.js";

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

  let _sdkPromise: Promise<void> | null = null;

  function isPendingAccountError(msg: string): boolean {
    const l = (msg || "").toLowerCase();
    return (
      l.includes("no ads") || l.includes("no fill") || l.includes("no campaigns") ||
      l.includes("block not found") || l.includes("not found") || l.includes("not active") ||
      l.includes("pending") || l.includes("created") || l.includes("under review") ||
      l.includes("disabled")
    );
  }
  function loadAdsgramSDK(): Promise<void> {
    if (_sdkPromise) return _sdkPromise;
    _sdkPromise = new Promise<void>((resolve, reject) => {
      if ((window as any).Adsgram) { resolve(); return; }
      document.getElementById("adsgram-sdk")?.remove();
      const s = document.createElement("script");
      s.id = "adsgram-sdk"; s.src = ADSGRAM_SDK_URL; s.async = true;
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return; settled = true; _sdkPromise = null;
        reject(new Error("Adsgram SDK timeout"));
      }, 12000);
      s.onload = () => {
        let tries = 0;
        const poll = setInterval(() => {
          tries++;
          if ((window as any).Adsgram) {
            clearInterval(poll); clearTimeout(timeout);
            if (!settled) { settled = true; resolve(); }
          } else if (tries > 60) {
            clearInterval(poll); clearTimeout(timeout);
            if (!settled) { settled = true; _sdkPromise = null; reject(new Error("window.Adsgram not found")); }
          }
        }, 200);
      };
      s.onerror = () => {
        clearTimeout(timeout);
        if (!settled) { settled = true; _sdkPromise = null; reject(new Error("Adsgram script load error")); }
      };
      document.head.appendChild(s);
    });
    return _sdkPromise;
  }

  type OverlayState = "loading" | "pending" | "fallback" | "gone";

  export default function AdOverlay({
    blockId, telegramId, seconds = 15, rewardLabel,
    onClaim, onClose, lang = "ar",
  }: AdOverlayProps) {
    const t = translations[lang as keyof typeof translations] || translations["ar"];
    const [overlayState, setOverlayState] = useState<OverlayState>("loading");
    const doneRef    = useRef(false);
    const claimedRef = useRef(false);
    const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
    const unitId = blockId || ADSGRAM_BLOCK_ID;

    const safeClaim = async () => {
      if (claimedRef.current) return;
      claimedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      console.log("[AdOverlay] ✅ Reward claimed");
      setOverlayState("gone");
      onClaim();
    };

    const safeClose = (reason = "unknown") => {
      if (claimedRef.current) return;
      claimedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      console.warn("[AdOverlay] Ad closed — no reward. Reason:", reason);
      setOverlayState("gone");
      onClose();
    };

    useEffect(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      runAdsgram(unitId);
    }, []);

    async function runAdsgram(id: string) {
      console.log("[AdOverlay] Starting — Block ID:", id);
      try {
        await loadAdsgramSDK();
        const controller = (window as any).Adsgram.init({ blockId: id });
        setOverlayState("gone"); // Adsgram يعرض واجهته الخاصة
        const result = await controller.show();
        console.log("[AdOverlay] Result:", JSON.stringify(result));

        if (result.done) {
          // ✅ شاهد الإعلان بالكامل
          await safeClaim();
        } else if (result.error) {
          if (isPendingAccountError(result.description)) {
            // ⏳ الحساب قيد المراجعة
            console.warn("[AdOverlay] Account pending — desc:", result.description);
            setOverlayState("pending");
            setTimeout(() => safeClose("account_pending"), 4000);
          } else {
            // ❌ خطأ حقيقي → fallback
            console.warn("[AdOverlay] Ad error — fallback. State:", result.state, "| Desc:", result.description);
            showFallback("ad_error");
          }
        } else {
          // المستخدم أغلق مبكراً
          safeClose("closed_early");
        }
      } catch (err: any) {
        const msg: string = typeof err?.description === "string"
          ? err.description
          : err?.message ?? String(err);
        console.error("[AdOverlay] Exception:", msg);

        if (isPendingAccountError(msg)) {
          console.warn("[AdOverlay] Account pending (caught) — showing pending message");
          setOverlayState("pending");
          setTimeout(() => safeClose("account_pending"), 4000);
        } else {
          showFallback("exception");
        }
      }
    }

  function showFallback(reason: string) {
    console.log("[AdOverlay] Ad unavailable — reason:", reason);
    setOverlayState("fallback");
    timerRef.current = setTimeout(() => safeClose("ad_unavailable"), 5000);
  }

    // ─── واجهات العرض ───────────────────────────────────────────
    if (overlayState === "gone") return null;

    // ⏳ الحساب قيد المراجعة
    if (overlayState === "pending") {
      return (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "linear-gradient(170deg,#0d1420 0%,#131c35 100%)",
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", gap: 20, padding: "0 32px",
        }}>
          <div style={{ fontSize: 52 }}>⏳</div>
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "#F59E0B", fontSize: 17, fontWeight: 800, margin: "0 0 10px" }}>
              الإعلانات قيد التجهيز
            </p>
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
              حسابك لا يزال تحت المراجعة من Adsgram.{" "}
              <br />حاول مرة أخرى لاحقاً — ستعمل الإعلانات تلقائياً بمجرد التفعيل.
            </p>
          </div>
          <div style={{
            width: 180, height: 4, borderRadius: 4,
            background: "rgba(245,158,11,0.15)", overflow: "hidden",
          }}>
            <div style={{
              height: "100%", width: "100%", borderRadius: 4,
              background: "linear-gradient(90deg,#F59E0B,#EF4444)",
              animation: "shrink 4s linear forwards",
            }} />
          </div>
          <style>{`@keyframes shrink { from { transform: scaleX(1); } to { transform: scaleX(0); transform-origin: left; } }`}</style>
        </div>
      );
    }

    // ❌ Ad unavailable — error screen, close in 5s, NO reward
    if (overlayState === "fallback") {
      return (
        <div style={{ position:"fixed", inset:0, zIndex:9999,
          background:"linear-gradient(170deg,#0d1420 0%,#131c35 100%)",
          display:"flex", flexDirection:"column", alignItems:"center",
          justifyContent:"center", gap:20, padding:"0 32px" }}>
          <div style={{ fontSize:52 }}>📺</div>
          <div style={{ textAlign:"center" }}>
            <p style={{ color:"#EF4444", fontSize:17, fontWeight:800, margin:"0 0 10px" }}>الإعلان غير متاح</p>
            <p style={{ color:"rgba(255,255,255,0.5)", fontSize:13, lineHeight:1.7, margin:0 }}>
              لا يوجد إعلان متاح الآن.<br/>حاول مرة أخرى بعد قليل.
            </p>
          </div>
          <p style={{ color:"rgba(255,255,255,0.25)", fontSize:11, margin:0 }}>سيتم الإغلاق تلقائياً...</p>
        </div>
      );
    }

    // ⏳ شاشة التحميل الأولية
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "linear-gradient(170deg,#0d1420 0%,#131c35 100%)",
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: 20,
      }}>
        <style>{`@keyframes adSpin { to { transform: rotate(360deg); } }`}</style>
        <div style={{
          width: 56, height: 56, border: "3.5px solid rgba(139,92,246,0.25)",
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
  