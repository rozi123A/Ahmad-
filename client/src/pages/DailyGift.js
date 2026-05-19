import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import confetti from 'canvas-confetti';
import { getDailyStatus, claimDaily, getAdsStatus, completeAd } from '../services/api';

function DailyGift({ user, updatePoints }) {
  const [canClaim, setCanClaim] = useState(false);
  const [nextClaimAt, setNextClaimAt] = useState(null);
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [opened, setOpened] = useState(false);
  const [loading, setLoading] = useState(true);
  const [watchingAd, setWatchingAd] = useState(false);
  const [adProgress, setAdProgress] = useState(0);
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
      const [dailyRes, adsRes] = await Promise.allSettled([getDailyStatus(), getAdsStatus()]);
      if (dailyRes.status === 'fulfilled') {
        setCanClaim(dailyRes.value.data.canClaim);
        setNextClaimAt(dailyRes.value.data.nextClaimAt);
      }
      if (adsRes.status === 'fulfilled') {
        setAdsRemaining(adsRes.value.data.adsRemaining ?? 50);
      }
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
        toast.success(`🎁 حصلت على ${res.data.amount} نقطة!`);
        setCanClaim(false);
        fetchStatus();
      }, 800);
    } catch (err) {
      setOpened(false);
      toast.error(err.response?.data?.error || 'حدث خطأ');
    }
  };

  const startAdForBonus = () => {
    if (adsRemaining <= 0) {
      toast.warning('وصلت للحد اليومي للإعلانات!');
      return;
    }
    setWatchingAd(true);
    setAdProgress(0);
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const progress = Math.min((elapsed / 15) * 100, 100);
      setAdProgress(progress);
      if (progress >= 100) {
        clearInterval(timerRef.current);
        completeAdWatch();
      }
    }, 100);
  };

  const completeAdWatch = async () => {
    try {
      const watchDuration = (Date.now() - startTimeRef.current) / 1000;
      const res = await completeAd('daily_bonus_ad', watchDuration);
      updatePoints(res.data.newBalance);
      setAdsRemaining(prev => prev - 1);
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#ffd700', '#00d4ff'],
      });
      toast.success(`📺 +${res.data.pointsEarned || 10} نقطة من الإعلان!`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'حدث خطأ في الإعلان');
    } finally {
      setWatchingAd(false);
      setAdProgress(0);
    }
  };

  const cancelAd = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setWatchingAd(false);
    setAdProgress(0);
    toast.warning('تم إلغاء الإعلان');
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
        <div style={{ marginTop: '20px' }}>
          <p style={{ color: 'var(--neon-green)', fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>
            ✨ هديتك جاهزة! اضغط على الصندوق أو الزر أدناه
          </p>
          <button className="glow-btn green" onClick={handleClaim} style={{ marginBottom: '12px' }}>
            🎁 افتح الهدية (+100 نقطة)
          </button>
        </div>
      ) : (
        <div style={{ marginTop: '20px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px', marginBottom: '12px' }}>
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

      <div style={{ marginTop: '20px' }}>
        <div className="neon-card" style={{ textAlign: 'right' }}>
          <h3 style={{ color: 'var(--neon-purple)', marginBottom: '12px', textAlign: 'center' }}>
            📺 شاهد إعلان واربح نقاط إضافية
          </h3>

          {watchingAd ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--neon-blue)', marginBottom: '12px' }}>
                📺 جاري مشاهدة الإعلان...
              </p>
              <div style={{
                width: '100%', height: '10px', background: 'var(--bg-primary)',
                borderRadius: '5px', overflow: 'hidden', marginBottom: '12px',
              }}>
                <div style={{
                  width: `${adProgress}%`, height: '100%',
                  background: 'linear-gradient(90deg, var(--neon-blue), var(--neon-green))',
                  borderRadius: '5px', transition: 'width 0.1s linear',
                }}></div>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '12px' }}>
                {Math.max(0, Math.ceil(15 - (adProgress / 100 * 15)))} ثانية متبقية
              </p>
              <button className="glow-btn pink" onClick={cancelAd} style={{ fontSize: '13px', padding: '10px' }}>
                ❌ إلغاء
              </button>
            </div>
          ) : (
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '12px', textAlign: 'center' }}>
                شاهد إعلاناً (15 ثانية) واحصل على +10 نقاط إضافية
              </p>
              <button
                className="glow-btn gold"
                onClick={startAdForBonus}
                disabled={adsRemaining <= 0}
              >
                {adsRemaining > 0 ? `▶️ شاهد إعلان (+10 نقطة)` : '⏰ انتهت إعلانات اليوم'}
              </button>
              <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '8px', textAlign: 'center' }}>
                متبقي: {adsRemaining} إعلان اليوم
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="neon-card" style={{ marginTop: '12px' }}>
        <h3 style={{ color: 'var(--neon-purple)', marginBottom: '8px' }}>💡 معلومة</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          احصل على 100 نقطة مجاناً كل 24 ساعة! بالإضافة إلى نقاط إضافية من الإعلانات.
        </p>
      </div>
    </div>
  );
}

export default DailyGift;
