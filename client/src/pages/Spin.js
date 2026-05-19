import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import confetti from 'canvas-confetti';
import { getSpinStatus, playSpin } from '../services/api';

const PRIZES = [50, 75, 100, 200, 500];
const COLORS = ['#00d4ff', '#a855f7', '#00ff88', '#ffd700', '#ff006e'];

const playSpinSound = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Tick-tock click sound layer
    const playTick = (time, vol = 0.18) => {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.008));
      }
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      src.buffer = buf;
      src.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(vol, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
      src.start(time);
    };

    // Spinning whoosh layer
    const whoosh = ctx.createOscillator();
    const whooshGain = ctx.createGain();
    const whooshFilter = ctx.createBiquadFilter();
    whoosh.type = 'sawtooth';
    whoosh.frequency.setValueAtTime(180, ctx.currentTime);
    whoosh.frequency.linearRampToValueAtTime(40, ctx.currentTime + 4.2);
    whooshFilter.type = 'bandpass';
    whooshFilter.frequency.setValueAtTime(600, ctx.currentTime);
    whooshFilter.frequency.linearRampToValueAtTime(200, ctx.currentTime + 4.2);
    whooshFilter.Q.value = 1.5;
    whoosh.connect(whooshFilter);
    whooshFilter.connect(whooshGain);
    whooshGain.connect(ctx.destination);
    whooshGain.gain.setValueAtTime(0.06, ctx.currentTime);
    whooshGain.gain.setValueAtTime(0.06, ctx.currentTime + 3.5);
    whooshGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 4.5);
    whoosh.start(ctx.currentTime);
    whoosh.stop(ctx.currentTime + 4.5);

    // Bass rumble
    const bass = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bass.type = 'sine';
    bass.frequency.setValueAtTime(80, ctx.currentTime);
    bass.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 4.2);
    bass.connect(bassGain);
    bassGain.connect(ctx.destination);
    bassGain.gain.setValueAtTime(0.1, ctx.currentTime);
    bassGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 4.5);
    bass.start(ctx.currentTime);
    bass.stop(ctx.currentTime + 4.5);

    // Tick clicks — fast at start, slow at end
    const totalDuration = 4.2;
    let t = ctx.currentTime + 0.05;
    let interval = 0.06;
    let vol = 0.22;
    while (t < ctx.currentTime + totalDuration) {
      playTick(t, vol);
      t += interval;
      interval = Math.min(interval * 1.045, 0.55);
      vol = Math.max(vol * 0.985, 0.04);
    }

    // Win chime at end
    const chimeNotes = [523.25, 659.25, 783.99, 1046.5];
    chimeNotes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const startT = ctx.currentTime + 4.3 + i * 0.12;
      gain.gain.setValueAtTime(0, startT);
      gain.gain.linearRampToValueAtTime(0.18, startT + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, startT + 0.55);
      osc.start(startT);
      osc.stop(startT + 0.6);
    });

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
