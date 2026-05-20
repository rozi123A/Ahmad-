import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-toastify';
import confetti from 'canvas-confetti';
import { getSpinStatus, playSpin } from '../services/api';

const PRIZES = [
  { label: '50',   value: 50,   color: '#FF6B6B' },
  { label: '200',  value: 200,  color: '#4ECDC4' },
  { label: '100',  value: 100,  color: '#FFE66D' },
  { label: '500',  value: 500,  color: '#FF9F43' },
  { label: '75',   value: 75,   color: '#A29BFE' },
  { label: '1000', value: 1000, color: '#FAB1A0' },
  { label: '150',  value: 150,  color: '#55E6C1' },
  { label: '250',  value: 250,  color: '#FD79A8' },
];

const getAudioCtx = () => {
  try { return new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
};
const playTick = (ctx, t) => {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = 'triangle';
  o.frequency.setValueAtTime(900, t);
  o.frequency.exponentialRampToValueAtTime(400, t + 0.04);
  g.gain.setValueAtTime(0.18, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  o.start(t); o.stop(t + 0.05);
};
const playWinSound = (ctx) => {
  const now = ctx.currentTime;
  [261.63, 329.63, 392.0, 523.25].forEach((freq, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sine';
    const tt = now + i * 0.13;
    o.frequency.setValueAtTime(freq, tt);
    g.gain.setValueAtTime(0, tt);
    g.gain.linearRampToValueAtTime(0.3, tt + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, tt + 0.35);
    o.start(tt); o.stop(tt + 0.4);
  });
};
const playSpinSound = (ctx, dur) => {
  const now = ctx.currentTime; let t = now, iv = 0.06;
  while (t < now + dur) { playTick(ctx, t); t += iv; iv = 0.06 + ((t - now) / dur) * 0.55; }
};

function Spin({ user, updatePoints }) {
  const canvasRef     = useRef(null);
  const audioCtxRef   = useRef(null);
  const rotationRef   = useRef(0);
  const animFrameRef  = useRef(null);

  const [isSpinning,   setIsSpinning]   = useState(false);
  const [status,       setStatus]       = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [showModal,    setShowModal]    = useState(false);

  useEffect(() => { fetchStatus(); }, []);

  const fetchStatus = async () => {
    try { const res = await getSpinStatus(); setStatus(res.data); }
    catch { setStatus({ freeSpinsLeft: 5, adSpinsLeft: 5 }); }
    finally { setLoading(false); }
  };

  const drawWheel = useCallback((rot) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const cx = canvas.width / 2, cy = canvas.height / 2, r = cx - 18;
    const seg = PRIZES.length, arc = (2 * Math.PI) / seg;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.beginPath(); ctx.arc(cx, cy, r + 8, 0, 2 * Math.PI);
    ctx.fillStyle = '#1a0a2e'; ctx.fill();
    ctx.strokeStyle = '#8B5CF6'; ctx.lineWidth = 3; ctx.stroke();

    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
    for (let i = 0; i < seg; i++) {
      const s = i * arc, e = s + arc;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, s, e); ctx.closePath();
      ctx.fillStyle = PRIZES[i].color; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.save();
      ctx.rotate(s + arc / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#1a0a2e';
      ctx.font = `bold ${PRIZES.length > 6 ? 15 : 18}px 'Cairo', sans-serif`;
      ctx.fillText(PRIZES[i].label, r - 18, 6);
      ctx.restore();
    }
    ctx.restore();

    const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 28);
    grad.addColorStop(0, '#FFD700'); grad.addColorStop(1, '#F59E0B');
    ctx.beginPath(); ctx.arc(cx, cy, 28, 0, 2 * Math.PI);
    ctx.fillStyle = grad; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#1a0a2e'; ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('GO', cx, cy);

    ctx.beginPath();
    ctx.moveTo(cx - 12, cy - r - 8);
    ctx.lineTo(cx + 12, cy - r - 8);
    ctx.lineTo(cx, cy - r + 16);
    ctx.closePath();
    ctx.fillStyle = '#FFD700'; ctx.fill();
    ctx.strokeStyle = '#0a0a1a'; ctx.lineWidth = 1.5; ctx.stroke();
  }, []);

  useEffect(() => { drawWheel(rotationRef.current); }, [drawWheel]);

  const handleSpin = async () => {
    if (isSpinning) return;
    const freeLeft = status?.freeSpinsLeft ?? 0;
    if (freeLeft <= 0) { setShowModal(true); return; }

    setIsSpinning(true);
    if (!audioCtxRef.current) audioCtxRef.current = getAudioCtx();
    const actx = audioCtxRef.current;
    if (actx?.state === 'suspended') await actx.resume();

    try {
      const res = await playSpin(false);
      const { prize, newBalance, freeSpinsLeft, adSpinsLeft } = res.data;

      const idx = PRIZES.findIndex(p => p.value === prize);
      const segAngle = (2 * Math.PI) / PRIZES.length;
      const cur = rotationRef.current;
      const target = cur + 8 * Math.PI * 2 + (-(idx * segAngle + segAngle / 2) - Math.PI / 2 - cur % (2 * Math.PI));

      const dur = 4000, t0 = Date.now(), r0 = cur;
      if (actx) playSpinSound(actx, dur / 1000);

      const animate = () => {
        const p = Math.min((Date.now() - t0) / dur, 1);
        const eased = r0 + (target - r0) * (1 - Math.pow(1 - p, 4));
        rotationRef.current = eased;
        drawWheel(eased);
        if (p < 1) { animFrameRef.current = requestAnimationFrame(animate); }
        else {
          rotationRef.current = target;
          drawWheel(target);
          if (actx) playWinSound(actx);
          updatePoints(newBalance);
          setStatus({ freeSpinsLeft, adSpinsLeft });
          setIsSpinning(false);
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ['#FFD700', '#8B5CF6', '#FF6B6B', '#4ECDC4'] });
          toast.success(`🎉 ربحت ${prize} نقطة!`);
          if (freeSpinsLeft <= 0) setTimeout(() => setShowModal(true), 1200);
        }
      };
      animFrameRef.current = requestAnimationFrame(animate);
    } catch (err) {
      setIsSpinning(false);
      toast.error(err.response?.data?.error || 'حدث خطأ، حاول مجدداً');
    }
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner"></div>
      <p style={{ color: 'var(--neon-blue)' }}>جاري التحميل...</p>
    </div>
  );

  const freeLeft = status?.freeSpinsLeft ?? 5;
  const adLeft   = status?.adSpinsLeft   ?? 5;

  return (
    <div style={{ padding: '20px 16px 32px', position: 'relative', zIndex: 1 }}>
      {/* No Spins Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'linear-gradient(145deg,#130826,#0b1240)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 28, padding: '32px 24px', maxWidth: 360, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.6)', position: 'relative' }}>
            <button onClick={() => setShowModal(false)} style={{ position: 'absolute', top: 14, left: 14, background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 10, width: 32, height: 32, cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 16 }}>✕</button>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 52 }}>🎡</div>
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 900, color: '#fff', textAlign: 'center', marginBottom: 8 }}>انتهت دوراتك اليومية! 😅</h3>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 24, lineHeight: 1.6 }}>
              شاهد إعلاناً قصيراً واحصل على دورة إضافية.<br />
              يمكنك الحصول على حتى <span style={{ color: '#EC4899', fontWeight: 800 }}>5 دورات مجانية</span> يومياً!
            </p>
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>إعلانات اليوم</span>
                <span style={{ fontSize: 11, fontWeight: 900, color: '#EC4899' }}>{5 - adLeft} / 5</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${((5 - adLeft) / 5) * 100}%`, background: 'linear-gradient(90deg,#EC4899,#8B5CF6)', borderRadius: 3, transition: 'width 0.4s' }} />
              </div>
            </div>
            <button
              onClick={() => { setShowModal(false); toast.info('ميزة الإعلانات قريباً!'); }}
              disabled={adLeft <= 0}
              style={{ width: '100%', height: 54, borderRadius: 18, border: 'none', background: adLeft > 0 ? 'linear-gradient(135deg,#7c3aed,#EC4899)' : 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 15, fontWeight: 900, cursor: adLeft > 0 ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: adLeft > 0 ? '0 6px 24px rgba(139,92,246,0.45)' : 'none' }}
            >
              📺 {adLeft > 0 ? 'شاهد إعلاناً واربح دورة 🎡' : 'انتهت الإعلانات اليومية'}
            </button>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 12 }}>
              متبقي اليوم: {adLeft} من 5 إعلانات
            </p>
          </div>
        </div>
      )}

      <h1 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 20px', color: '#EC4899' }}>🎡 عجلة الحظ</h1>

      {/* Canvas Wheel */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 20, position: 'relative' }}>
        <div style={{ position: 'absolute', width: 280, height: 280, background: 'rgba(139,92,246,0.08)', borderRadius: '50%', filter: 'blur(32px)' }} />
        <canvas
          ref={canvasRef}
          width={320} height={320}
          onClick={!isSpinning && freeLeft > 0 ? handleSpin : undefined}
          style={{ position: 'relative', zIndex: 1, cursor: !isSpinning && freeLeft > 0 ? 'pointer' : 'default', filter: 'drop-shadow(0 0 18px rgba(139,92,246,0.35))', borderRadius: '50%', transition: 'transform 0.15s', transform: !isSpinning && freeLeft > 0 ? 'scale(1.02)' : 'scale(1)' }}
        />
      </div>

      {/* Spins Progress */}
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>الدورات المتبقية</span>
          <span style={{ fontSize: 13, fontWeight: 900, color: '#8B5CF6' }}>{freeLeft} / 5</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i < freeLeft ? 'linear-gradient(90deg,#8B5CF6,#EC4899)' : 'rgba(255,255,255,0.08)', transition: 'background 0.4s', boxShadow: i < freeLeft ? '0 0 6px rgba(139,92,246,0.5)' : 'none' }} />
          ))}
        </div>
      </div>

      {/* Spin Button */}
      {freeLeft > 0 ? (
        <button
          onClick={handleSpin}
          disabled={isSpinning}
          style={{ width: '100%', height: 56, borderRadius: 18, border: 'none', background: isSpinning ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#eab308,#ca8a04)', color: isSpinning ? 'rgba(255,255,255,0.3)' : '#0f172a', fontSize: 17, fontWeight: 900, cursor: isSpinning ? 'not-allowed' : 'pointer', boxShadow: isSpinning ? 'none' : '0 4px 20px rgba(234,179,8,0.4)', transition: 'all 0.3s' }}
        >
          {isSpinning ? '⏳ جاري الدوران...' : `🎰 أدر العجلة (${freeLeft} متبقي)`}
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 14, padding: '14px 16px', textAlign: 'center' }}>
            <p style={{ color: '#FFD700', fontWeight: 800, fontSize: 14, marginBottom: 4 }}>⏰ انتهت دوراتك اليومية</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>شاهد إعلاناً قصيراً للحصول على دورة إضافية</p>
            {adLeft > 0 && <p style={{ color: '#EC4899', fontSize: 11, fontWeight: 800, marginTop: 4 }}>{adLeft}/5 إعلانات متبقية اليوم</p>}
          </div>
          <button
            onClick={() => { toast.info('ميزة الإعلانات قريباً!'); }}
            disabled={adLeft <= 0}
            style={{ width: '100%', height: 54, borderRadius: 18, border: 'none', background: adLeft > 0 ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 15, fontWeight: 900, cursor: adLeft > 0 ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: adLeft > 0 ? '0 4px 20px rgba(139,92,246,0.4)' : 'none' }}
          >
            📺 {adLeft > 0 ? 'شاهد إعلان واربح دورة' : 'انتهت الإعلانات اليومية'}
          </button>
        </div>
      )}

      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: 14, fontWeight: 700, letterSpacing: '0.05em' }}>
        5 دورات مجانية يومياً + 5 دورات بمشاهدة إعلانات
      </p>
    </div>
  );
}

export default Spin;
