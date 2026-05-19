import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { getAdsStatus, completeAd, getAdConfig } from '../services/api';

function WatchAds({ user, updatePoints }) {
  const [status, setStatus] = useState({ adsWatched: 0, adsRemaining: 50, pointsPerAd: 10 });
  const [watching, setWatching] = useState(false);
  const [watchProgress, setWatchProgress] = useState(0);
  const [adConfig, setAdConfig] = useState(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    fetchStatus();
    fetchAdConfig();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await getAdsStatus();
      setStatus(res.data);
    } catch (err) {}
  };

  const fetchAdConfig = async () => {
    try {
      const res = await getAdConfig();
      setAdConfig(res.data);
    } catch (err) {}
  };

  const startWatching = () => {
    if (status.adsRemaining <= 0) {
      toast.warning('وصلت للحد اليومي!');
      return;
    }

    setWatching(true);
    setWatchProgress(0);
    startTimeRef.current = Date.now();

    // Simulate ad watching (15 seconds minimum)
    // In production, this integrates with Adsgram SDK
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const progress = Math.min((elapsed / 15) * 100, 100);
      setWatchProgress(progress);

      if (progress >= 100) {
        clearInterval(timerRef.current);
        completeAdWatch();
      }
    }, 100);
  };

  const completeAdWatch = async () => {
    try {
      const watchDuration = (Date.now() - startTimeRef.current) / 1000;
      const res = await completeAd('rewarded_ad', watchDuration);
      
      updatePoints(res.data.newBalance);
      setStatus(prev => ({
        ...prev,
        adsWatched: prev.adsWatched + 1,
        adsRemaining: res.data.adsRemaining,
      }));
      
      toast.success(`+${status.pointsPerAd} pts! 🎬`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'حدث خطأ');
    } finally {
      setWatching(false);
      setWatchProgress(0);
    }
  };

  const cancelWatch = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setWatching(false);
    setWatchProgress(0);
    toast.warning('تم إلغاء المشاهدة - لم يتم احتساب النقاط');
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1 className="page-title">📺 مشاهدة الإعلانات</h1>

      <div className="neon-card" style={{ textAlign: 'center' }}>
        <div className="stats-grid" style={{ padding: 0 }}>
          <div className="stat-card">
            <div className="stat-value">{status.adsRemaining}</div>
            <div className="stat-label">إعلانات متبقية</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{status.adsWatched}</div>
            <div className="stat-label">تمت مشاهدتها</div>
          </div>
        </div>
        <p style={{ color: 'var(--neon-gold)', marginTop: '12px', fontSize: '14px' }}>
          +{status.pointsPerAd} pts لكل إعلان
        </p>
      </div>

      {watching ? (
        <div className="neon-card" style={{ textAlign: 'center', marginTop: '20px' }}>
          <p style={{ color: 'var(--neon-blue)', marginBottom: '16px', fontSize: '16px' }}>
            📺 جاري مشاهدة الإعلان...
          </p>
          <div style={{ 
            width: '100%', 
            height: '8px', 
            background: 'var(--bg-primary)', 
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: '12px'
          }}>
            <div style={{ 
              width: `${watchProgress}%`, 
              height: '100%', 
              background: 'linear-gradient(90deg, var(--neon-blue), var(--neon-green))',
              borderRadius: '4px',
              transition: 'width 0.1s linear'
            }}></div>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
            {Math.ceil(15 - (watchProgress / 100 * 15))} ثوانٍ متبقية
          </p>
          <button 
            className="glow-btn pink" 
            onClick={cancelWatch}
            style={{ marginTop: '12px' }}
          >
            ❌ إلغاء (لن تحصل على نقاط)
          </button>
        </div>
      ) : (
        <div style={{ marginTop: '20px' }}>
          <button 
            className="glow-btn green" 
            onClick={startWatching}
            disabled={status.adsRemaining <= 0}
          >
            {status.adsRemaining > 0 ? `▶️ شاهد إعلان (+${status.pointsPerAd} pts)` : '⏰ عد غداً'}
          </button>
        </div>
      )}

      <div className="neon-card" style={{ marginTop: '20px' }}>
        <h3 style={{ color: 'var(--neon-purple)', marginBottom: '8px', fontSize: '14px' }}>⚠️ ملاحظة</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          يجب مشاهدة الإعلان كاملاً للحصول على النقاط. إغلاق الإعلان قبل انتهائه لن يحتسب.
        </p>
      </div>
    </div>
  );
}

export default WatchAds;
