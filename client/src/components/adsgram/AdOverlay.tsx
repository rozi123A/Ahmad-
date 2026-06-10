import { useEffect, useRef, useState } from "react";

interface AdOverlayProps {
  onSuccess: () => void;
  onClose: () => void;
  lang?: string;
}

export default function AdOverlay({ onSuccess, onClose, lang }: AdOverlayProps) {
  const ran = useRef(false);
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    let closed = false;

    function tryShow(attempts: number) {
      const showFn = (window as any)["show_11127757"];

      if (typeof showFn === "function") {
        // ✅ هنا نخفي شاشتنا أولاً حتى يظهر إعلان Monetag
        setShowLoader(false);

        showFn()
          .then(() => {
            if (!closed) { closed = true; onSuccess(); }
          })
          .catch(() => {
            if (!closed) { closed = true; onClose(); }
          });

      } else if (attempts > 0) {
        setTimeout(() => tryShow(attempts - 1), 300);
      } else {
        // انتهت المحاولات — أغلق بدون مكافأة
        if (!closed) { closed = true; onClose(); }
      }
    }

    tryShow(40); // 40 * 300ms = 12 ثانية انتظار
  }, []);

  // إذا الإعلان بدأ → لا نعرض شيئاً (Monetag يعرض UI خاصته)
  if (!showLoader) return null;

  // شاشة تحميل فقط ريثما يتحضر السكريبت
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        background: "rgba(6,6,16,0.95)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          border: "4px solid rgba(255,255,255,0.15)",
          borderTop: "4px solid #a78bfa",
          borderRadius: "50%",
          animation: "adspin 0.9s linear infinite",
        }}
      />
      <style>{`@keyframes adspin{to{transform:rotate(360deg)}}`}</style>
      <p style={{ fontSize: 16, margin: 0, fontWeight: 600 }}>
        {lang === "ar" ? "جاري تحميل الإعلان..." : "Loading ad..."}
      </p>
      <p style={{ fontSize: 13, color: "#a78bfa", margin: 0 }}>+10 نقطة</p>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", margin: 0, textAlign: "center", padding: "0 24px" }}>
        {lang === "ar"
          ? "شاهد الإعلان بالكامل للحصول على مكافأتك"
          : "Watch the full ad to earn your reward"}
      </p>
    </div>
  );
}
