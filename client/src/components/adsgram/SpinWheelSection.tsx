import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gift, Sparkles, Tv2, X, ShoppingCart, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";
import { translations, type Language } from "@/lib/i18n";
import AdOverlay from "@/components/adsgram/AdOverlay";

interface UserData {
  telegramId: number;
  balance: number;
  spinsLeft: number;
  adsgramBlockId: string;
}

interface SpinWheelSectionProps {
  user: UserData;
  lang: Language;
  onReward: (update?: { balance: number; spinsLeft: number; totalEarned?: number }) => void;
  onSwitchToAds?: () => void;
  onLock?: () => void;
  onUnlock?: () => void;
}

const PRIZES = [
  { label: "50",   value: 50,   color: "#FF6B6B" },
  { label: "200",  value: 200,  color: "#4ECDC4" },
  { label: "100",  value: 100,  color: "#FFE66D" },
  { label: "500",  value: 500,  color: "#FF9F43" },
  { label: "75",   value: 75,   color: "#A29BFE" },
  { label: "1000", value: 1000, color: "#FAB1A0" },
  { label: "150",  value: 150,  color: "#55E6C1" },
  { label: "250",  value: 250,  color: "#FD79A8" },
];

const MAX_AD_SPINS = 5;
const LS_COUNT = "spinAdCount";
const LS_DATE  = "spinAdDate";

function todayStr() { return new Date().toISOString().split("T")[0]; }
function getAdSpinsUsed(): number {
  try {
    if (localStorage.getItem(LS_DATE) !== todayStr()) {
      localStorage.setItem(LS_COUNT, "0");
      localStorage.setItem(LS_DATE, todayStr());
      return 0;
    }
    return parseInt(localStorage.getItem(LS_COUNT) || "0", 10);
  } catch { return 0; }
}
function bumpAdSpins() {
  try {
    localStorage.setItem(LS_COUNT, String(getAdSpinsUsed() + 1));
    localStorage.setItem(LS_DATE, todayStr());
  } catch {}
}

function getAudioCtx(): AudioContext | null {
  try { return new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { return null; }
}
function playTick(ctx: AudioContext, t: number) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "triangle";
  o.frequency.setValueAtTime(900, t);
  o.frequency.exponentialRampToValueAtTime(400, t + 0.04);
  g.gain.setValueAtTime(0.18, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  o.start(t); o.stop(t + 0.05);
}
function playSpinSound(ctx: AudioContext, dur: number) {
  const now = ctx.currentTime; let t = now, iv = 0.06;
  while (t < now + dur) { playTick(ctx, t); t += iv; iv = 0.06 + ((t - now) / dur) * 0.55; }
}
function playWinSound(ctx: AudioContext) {
  const now = ctx.currentTime;
  [261.63, 329.63, 392.0, 523.25].forEach((freq, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = "sine";
    const tt = now + i * 0.13;
    o.frequency.setValueAtTime(freq, tt);
    g.gain.setValueAtTime(0, tt);
    g.gain.linearRampToValueAtTime(0.3, tt + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, tt + 0.35);
    o.start(tt); o.stop(tt + 0.4);
  });
}

export default function SpinWheelSection({ user, lang, onReward, onLock, onUnlock }: SpinWheelSectionProps) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const [isSpinning,        setIsSpinning]        = useState(false);
  const [rotation,          setRotation]          = useState(0);
  const [adSpinsUsed,       setAdSpinsUsed]       = useState(0);
  const [showNoSpinsModal,  setShowNoSpinsModal]  = useState(false);
  const [showAdOverlay,     setShowAdOverlay]     = useState(false);
  const [pendingToken,      setPendingToken]      = useState<string | null>(null);
  const [tokenLoading,      setTokenLoading]      = useState(false);
  const [showBuyModal,      setShowBuyModal]      = useState(false);
  const [buyLoading,        setBuyLoading]        = useState(false);
  const [starsLoading,      setStarsLoading]      = useState(false);
  const { toast } = useToast();
  const t = translations[lang];

  const spinMutation         = trpc.spin.perform.useMutation();
  const getTokenMutation     = trpc.ads.getToken.useMutation();
  const claimMutation        = trpc.ads.claim.useMutation();
  const buySpinsMutation     = trpc.spin.buy.useMutation();
  const buyWithStarsMutation = trpc.spin.buyWithStars.useMutation();

  useEffect(() => { setAdSpinsUsed(getAdSpinsUsed()); }, []);
  useEffect(() => { drawWheel(); }, [rotation]);

  useEffect(() => {
    if (Number(user.spinsLeft) === 0) {
      const timer = setTimeout(() => setShowNoSpinsModal(true), 800);
      return () => clearTimeout(timer);
    }
  }, [user.spinsLeft]);

  function drawWheel() {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const cx = canvas.width / 2, cy = canvas.height / 2, r = cx - 15;
    const seg = PRIZES.length, arc = (2 * Math.PI) / seg;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath(); ctx.arc(cx, cy, r + 5, 0, 2 * Math.PI);
    ctx.fillStyle = "#2d3436"; ctx.fill();
    ctx.strokeStyle = "#f1c40f"; ctx.lineWidth = 4; ctx.stroke();

    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rotation);
    for (let i = 0; i < seg; i++) {
      const s = i * arc, e = s + arc;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, s, e); ctx.closePath();
      ctx.fillStyle = PRIZES[i].color; ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 2; ctx.stroke();
      ctx.save(); ctx.rotate(s + arc / 2); ctx.textAlign = "right";
      ctx.fillStyle = "#2d3436"; ctx.font = "bold 18px 'Inter',sans-serif";
      ctx.fillText(PRIZES[i].label, r - 25, 7); ctx.restore();
    }
    ctx.restore();

    const grad = ctx.createRadialGradient(cx, cy, 5, cx, cy, 30);
    grad.addColorStop(0, "#f1c40f"); grad.addColorStop(1, "#e67e22");
    ctx.beginPath(); ctx.arc(cx, cy, 30, 0, 2 * Math.PI);
    ctx.fillStyle = grad; ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.font = "bold 14px Arial";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("GO", cx, cy);

    ctx.beginPath();
    ctx.moveTo(cx - 10, cy - r - 5); ctx.lineTo(cx + 10, cy - r - 5); ctx.lineTo(cx, cy - r + 15);
    ctx.closePath(); ctx.fillStyle = "#fff"; ctx.fill();
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.stroke();
  }

  // FIX: Create token BEFORE showing overlay so tokenAge ≥ 15s when user claims
  const handleWatchSpinAdClick = async () => {
    setShowNoSpinsModal(false);
    setTokenLoading(true);
    try {
      const initData = (window as any).Telegram?.WebApp?.initData || "";
      const tok = await getTokenMutation.mutateAsync({ telegramId: user.telegramId, initData, type: "spin" });
      if (!tok.success || !tok.token) throw new Error(tok.message || "فشل الحصول على التوكن");
      setPendingToken(tok.token);
      onLock?.();
      setShowAdOverlay(true);
    } catch (e: any) {
      toast({ title: t.error, description: e?.message || t.ad_load_failed تحميل الإعلان", variant: "destructive" });
    } finally {
      setTokenLoading(false);
    }
  };

  const handleAdClaim = async () => {
    if (!pendingToken) return;
    const initData = (window as any).Telegram?.WebApp?.initData || "";
    try {
      const cl = await claimMutation.mutateAsync({ telegramId: user.telegramId, token: pendingToken, initData, type: "spin" });
      if (cl.success) {
        bumpAdSpins();
        setAdSpinsUsed(getAdSpinsUsed());
        const newBal   = cl.balance   !== undefined ? Number(cl.balance)   : user.balance + 100;
        const newSpins = cl.spinsLeft !== undefined ? Number(cl.spinsLeft) : user.spinsLeft + 1;
        onReward({ balance: newBal, spinsLeft: newSpins });
        toast({ title: t.spin_ready, description: t.spin_ready_desc });
      } else {
        throw new Error(cl.message || t.spin_failed);
      }
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message || "فشل", variant: "destructive" });
    } finally {
      setPendingToken(null);
      onUnlock?.();
    }
  };

  async function handleSpin() {
    if (isSpinning || Number(user.spinsLeft) <= 0) return;
    setIsSpinning(true);
    if (!audioCtxRef.current) audioCtxRef.current = getAudioCtx();
    const actx = audioCtxRef.current;
    if (actx?.state === "suspended") await actx.resume();

    try {
      const data = await spinMutation.mutateAsync({
        telegramId: user.telegramId,
        initData: (window as any).Telegram?.WebApp?.initData || "",
      });
      if (!data.success) {
        toast({ title: t.notice, description: data.message || t.spin_failed, variant: "destructive" });
        setIsSpinning(false); onUnlock?.(); return;
      }

      const idx = PRIZES.findIndex(p => p.value === data.prize);
      const segAngle = (2 * Math.PI) / PRIZES.length;
      const target = rotation + 8 * Math.PI * 2 + (-(idx * segAngle + segAngle / 2) - Math.PI / 2 - rotation % (Math.PI * 2));
      const dur = 4000, t0 = Date.now(), r0 = rotation;

      onLock?.();
      if (actx) playSpinSound(actx, dur / 1000);

      const animate = () => {
        const p = Math.min((Date.now() - t0) / dur, 1);
        setRotation(r0 + (target - r0) * (1 - Math.pow(1 - p, 4)));
        if (p < 1) { requestAnimationFrame(animate); }
        else {
          if (actx) playWinSound(actx);
          toast({ title: t.congrats, description: `${t.won_points} ${data.prize} PTS` });
          const wonBalance = data.balance   !== undefined ? Number(data.balance)   : user.balance + (data.prize || 0);
          const wonSpins   = data.spinsLeft !== undefined ? Number(data.spinsLeft) : Math.max(0, user.spinsLeft - 1);
          onReward({ balance: wonBalance, spinsLeft: wonSpins });
          setIsSpinning(false);
          onUnlock?.();
          if (Number(wonSpins) === 0) {
            setTimeout(() => setShowNoSpinsModal(true), 1200);
          }
        }
      };
      animate();
    } catch {
      toast({ title: t.error, description: t.spin_error, variant: "destructive" });
      setIsSpinning(false);
      onUnlock?.();
    }
  }

  const adSpinsLeft = MAX_AD_SPINS - adSpinsUsed;

  // Spin packages
  const SPIN_PACKAGES = [
    { qty: 1, price: 500,  label: t.spin_one,           badge: null,                             color: "#6366f1" },
    { qty: 3, price: 1200, label: t.spin_package_3,     badge: t.spin_save + " 20%",             color: "#8B5CF6" },
    { qty: 5, price: 1800, label: t.spin_package_5,     badge: t.spin_best,                      color: "#EC4899" },
  ];

  const handleBuySpins = async (qty: number, price: number) => {
    if (buyLoading) return;
    if (user.balance < price) {
      toast({ title: t.insufficient_balance غير كافٍ 😔", description: `${t.need_points"} ${price} ${t.points}. ${t.current_balance الحالي"}: ${user.balance} ${t.points}`, variant: "destructive" });
      return;
    }
    setBuyLoading(true);
    try {
      const initData = (window as any).Telegram?.WebApp?.initData || "";
      const res = await buySpinsMutation.mutateAsync({ telegramId: user.telegramId, initData, quantity: qty });
      if (res.success) {
        onReward({ balance: Number(res.balance), spinsLeft: Number(res.spinsLeft) });
        setShowBuyModal(false);
        setShowNoSpinsModal(false);
        toast({ title: t.spin_purchased, description: `${t.deducted} ${price} ${t.points} ${t.from_balance}. ${t.play_now}` });
      } else {
        throw new Error((res as any).message || "فشلت العملية");
      }
    } catch (e: any) {
      toast({ title: t.error, description: e?.message || t.purchase_failed, variant: "destructive" });
    } finally {
      setBuyLoading(false);
    }
  };

  const handleBuyWithStars = async (qty: number) => {
    if (starsLoading) return;
    setStarsLoading(true);
    try {
      const initData = (window as any).Telegram?.WebApp?.initData || "";
      const res = await buyWithStarsMutation.mutateAsync({ telegramId: user.telegramId, initData, quantity: qty });
      if (!res.success || !res.invoiceLink) throw new Error(res.message || "فشل إنشاء الفاتورة");
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.openInvoice) {
        tg.openInvoice(res.invoiceLink, (status: string) => {
          if (status === "paid") {
            setShowBuyModal(false);
            setShowNoSpinsModal(false);
            toast({ title: t.spin_paid, description: t.spin_paid_desc.replace("{qty}", qty.toString()) + "! " + t.restart_app });
          } else if (status === "cancelled") {
            toast({ title: t.spin_cancel, description: t.spin_cancel_desc, variant: "destructive" });
          }
        });
      } else {
        window.open(res.invoiceLink, "_blank");
        toast({ title: t.stars_payment_link رابط الدفع", description: t.open_link_pay الرابط وادفع بنجومك" });
      }
    } catch (e: any) {
      toast({ title: t.error, description: e?.message || t.invoice_failed إنشاء الفاتورة", variant: "destructive" });
    } finally {
      setStarsLoading(false);
    }
  };

  return (
    <>
      {showAdOverlay && (
        <AdOverlay
          seconds={15}
          rewardLabel={t.spin_extra إضافية 🎡"}
          onClaim={handleAdClaim}
          onClose={() => { setShowAdOverlay(false); setPendingToken(null); onUnlock?.(); }}
        />
      )}

      {/* Buy Spins Modal */}
      {showBuyModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.82)", backdropFilter: "blur(10px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
        }}>
          <div style={{
            background: "linear-gradient(145deg, #0f0c29, #1a1040)",
            border: "1px solid rgba(139,92,246,0.5)",
            borderRadius: 28, padding: "28px 20px", maxWidth: 360, width: "100%",
            boxShadow: "0 24px 64px rgba(0,0,0,0.7), 0 0 50px rgba(139,92,246,0.2)",
            position: "relative",
          }}>
            <button onClick={() => setShowBuyModal(false)} style={{
              position: "absolute", top: 14, left: 14,
              background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 10,
              width: 32, height: 32, cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.5)",
            }}>
              <X size={16} />
            </button>

            <div style={{ textAlign: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 48, marginBottom: 4 }}>🛒</div>
              <h3 style={{ fontSize: 20, fontWeight: 900, color: "#fff", margin: 0 }}>{t.spin_buy_title}</h3>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
                {`${t.current_balance}: `} <span style={{ color: "#facc15", fontWeight: 800 }}>{user.balance.toLocaleString()} {t.points}</span>
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 18 }}>
              {SPIN_PACKAGES.map((pkg) => {
                const canAfford = user.balance >= pkg.price;
                return (
                  <button key={pkg.qty} onClick={() => handleBuySpins(pkg.qty, pkg.price)}
                    disabled={!canAfford || buyLoading}
                    style={{
                      width: "100%", padding: "14px 16px", borderRadius: 16, border: "none",
                      background: canAfford ? `linear-gradient(135deg, ${pkg.color}cc, ${pkg.color})` : "rgba(255,255,255,0.06)",
                      cursor: canAfford && !buyLoading ? "pointer" : "not-allowed",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      boxShadow: canAfford ? `0 4px 20px ${pkg.color}44` : "none",
                      opacity: buyLoading ? 0.7 : 1,
                      transition: "all 0.2s",
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 22 }}>{"🎡".repeat(Math.min(pkg.qty, 3))}</span>
                      <div style={{ textAlign: "left" }}>
                        <div style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>{pkg.label}</div>
                        {pkg.badge && (
                          <div style={{ fontSize: 10, color: canAfford ? "#fde68a" : "rgba(255,255,255,0.3)", fontWeight: 700 }}>
                            {pkg.badge}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: canAfford ? "#fde68a" : "rgba(255,255,255,0.3)", fontWeight: 900, fontSize: 15 }}>
                        {pkg.price.toLocaleString()}
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>{t.spin_point}</div>
                    </div>
                  </button>
                );
              })}
            </div>


            {/* ─── شراء بنجوم تيليغرام ─── */}
            <div style={{ marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14 }}>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textAlign: "center", marginBottom: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
                {t.pay_with_stars}
              </p>
              {[
                { qty: 1, stars: 20, label: t.spin_one,   badge: null,   color: "#F59E0B" },
                { qty: 3, stars: 60, label: t.spin_package_3, badge: t.spin_no_save, color: "#EF4444" },
                { qty: 5, stars: 100, label: t.spin_package_5, badge: t.spin_best, color: "#10B981" },
              ].map((pkg) => (
                <button key={pkg.qty} onClick={() => handleBuyWithStars(pkg.qty)}
                  disabled={starsLoading}
                  style={{
                    width: "100%", padding: "12px 16px", borderRadius: 14, border: "none",
                    background: `linear-gradient(135deg, ${pkg.color}99, ${pkg.color}cc)`,
                    cursor: starsLoading ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    boxShadow: `0 4px 16px ${pkg.color}33`,
                    opacity: starsLoading ? 0.7 : 1,
                    marginBottom: 8,
                  }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 20 }}>⭐</span>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ color: "#fff", fontWeight: 800, fontSize: 13 }}>{pkg.label}</div>
                      {pkg.badge && <div style={{ fontSize: 10, color: "#fde68a", fontWeight: 700 }}>{pkg.badge}</div>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "#fff", fontWeight: 900, fontSize: 15 }}>{pkg.stars} ⭐</div>
                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10 }}>نجمة</div>
                  </div>
                </button>
              ))}
            </div>

            {(buyLoading || starsLoading) && (
              <p style={{ textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 14 }}>
                جاري المعالجة...
              </p>
            )}
          </div>
        </div>
      )}

      {/* No Spins Modal */}
      {showNoSpinsModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 999,
          background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "20px",
        }}>
          <div style={{
            background: "linear-gradient(145deg, #130826, #0b1240)",
            border: "1px solid rgba(139,92,246,0.4)",
            borderRadius: 28, padding: "32px 24px", maxWidth: 360, width: "100%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(139,92,246,0.15)",
            position: "relative",
          }}>
            <button
              onClick={() => setShowNoSpinsModal(false)}
              style={{ position: "absolute", top: 16, left: 16, background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 10, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.5)" }}
            >
              <X size={16} />
            </button>

            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 56, marginBottom: 8 }}>🎡</div>
            </div>

            <h3 style={{ fontSize: 22, fontWeight: 900, color: "#fff", textAlign: "center", marginBottom: 8 }}>
              {t.spin_no_spins دوراتك اليومية! 😅"}
            </h3>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", textAlign: "center", marginBottom: 24, lineHeight: 1.6 }}>
              {t.spin_ad_desc إعلاناً قصيراً واحصل على دورة إضافية."}<br />
              {t.spin_get_free الحصول على دورات مجانية يومياً!"}
            </p>

            <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>{t.spin_today_ads اليوم"}</span>
                <span style={{ fontSize: 11, fontWeight: 900, color: "#EC4899" }}>{adSpinsUsed} / {MAX_AD_SPINS}</span>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(adSpinsUsed / MAX_AD_SPINS) * 100}%`, background: "linear-gradient(90deg, #EC4899, #8B5CF6)", borderRadius: 3 }} />
              </div>
            </div>

            <button
              onClick={handleWatchSpinAdClick}
              disabled={adSpinsLeft <= 0 || tokenLoading}
              style={{
                width: "100%", height: 52, borderRadius: 18, border: "none",
                background: adSpinsLeft > 0 && !tokenLoading ? "linear-gradient(135deg, #7c3aed, #EC4899)" : "rgba(255,255,255,0.08)",
                color: "#fff", fontSize: 15, fontWeight: 900,
                cursor: adSpinsLeft > 0 && !tokenLoading ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                boxShadow: adSpinsLeft > 0 && !tokenLoading ? "0 6px 24px rgba(139,92,246,0.45)" : "none",
                marginBottom: 10,
              }}
            >
              <Tv2 size={20} />
              {tokenLoading ? "..." : adSpinsLeft > 0 ? t.watch_ad_earn_spin : t.no_more_daily_ads}
            </button>

            {/* Buy Spins Button */}
            <button
              onClick={() => { setShowNoSpinsModal(false); setShowBuyModal(true); }}
              style={{
                width: "100%", height: 52, borderRadius: 18, border: "1px solid rgba(250,204,21,0.4)",
                background: "rgba(250,204,21,0.08)",
                color: "#facc15", fontSize: 15, fontWeight: 900,
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              }}
            >
              <ShoppingCart size={18} />
              {t.spin_buy_with_points دورات بنقاطك"}
            </button>

            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: 12 }}>
              {(t.spin_remaining اليوم: {left} من {total} إعلانات").replace("{left}", adSpinsLeft.toString()).replace("{total}", MAX_AD_SPINS.toString())}
            </p>
          </div>
        </div>
      )}

      <Card className="bg-gradient-to-b from-slate-900/80 to-slate-950 border-slate-700/50 shadow-xl overflow-hidden">
        <CardHeader className="border-b border-slate-800/50 bg-slate-900/30">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Gift className="h-5 w-5 text-purple-400" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                {t.spin_title}
              </span>
            </div>
            <div className="flex items-center gap-1 px-3 py-1 bg-slate-800/50 rounded-full border border-slate-700/50">
              <Sparkles className="h-3 w-3 text-yellow-400" />
              <span className="text-xs font-medium text-yellow-400">{t.big_prizes}</span>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-8 pb-6 space-y-6">
          <div className="relative flex justify-center items-center">
            <div className="absolute w-64 h-64 bg-purple-600/10 rounded-full blur-3xl" />
            <canvas
              ref={canvasRef}
              width={320} height={320}
              onClick={!isSpinning && Number(user.spinsLeft) > 0 ? handleSpin : undefined}
              className={`relative z-10 drop-shadow-[0_0_15px_rgba(0,0,0,0.5)] cursor-pointer transition-transform ${!isSpinning && Number(user.spinsLeft) > 0 ? "hover:scale-105" : ""}`}
            />
            {!isSpinning && Number(user.spinsLeft) > 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <div className="animate-ping absolute h-16 w-16 rounded-full bg-yellow-400/20" />
              </div>
            )}
          </div>

          <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/50">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-gray-400">{t.remaining_tries}</span>
              <span className="text-sm font-bold text-purple-400">{user.spinsLeft} / 5</span>
            </div>
            <div className="flex gap-2 justify-center">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i < user.spinsLeft ? "bg-gradient-to-r from-purple-500 to-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.4)]" : "bg-slate-800"}`} />
              ))}
            </div>
          </div>

          {Number(user.spinsLeft) > 0 ? (
            <>
              <button
                onClick={handleSpin}
                disabled={isSpinning}
                className="w-full h-14 text-lg font-black transition-all duration-300 rounded-xl"
                style={{
                  background: "linear-gradient(135deg,#eab308,#ca8a04,#eab308)",
                  color: "#0f172a",
                  boxShadow: "0 4px 15px rgba(234,179,8,0.3)",
                  border: "none", cursor: isSpinning ? "not-allowed" : "pointer",
                  opacity: isSpinning ? 0.7 : 1,
                }}
              >
                {isSpinning ? t.spinning : t.spin_btn}
              </button>
              <button
                onClick={() => setShowBuyModal(true)}
                className="w-full h-10 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
                style={{
                  background: "rgba(250,204,21,0.08)",
                  border: "1px solid rgba(250,204,21,0.25)",
                  color: "#facc15", cursor: "pointer",
                }}
              >
                <ShoppingCart size={15} />
                t.spin_buy_more المزيد من الدورات بنقاطك"
              </button>
              <p className="text-[10px] text-gray-500 text-center uppercase tracking-widest font-bold">
                {t.daily_spins_info}
              </p>
            </>
          ) : (
            <div className="space-y-3">
              <div className="bg-slate-800/60 border border-purple-700/40 rounded-xl p-4 text-center space-y-1">
                <p className="text-yellow-400 font-bold text-sm">{t.no_spins_left}</p>
                <p className="text-gray-400 text-xs">{t.watch_ad_for_spin_desc}</p>
                {Number(adSpinsLeft) > 0 && (
                  <p className="text-purple-400 text-xs font-bold">
                    {adSpinsLeft}/{MAX_AD_SPINS} {t.spin_ads_left today"}
                  </p>
                )}
              </div>
              <button
                onClick={handleWatchSpinAdClick}
                disabled={adSpinsLeft <= 0 || tokenLoading}
                className="w-full h-14 text-base font-black rounded-xl flex items-center justify-center gap-2 transition-all"
                style={{
                  background: adSpinsLeft > 0 && !tokenLoading ? "linear-gradient(135deg,#7c3aed,#4f46e5)" : "rgba(255,255,255,0.08)",
                  color: "#fff",
                  boxShadow: adSpinsLeft > 0 && !tokenLoading ? "0 4px 20px rgba(139,92,246,0.4)" : "none",
                  border: "none", cursor: adSpinsLeft > 0 && !tokenLoading ? "pointer" : "not-allowed",
                }}
              >
                <Tv2 className="h-5 w-5" />
                {tokenLoading ? "..." : adSpinsLeft > 0 ? t.watch_ad_earn_spin : t.no_more_daily_ads}
              </button>
              <button
                onClick={() => setShowBuyModal(true)}
                className="w-full h-12 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
                style={{
                  background: "rgba(250,204,21,0.08)",
                  border: "1px solid rgba(250,204,21,0.3)",
                  color: "#facc15", cursor: "pointer",
                }}
              >
                <ShoppingCart size={16} />
                t.spin_buy_with_points دورات بنقاطك"
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
