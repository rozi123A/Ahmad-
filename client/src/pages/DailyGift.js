import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import confetti from 'canvas-confetti';
import { getDailyStatus, claimDaily } from '../services/api';
import { useLang } from '../LanguageContext';

function DailyGift({ user, updatePoints }) {
  const { t } = useLang();
  const [canClaim, setCanClaim] = useState(false);
  const [nextClaimAt, setNextClaimAt] = useState(null);
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [opened, setOpened] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchStatus(); }, []);

  useEffect(() => {
    if (!nextClaimAt) return;
    const interval = setInterval(() => {
      const now = new Date(), target = new Date(nextClaimAt), diff = target - now;
      if (diff <= 0) { setCanClaim(true); setNextClaimAt(null); clearInterval(interval); return; }
      setCountdown({
        hours: Math.floor(diff / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [nextClaimAt]);

  const fetchStatus = async () => {
    try {
      const res = await getDailyStatus();
      setCanClaim(res.data.canClaim);
      setNextClaimAt(res.data.nextClaimAt);
    } catch (err) {}
    finally { setLoading(false); }
  };

  const handleClaim = async () => {
    if (!canClaim) return;
    setOpened(true);
    try {
      const res = await claimDaily();
      setTimeout(() => {
        updatePoints(res.data.newBalance);
        confetti({
          particleCount: 200,
          spread: 120,
          origin: { y: 0.5 },
          colors: ['#8b5cf6', '#f59e0b', '#ec4899', '#3b82f6', '#10b981'],
        });
        toast.success(`🎁 +${res.data.amount} ${t('points')}!`);
        setCanClaim(false);
        fetchStatus();
      }, 700);
    } catch (err) {
      setOpened(false);
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  return (
    <div style={{ padding: '0 0 24px', textAlign: 'center', position: 'relative', zIndex: 1, minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ padding: '0 20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '900', background: 'linear-gradient(135deg,#f59e0b,#ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '8px' }}>
          🎁 {t('dailyTitle')}
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginBottom: '40px' }}>{t('dailyDesc')}</p>
      </div>

      {/* Gift Box */}
      <div style={{ marginBottom: '40px' }}>
        <div
          onClick={canClaim ? handleClaim : undefined}
          style={{
            fontSize: '100px',
            cursor: canClaim ? 'pointer' : 'default',
            animation: canClaim ? 'float 2s ease-in-out infinite' : 'none',
            filter: canClaim ? 'drop-shadow(0 0 30px rgba(245,158,11,0.6))' : 'grayscale(0.3)',
            transition: 'all 0.3s ease',
            transform: opened ? 'scale(1.3)' : 'scale(1)',
          }}
        >
          {opened ? '🎉' : '🎁'}
        </div>
      </div>

      <div style={{ width: '100%', padding: '0 24px', maxWidth: '360px' }}>
        {canClaim ? (
          <div>
            <div style={{
              padding: '16px',
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: '16px',
              marginBottom: '20px',
              fontSize: '14px',
              color: '#34d399',
              fontWeight: '600',
            }}>
              ✨ {t('giftReady')}
            </div>
            <button className="glow-btn green" onClick={handleClaim} style={{ fontSize: '16px', padding: '16px' }}>
              {t('claimGift')}
            </button>
          </div>
        ) : (
          <div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '20px' }}>{t('nextGift')}</p>
            <div className="countdown" style={{ justifyContent: 'center' }}>
              {[['hours', t('hour')], ['minutes', t('minute')], ['seconds', t('second')]].map(([key, label]) => (
                <div key={key} className="countdown-item">
                  <div className="countdown-value">{String(countdown[key]).padStart(2, '0')}</div>
                  <div className="countdown-label">{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DailyGift;
