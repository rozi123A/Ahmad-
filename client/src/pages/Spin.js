import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import confetti from 'canvas-confetti';
import { getSpinStatus, playSpin } from '../services/api';

const PRIZES = [50, 75, 100, 200, 500];
const COLORS = ['#00d4ff', '#a855f7', '#00ff88', '#ffd700', '#ff006e'];

// — صوت من مستودع Claude —
const getAudioCtx = () => {
  try { return new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
};

// الصوت الأول: نقرة واحدة (تُشغَّل بسرعة أثناء الدوران وتتباطأ)
const playTick = (ctx, t) => {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = 'triangle';
  o.frequency.setValueAtTime(900, t);
  o.frequency.exponentialRampToValueAtTime(400, t + 0.04);
  g.gain.setValueAtTime(0.18, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  o.start(t); o.stop(t + 0.05);
};

// الصوت الثاني: نغمة الفوز (وتر دو الكبير)
const playWinSound = (ctx) => {
  const now = ctx.currentTime;
  [261.63, 329.63, 392.0, 523.25].forEach((freq, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'sine';
    const tt = now + i * 0.13;
    o.frequency.setValueAtTime(freq, tt);
    g.gain.setValueAtTime(0, tt);
    g.gain.linearRampToValueAtTime(0.3, tt + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, tt + 0.35);
    o.start(tt); o.stop(tt + 0.4);
  });
};

const playSpinSound = () => {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dur = 4.2;
    // الصوت الأول: نقرات تتباطأ تدريجياً
    let t = now, iv = 0.06;
    while (t < now + dur) { playTick(ctx, t); t += iv; iv = 0.06 + ((t - now) / dur) * 0.55; }
    // الصوت الثاني: نغمة الفوز بعد توقف العجلة
    setTimeout(() => { playWinSound(ctx); }, (dur + 0.3) * 1000);
  } catch (e) {}
};

function Spin({ user, updatePoints }) {
  const [status, setStatus] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lastPrize, setLastPrize] = useState(null);
  const [loading, setLoading] = useState(true);
  const rotationRef = useRef(0);
  const spinningRef = useRef(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await getSpinStatus();
      setStatus(res.data);
    } catch (err) {
      setStatus({ freeSpinsLeft: 5, adSpinsLeft: 5 });
    } finally {
      setLoading(false);
    }
  };

  const handleSpin = async (isAdSpin = false) => {
    if (spinningRef.current) return;

    spinningRef.current = true;
    setSpinning(true);
    playSpinSound();

    try {
      const res = await playSpin(isAdSpin);
      const { prize, newBalance, freeSpinsLeft, adSpinsLeft } = res.data;

      const prizeIndex = PRIZES.indexOf(prize);
      const segmentAngle = 360 / PRIZES.length;
      const targetAngle = 360 - (prizeIndex * segmentAngle + segmentAngle / 2);
      const newRotation = rotationRef.current + 1440 + targetAngle;

      rotationRef.current = newRotation;
      setRotation(newRotation);

      setTimeout(() => {
        setLastPrize(prize);
        updatePoints(newBalance);
        setStatus({ freeSpinsLeft, adSpinsLeft });
        spinningRef.current = false;
        setSpinning(false);

        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#00d4ff', '#a855f7', '#ffd700', '#00ff88'],
        });

        toast.success('🎉 ربحت ' + prize + ' نقطة!');
      }, 4500);
    } catch (err) {
      spinningRef.current = false;
      setSpinning(false);
      toast.error(err.response?.data?.error || 'حدث خطأ، حاول مجدداً');
    }
  };

  const handleAdSpin = () => {
    if (!status || status.adSpinsLeft <= 0) {
      toast.warning('لا توجد دورات إعلانية متبقية اليوم!');
      return;
    }
    handleSpin(true);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p style={{ color: 'var(--neon-blue)' }}>جاري التحميل...</p>
      </div>
    );
  }

  const freeLeft = status?.freeSpinsLeft ?? 5;
  const adLeft = status?.adSpinsLeft ?? 5;

  return (
    <div className="spin-container">
      <h1 className="page-title">🎰 عجلة الحظ</h1>

      <div className="wheel-wrapper">
        <div className="wheel-pointer"></div>
        <div
          className="wheel"
          style={{
            transform: 'rotate(' + rotation + 'deg)',
            transition: spinning
              ? 'transform 4.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)'
              : 'none',
          }}
        >
          <svg viewBox="0 0 300 300" style={{ width: '100%', height: '100%' }}>
            {PRIZES.map((prize, i) => {
              const angle = (360 / PRIZES.length) * i;
              const rad = (angle * Math.PI) / 180;
              const nextRad = ((angle + 360 / PRIZES.length) * Math.PI) / 180;
              const x1 = 150 + 140 * Math.cos(rad);
              const y1 = 150 + 140 * Math.sin(rad);
              const x2 = 150 + 140 * Math.cos(nextRad);
              const y2 = 150 + 140 * Math.sin(nextRad);
              const textAngle = angle + 360 / PRIZES.length / 2;
              const textRad = (textAngle * Math.PI) / 180;
              const tx = 150 + 90 * Math.cos(textRad);
              const ty = 150 + 90 * Math.sin(textRad);

              return (
                <g key={i}>
                  <path
                    d={'M150,150 L' + x1 + ',' + y1 + ' A140,140 0 0,1 ' + x2 + ',' + y2 + ' Z'}
                    fill={COLORS[i % COLORS.length]}
                    opacity="0.85"
                    stroke="#0a0a1a"
                    strokeWidth="2"
                  />
                  <text
                    x={tx}
                    y={ty}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize="15"
                    fontWeight="bold"
                    transform={'rotate(' + textAngle + ', ' + tx + ', ' + ty + ')'}
                  >
                    {prize}
                  </text>
                </g>
              );
            })}
            <circle cx="150" cy="150" r="25" fill="#0a0a1a" stroke="var(--neon-gold)" strokeWidth="3" />
            <text x="150" y="155" textAnchor="middle" dominantBaseline="middle" fill="var(--neon-gold)" fontSize="12" fontWeight="bold">GO</text>
          </svg>
        </div>
      </div>

      {lastPrize && (
        <div className="neon-card" style={{ textAlign: 'center', marginBottom: '16px' }}>
          <p style={{ color: 'var(--neon-gold)', fontSize: '22px', fontWeight: '900' }}>
            🎉 ربحت {lastPrize} نقطة!
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', padding: '0 16px', width: '100%' }}>
        <div className="stat-card" style={{ flex: 1 }}>
          <div className="stat-value">{freeLeft}</div>
          <div className="stat-label">دورات مجانية</div>
        </div>
        <div className="stat-card" style={{ flex: 1 }}>
          <div className="stat-value">{adLeft}</div>
          <div className="stat-label">دورات إعلانية</div>
        </div>
      </div>

      <div style={{ width: '100%', padding: '0 16px' }}>
        {freeLeft > 0 ? (
          <button
            className="glow-btn"
            onClick={() => handleSpin(false)}
            disabled={spinning}
            style={{ marginBottom: '10px' }}
          >
            {spinning ? '⏳ جاري الدوران...' : '🎰 أدر العجلة (' + freeLeft + ' متبقي)'}
          </button>
        ) : adLeft > 0 ? (
          <button
            className="glow-btn gold"
            onClick={handleAdSpin}
            disabled={spinning}
            style={{ marginBottom: '10px' }}
          >
            {spinning ? '⏳ جاري الدوران...' : '📺 شاهد إعلان واربح دورة'}
          </button>
        ) : (
          <div className="neon-card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>
              ⏰ انتهت دوراتك اليومية
            </p>
            <p style={{ color: 'var(--neon-blue)', fontSize: '14px', marginTop: '8px' }}>
              عد غداً لـ 5 دورات مجانية جديدة!
            </p>
          </div>
        )}
      </div>

      <div className="neon-card" style={{ marginTop: '8px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          💡 5 دورات مجانية يومياً + 5 دورات بمشاهدة إعلانات
        </p>
      </div>
    </div>
  );
}

export default Spin;
