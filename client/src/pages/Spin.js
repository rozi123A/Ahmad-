import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import confetti from 'canvas-confetti';
import { getSpinStatus, playSpin } from '../services/api';

const PRIZES = [50, 75, 100, 200, 500];
const COLORS = ['#00d4ff', '#a855f7', '#00ff88', '#ffd700', '#ff006e'];

function Spin({ user, updatePoints }) {
  const [status, setStatus] = useState({ freeSpinsLeft: 0, adSpinsLeft: 0 });
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lastPrize, setLastPrize] = useState(null);
  const wheelRef = useRef(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await getSpinStatus();
      setStatus(res.data);
    } catch (err) {}
  };

  const handleSpin = async (isAdSpin = false) => {
    if (spinning) return;
    
    if (!isAdSpin && status.freeSpinsLeft <= 0) {
      toast.warning('لا توجد دورات مجانية متبقية!');
      return;
    }

    setSpinning(true);
    try {
      const res = await playSpin(isAdSpin);
      const { prize, newBalance, freeSpinsLeft, adSpinsLeft } = res.data;

      // Calculate rotation
      const prizeIndex = PRIZES.indexOf(prize);
      const segmentAngle = 360 / PRIZES.length;
      const targetAngle = 360 - (prizeIndex * segmentAngle + segmentAngle / 2);
      const newRotation = rotation + 1440 + targetAngle; // 4 full rotations + target

      setRotation(newRotation);

      setTimeout(() => {
        setLastPrize(prize);
        updatePoints(newBalance);
        setStatus({ freeSpinsLeft, adSpinsLeft });
        setSpinning(false);

        // Confetti effect
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#00d4ff', '#a855f7', '#ffd700', '#00ff88'],
        });

        toast.success(`🎉 ربحت ${prize} pts!`);
      }, 4500);
    } catch (err) {
      setSpinning(false);
      toast.error(err.response?.data?.error || 'حدث خطأ');
    }
  };

  const handleAdSpin = () => {
    if (status.adSpinsLeft <= 0) {
      toast.warning('لا توجد دورات إعلانية متبقية اليوم!');
      return;
    }
    // Trigger ad then spin
    handleSpin(true);
  };

  return (
    <div className="spin-container">
      <h1 className="page-title">🎰 عجلة الحظ</h1>

      <div className="wheel-wrapper">
        <div className="wheel-pointer"></div>
        <div 
          ref={wheelRef}
          className="wheel" 
          style={{ transform: `rotate(${rotation}deg)` }}
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
                    d={`M150,150 L${x1},${y1} A140,140 0 0,1 ${x2},${y2} Z`}
                    fill={COLORS[i]}
                    opacity="0.8"
                    stroke="#0a0a1a"
                    strokeWidth="2"
                  />
                  <text
                    x={tx}
                    y={ty}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize="16"
                    fontWeight="bold"
                    transform={`rotate(${textAngle}, ${tx}, ${ty})`}
                  >
                    {prize}
                  </text>
                </g>
              );
            })}
            <circle cx="150" cy="150" r="25" fill="#0a0a1a" stroke="var(--neon-gold)" strokeWidth="3" />
          </svg>
        </div>
      </div>

      {lastPrize && (
        <div className="neon-card" style={{ textAlign: 'center', marginBottom: '16px' }}>
          <p style={{ color: 'var(--neon-gold)', fontSize: '20px', fontWeight: '900' }}>
            🎉 ربحت {lastPrize} pts!
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', fontSize: '14px' }}>
        <div className="stat-card" style={{ flex: 1 }}>
          <div className="stat-value">{status.freeSpinsLeft}</div>
          <div className="stat-label">دورات مجانية</div>
        </div>
        <div className="stat-card" style={{ flex: 1 }}>
          <div className="stat-value">{status.adSpinsLeft}</div>
          <div className="stat-label">دورات إعلانية</div>
        </div>
      </div>

      {status.freeSpinsLeft > 0 ? (
        <button className="glow-btn" onClick={() => handleSpin(false)} disabled={spinning}>
          {spinning ? '⏳ جاري الدوران...' : '🎰 أدر العجلة'}
        </button>
      ) : (
        <button className="glow-btn gold" onClick={handleAdSpin} disabled={spinning || status.adSpinsLeft <= 0}>
          {status.adSpinsLeft > 0 ? '📺 شاهد إعلان واربح دورة' : '⏰ عد غداً للمزيد'}
        </button>
      )}
    </div>
  );
}

export default Spin;
