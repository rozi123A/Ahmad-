import { useEffect, useRef } from "react";

interface AdOverlayProps {
  onSuccess: () => void;
  onClose: () => void;
  lang?: string;
}

export default function AdOverlay({ onSuccess, onClose, lang }: AdOverlayProps) {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    function tryShow(attempts: number) {
      const showFn = (window as any)["show_11127757"];
      if (typeof showFn === "function") {
        showFn()
          .then(() => {
            onSuccess();
          })
          .catch(() => {
            onClose();
          });
      } else if (attempts > 0) {
        setTimeout(() => tryShow(attempts - 1), 300);
      } else {
        onClose();
      }
    }

    tryShow(30);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.85)",
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
          border: "4px solid rgba(255,255,255,0.2)",
          borderTop: "4px solid #a78bfa",
          borderRadius: "50%",
          animation: "spin 0.9s linear infinite",
        }}
      />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <p style={{ fontSize: 16, margin: 0 }}>
        {lang === "ar" ? "جاري تحميل الإعلان..." : "Loading ad..."}
      </p>
      <p style={{ fontSize: 13, color: "#a78bfa", margin: 0 }}>+10 نقطة</p>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: 0 }}>
        {lang === "ar"
          ? "شاهد الإعلان بالكامل للحصول على مكافأتك"
          : "Watch the full ad to get your reward"}
      </p>
    </div>
  );
}
