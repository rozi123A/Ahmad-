import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import confetti from 'canvas-confetti';
import { getDailyStatus, claimDaily, getAdsStatus, completeAd } from '../services/api';
import { useLang } from '../LanguageContext';

function DailyGift({ user, updatePoints }) {
  const { t } = useLang();
  const [canClaim, setCanClaim] = useState(false);
  const [nextClaimAt, setNextClaimAt] = useState(null);
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [opened, setOpened] = useState(false);
  const [loading, setLoading] = useState(true);
  const [watchingAd, setWatchingAd] = useState(false);
  const [adProgress, setAdProgress] = useState(0);
  const [adTimeLeft, setAdTimeLeft] = useState(15);
  const [adsRemaining, setAdsRemaining] = useState(50);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    fetchStatus();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    if (!nextClaimAt) return;
    const interval = setInterval(() => {
      const now = new Date(), target = new Date(nextClaimAt), diff = target - now;
      if (diff <= 0) { setCanClaim(true); setNextClaimAt(null); clearInterval(interval); return; }
      setCountdown({ hours: Math.floor(diff / 3600000), minutes: Math.floor((diff % 3600000) / 60000), seconds: Math.floor((diff % 60000) / 1000) });
    }, 1000);
    return () => clearInterval(interval);
  }, [nextClaimAt]);

  const fetchStatus = async () => {
    try {
      const [dailyRes, adsRes] = await Promise.allSettled([getDailyStatus(), getAdsStatus()]);
      if (dailyRes.status === 'fulfilled') { setCanClaim(dailyRes.value.data.canClaim); setNextClaimAt(dailyRes.value.data.nextClaimAt); }
      if (adsRes.status === 'fulfilled') setAdsRemaining(adsRes.value.data.adsRemaining ?? 50);
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
        confetti({ particleCount: 200, spread: 120, origin: { y: 0.5 }, colors: ['#8b5cf6','#f59e0b','#ec4899','#3b82f6','#10b981'] });
        toast.success(`🎁 +${res.data.amount} ${t('points')}!`);
        setCanClaim(false); fetchStatus();
      }, 700);
    } catch (err) { setOpened(false); toast.error(err.response?.data?.error || 'Error'); }
  };

  const startAdWatch = () => {
    if (adsRemaining <= 0) { toast.warning(t('adsFinished')); return; }
    setWatchingAd(true); setAdProgress(0); setAdTimeLeft(15);
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const progress = Math.min((elapsed / 15) * 100, 100);
      setAdProgress(progress); setAdTimeLeft(Math.max(0, Math.ceil(15 - elapsed)));
      if (progress >= 100) { clearInterval(timerRef.current); finishAd(); }
    }, 100);
  };

  const finishAd = async () => {
    try {
      const watchDuration = (Date.now() - startTimeRef.current) / 1000;
      const res = await completeAd('daily_bonus_ad', watchDuration);
      updatePoints(res.data.newBalance); setAdsRemaining(prev => prev - 1);
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ['#f59e0b','#8b5cf6'] });
      toast.success(`📺 +${res.data.pointsEarned || 10} ${t('points')}!`);
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
    finally { setWatchingAd(false); setAdProgress(0); }
  };

  const cancelAd = () => { if (timerRef.current) clearInterval(timerRef.current); setWatchingAd(false); setAdProgress(0); };

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  return (
    <div style={{ padding: '0 0 24px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
      <div style={{ padding: '24px 20px 0' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '900', background: 'linear-gradient(135deg,#f59e0b,#ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          🎁 {t('dailyTitle')}
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '4px' }}>{t('dailyDesc')}</p>
      </div>

      <div style={{ margin: '24px 0' }}>
        <div className="gift-box-container">
          <div className={`gift-box ${opened ? 'opened' : ''}`} onClick={canClaim ? handleClaim : undefined} style={{ cursor: canClaim ? 'pointer' : 'default' }}>
            <div className="ribbon" /><div className="box-body">🎁</div>
          </div>
        </div>
      </div>

      <div style={{ margin: '0 16px' }}>
        {canClaim ? (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#10b981', marginBottom: '16px' }}>{t('giftReady')}</div>
            <button className="glow-btn green" onClick={handleClaim} style={{ maxWidth: '280px', margin: '0 auto', display: 'block' }}>
              {t('claimGift')}
            </button>
          </div>
        ) : (
          <div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '12px' }}>{t('nextGift')}</p>
            <div className="countdown">
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

      <div style={{ margin: '16px' }}>
        <div className="card card-gold">
          <div className="section-header">
            <div className="section-icon gold">📺</div>
            <div>
              <div className="section-title">{t('bonusAds')}</div>
              <div className="section-subtitle">{t('bonusAdsSub')} · {t('remaining')}: {adsRemaining}</div>
            </div>
          </div>
          {watchingAd ? (
            <div>
              <div style={{ fontSize: '14px', color: '#60a5fa', marginBottom: '12px' }}>📺 {adTimeLeft}s</div>
              <div className="progress-bar" style={{ marginBottom: '12px' }}>
                <div className="progress-fill" style={{ width: `${adProgress}%`, background: 'linear-gradient(90deg,#f59e0b,#10b981)' }} />
              </div>
              <button className="glow-btn pink" onClick={cancelAd} style={{ fontSize: '13px', padding: '10px' }}>❌</button>
            </div>
          ) : (
            <button className="glow-btn gold" onClick={startAdWatch} disabled={adsRemaining <= 0} style={{ fontSize: '14px' }}>
              {adsRemaining > 0 ? t('watchNow') : t('adsFinished')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default DailyGift;
