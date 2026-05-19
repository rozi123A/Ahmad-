import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { getAdsStatus, completeAd } from '../services/api';
import { useLang } from '../LanguageContext';

function WatchAds({ user, updatePoints }) {
  const { t } = useLang();
  const [status, setStatus] = useState({ adsWatched: 0, adsRemaining: 50, pointsPerAd: 10 });
  const [watching, setWatching] = useState(false);
  const [watchProgress, setWatchProgress] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => { fetchStatus(); return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, []);

  const fetchStatus = async () => { try { const res = await getAdsStatus(); setStatus(res.data); } catch (err) {} };

  const startWatching = () => {
    if (status.adsRemaining <= 0) { toast.warning(t('adsFinished')); return; }
    setWatching(true); setWatchProgress(0); setTimeLeft(15);
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const progress = Math.min((elapsed / 15) * 100, 100);
      setWatchProgress(progress); setTimeLeft(Math.max(0, Math.ceil(15 - elapsed)));
      if (progress >= 100) { clearInterval(timerRef.current); completeAdWatch(); }
    }, 100);
  };

  const completeAdWatch = async () => {
    try {
      const watchDuration = (Date.now() - startTimeRef.current) / 1000;
      const res = await completeAd('rewarded_ad', watchDuration);
      updatePoints(res.data.newBalance);
      setStatus(prev => ({ ...prev, adsWatched: prev.adsWatched + 1, adsRemaining: res.data.adsRemaining }));
      toast.success(`🎉 +${status.pointsPerAd} ${t('points')}!`);
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
    finally { setWatching(false); setWatchProgress(0); }
  };

  const cancelWatch = () => { if (timerRef.current) clearInterval(timerRef.current); setWatching(false); setWatchProgress(0); setTimeLeft(15); };

  const totalAds = (status.adsWatched || 0) + (status.adsRemaining || 0);
  const progressPercent = totalAds > 0 ? Math.round(((status.adsWatched || 0) / totalAds) * 100) : 0;

  return (
    <div style={{ padding: '0 0 24px', position: 'relative', zIndex: 1 }}>
      <div style={{ padding: '24px 20px 0', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '8px' }}>📺</div>
        <h1 style={{ fontSize: '22px', fontWeight: '900', background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          {t('adsTitle')}
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '4px' }}>{t('adsDesc')} +{status.pointsPerAd} {t('points')}</p>
      </div>

      <div style={{ margin: '20px 16px 0' }}>
        <div className="stats-grid" style={{ padding: 0 }}>
          <div className="stat-card"><div className="stat-value" style={{ color: '#10b981', fontSize: '28px' }}>{status.adsWatched}</div><div className="stat-label">{t('watched')}</div></div>
          <div className="stat-card"><div className="stat-value" style={{ color: '#8b5cf6', fontSize: '28px' }}>{status.adsRemaining}</div><div className="stat-label">{t('todayRemaining')}</div></div>
        </div>
        <div style={{ marginTop: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>
            <span>{t('todayProgress')}</span><span>{progressPercent}%</span>
          </div>
          <div className="progress-bar"><div className="progress-fill green" style={{ width: `${progressPercent}%` }} /></div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: '6px' }}>
            {(status.adsWatched * status.pointsPerAd).toLocaleString()} {t('points')}
          </div>
        </div>
      </div>

      <div style={{ margin: '16px' }}>
        {watching ? (
          <div className="card card-blue" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>📺</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#60a5fa', marginBottom: '16px' }}>📺 {timeLeft}s</div>
            <div style={{ position: 'relative', width: '100px', height: '100px', margin: '0 auto 16px' }}>
              <svg viewBox="0 0 36 36" style={{ width: '100px', height: '100px', transform: 'rotate(-90deg)' }}>
                <circle cx="18" cy="18" r="15.9155" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
                <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray={`${watchProgress} 100`} strokeLinecap="round" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: '900', color: '#60a5fa' }}>{timeLeft}s</div>
            </div>
            <div className="progress-bar" style={{ marginBottom: '16px' }}>
              <div className="progress-fill" style={{ width: `${watchProgress}%`, background: 'linear-gradient(90deg,#3b82f6,#8b5cf6)' }} />
            </div>
            <button className="glow-btn pink" onClick={cancelWatch} style={{ fontSize: '14px', padding: '12px' }}>❌</button>
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center' }}>
            {status.adsRemaining > 0 ? (
              <>
                <div style={{ fontSize: '36px', marginBottom: '16px' }}>▶️</div>
                <div style={{ fontSize: '32px', fontWeight: '900', color: '#8b5cf6', marginBottom: '16px' }}>+{status.pointsPerAd} pts</div>
                <button className="glow-btn green" onClick={startWatching}>{t('watchBtn')} (+{status.pointsPerAd} {t('points')})</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>✅</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#10b981', marginBottom: '8px' }}>{t('doneAds')}</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>{t('doneAdsSub')}</div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default WatchAds;
