import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import confetti from 'canvas-confetti';
import { getDailyStatus, claimDaily } from '../services/api';

function DailyGift({ user, updatePoints }) {
  const [canClaim, setCanClaim] = useState(false);
  const [nextClaimAt, setNextClaimAt] = useState(null);
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [opened, setOpened] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    if (!nextClaimAt) return;
    const interval = setInterval(() => {
      const now = new Date();
      const target = new Date(nextClaimAt);
      const diff = target - now;

      if (diff <= 0) {
        setCanClaim(true);
        setNextClaimAt(null);
        clearInterval(interval);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown({ hours, minutes, seconds });
    }, 1000);

    return () => clearInterval(interval);
  }, [nextClaimAt]);

  const fetchStatus = async () => {
    try {
      const res = await getDailyStatus();
      setCanClaim(res.data.canClaim);
      setNextClaimAt(res.data.nextClaimAt);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!canClaim) return;
    
    setOpened(true);
    
    try {
      const res = await claimDaily();
      
      setTimeout(() => {
        updatePoints(res.data.newBalance);
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.5 },
          colors: ['#a855f7', '#ffd700', '#ff006e', '#00d4ff'],
        });
        toast.success(`🎁 حصلت على ${res.data.amount} pts!`);
        setCanClaim(false);
        fetchStatus();
      }, 800);
    } catch (err) {
      setOpened(false);
      toast.error(err.response?.data?.error || 'حدث خطأ');
    }
  };

  if (loading) {
    return <div className="loading-screen"><div className="spinner"></div></div>;
  }

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1 className="page-title">🎁 الهدية اليومية</h1>

      <div className="gift-box-container">
        <div className={`gift-box ${opened ? 'opened' : ''}`} onClick={canClaim ? handleClaim : undefined}>
          <div className="ribbon"></div>
          <div className="box-body">🎁</div>
        </div>
      </div>

      {canClaim ? (
        <div style={{ marginTop: '30px' }}>
          <p style={{ color: 'var(--neon-green)', fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>
            ✨ هديتك جاهزة! اضغط على الصندوق
          </p>
          <button className="glow-btn green" onClick={handleClaim}>
            🎁 افتح الهدية (+100 pts)
          </button>
        </div>
      ) : (
        <div style={{ marginTop: '30px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px', marginBottom: '16px' }}>
            الهدية القادمة بعد:
          </p>
          <div className="countdown">
            <div className="countdown-item">
              <div className="countdown-value">{String(countdown.hours).padStart(2, '0')}</div>
              <div className="countdown-label">ساعة</div>
            </div>
            <div className="countdown-item">
              <div className="countdown-value">{String(countdown.minutes).padStart(2, '0')}</div>
              <div className="countdown-label">دقيقة</div>
            </div>
            <div className="countdown-item">
              <div className="countdown-value">{String(countdown.seconds).padStart(2, '0')}</div>
              <div className="countdown-label">ثانية</div>
            </div>
          </div>
        </div>
      )}

      <div className="neon-card" style={{ marginTop: '30px' }}>
        <h3 style={{ color: 'var(--neon-purple)', marginBottom: '8px' }}>💡 معلومة</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          احصل على 100 نقطة مجاناً كل 24 ساعة! لا تنسَ العودة يومياً.
        </p>
      </div>
    </div>
  );
}

export default DailyGift;
