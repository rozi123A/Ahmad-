import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles/App.css';

import Home from './pages/Home';
import Spin from './pages/Spin';
import DailyGift from './pages/DailyGift';
import WatchAds from './pages/WatchAds';
import Withdraw from './pages/Withdraw';
import Profile from './pages/Profile';
import Referral from './pages/Referral';
import Notifications from './pages/Notifications';
import AdminDashboard from './pages/AdminDashboard';
import { authTelegram, getDailyStatus, claimDaily, getNotifications } from './services/api';
import { LanguageProvider, useLang } from './LanguageContext';
import confetti from 'canvas-confetti';

function AppInner() {
  const { t, lang } = useLang();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [dailyModal, setDailyModal] = useState(false);
  const [dailyClaiming, setDailyClaiming] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [prevUnread, setPrevUnread] = useState(0);

  useEffect(() => { initApp(); }, []);

  const pollNotifications = useCallback(async () => {
    try {
      const res = await getNotifications();
      const count = res.data.unreadCount || 0;
      setUnreadCount(count);
      // Show toast when new notification arrives
      if (count > prevUnread && prevUnread >= 0) {
        const newest = res.data.notifications?.[0];
        if (newest && !newest.read) {
          toast.info(`🔔 ${newest.title}`, {
            position: 'top-center',
            autoClose: 4000,
            onClick: () => { window.location.hash = '#/notifications'; },
          });
        }
      }
      setPrevUnread(count);
    } catch (e) {}
  }, [prevUnread]);

  useEffect(() => {
    if (!user) return;
    pollNotifications();
    const interval = setInterval(pollNotifications, 30000);
    return () => clearInterval(interval);
  }, [user, pollNotifications]);

  const initApp = async () => {
    try {
      const tg = window.Telegram?.WebApp;
      if (tg) { tg.ready(); tg.expand(); tg.setHeaderColor('#070711'); tg.setBackgroundColor('#070711'); }
      const telegramUser = tg?.initDataUnsafe?.user || { id: 'test_user', first_name: 'مستخدم', username: 'test' };
      const startParam = tg?.initDataUnsafe?.start_param || null;
      const response = await authTelegram(tg?.initData || '', telegramUser, startParam);
      const { token, user: userData } = response.data;
      localStorage.setItem('token', token);
      setUser(userData);
      setAuthError(false);
      setTimeout(async () => {
        try {
          const statusRes = await getDailyStatus();
          if (statusRes.data.canClaim) setDailyModal(true);
        } catch (e) {}
      }, 2000);
    } catch (error) {
      localStorage.removeItem('token');
      setAuthError(true);
    } finally {
      setLoading(false);
    }
  };

  const updatePoints = (newPoints) => setUser(prev => ({ ...prev, points: newPoints }));

  const handleClaimDaily = async () => {
    setDailyClaiming(true);
    try {
      const res = await claimDaily();
      updatePoints(res.data.newBalance);
      confetti({ particleCount: 150, spread: 100, origin: { y: 0.5 }, colors: ['#8b5cf6','#f59e0b','#ec4899','#3b82f6'] });
      toast.success(`🎁 +${res.data.amount} ${t('points')}`);
      setDailyModal(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    } finally {
      setDailyClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="orb orb-1" /><div className="orb orb-2" />
        <div style={{ fontSize: '48px', marginBottom: '8px' }}>🎰</div>
        <div className="spinner" />
        <p style={{ color: 'rgba(139,92,246,0.8)', fontSize: '14px' }}>{t('loading')}</p>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="loading-screen" style={{ padding: '32px' }}>
        <div className="orb orb-1" /><div className="orb orb-2" />
        <div style={{ fontSize: '56px' }}>⚠️</div>
        <p style={{ color: '#ef4444', fontSize: '18px', fontWeight: '700', textAlign: 'center' }}>{t('serverError')}</p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', textAlign: 'center' }}>{t('checkInternet')}</p>
        <button className="glow-btn" onClick={() => { setLoading(true); setAuthError(false); initApp(); }} style={{ maxWidth: '220px' }}>
          {t('retry')}
        </button>
      </div>
    );
  }

  return (
    <Router>
      <div className="app">
        <div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" />
        <ToastContainer position="top-center" rtl={lang === 'ar'} theme="dark"
          toastStyle={{ background: 'rgba(15,15,30,0.95)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '12px' }} />

        {dailyModal && (
          <div className="daily-modal-overlay" onClick={(e) => e.target === e.currentTarget && setDailyModal(false)}>
            <div className="daily-modal">
              <div style={{ fontSize: '64px', textAlign: 'center', marginBottom: '16px', animation: 'float 2s ease-in-out infinite' }}>🎁</div>
              <h2 style={{ textAlign: 'center', fontSize: '22px', fontWeight: '900', marginBottom: '8px', background: 'linear-gradient(135deg,#f59e0b,#fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {t('dailyTitle')}!
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontSize: '14px', marginBottom: '28px' }}>
                {t('dailyDesc')} 🎉
              </p>
              <button className="glow-btn green" onClick={handleClaimDaily} disabled={dailyClaiming} style={{ marginBottom: '12px' }}>
                {dailyClaiming ? '⏳...' : t('claimGift')}
              </button>
              <button onClick={() => setDailyModal(false)} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'Cairo, sans-serif', fontSize: '14px' }}>
                {lang === 'ar' ? 'لاحقاً' : lang === 'ru' ? 'Позже' : 'Later'}
              </button>
            </div>
          </div>
        )}

        <Routes>
          <Route path="/" element={<Home user={user} updatePoints={updatePoints} />} />
          <Route path="/spin" element={<Spin user={user} updatePoints={updatePoints} />} />
          <Route path="/daily" element={<DailyGift user={user} updatePoints={updatePoints} />} />
          <Route path="/ads" element={<WatchAds user={user} updatePoints={updatePoints} />} />
          <Route path="/withdraw" element={<Withdraw user={user} />} />
          <Route path="/profile" element={<Profile user={user} />} />
          <Route path="/referral" element={<Referral user={user} />} />
          <Route path="/notifications" element={<Notifications onMarkRead={() => setUnreadCount(0)} />} />
          <Route path="/admin" element={user?.isAdmin ? <AdminDashboard user={user} /> : <div style={{ display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',color:'#ef4444',fontSize:'18px' }}>⛔ {lang === 'ar' ? 'غير مصرح' : 'Unauthorized'}</div>} />
        </Routes>

        <nav className="bottom-nav">
          <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
            <span>{t('home')}</span>
          </NavLink>
          <NavLink to="/spin" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/><circle cx="12" cy="12" r="3"/></svg>
            <span>{t('spin')}</span>
          </NavLink>
          <NavLink to="/referral" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
            <span>{t('friends')}</span>
          </NavLink>

          {/* Notifications Bell with Badge */}
          <NavLink to="/notifications" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <div style={{ position: 'relative', display: 'inline-flex', justifyContent: 'center' }}>
              <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 24, height: 24 }}>
                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
              </svg>
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: -6, right: -8,
                  minWidth: 17, height: 17,
                  background: 'linear-gradient(135deg,#ef4444,#dc2626)',
                  borderRadius: '50%',
                  fontSize: 10,
                  fontWeight: 900,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                  boxShadow: '0 0 8px rgba(239,68,68,0.7)',
                  animation: 'pulse-badge 1.5s ease-in-out infinite',
                  lineHeight: 1,
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <span>{lang === 'ar' ? 'إشعارات' : lang === 'ru' ? 'Уведомления' : 'Alerts'}</span>
          </NavLink>

          <NavLink to="/withdraw" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
            <span>{t('withdraw')}</span>
          </NavLink>

          {user?.isAdmin && (
            <NavLink to="/admin" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
              <span>{t('admin')}</span>
            </NavLink>
          )}
        </nav>

        <style>{`
          @keyframes pulse-badge {
            0%, 100% { transform: scale(1); box-shadow: 0 0 8px rgba(239,68,68,0.7); }
            50% { transform: scale(1.15); box-shadow: 0 0 14px rgba(239,68,68,0.9); }
          }
        `}</style>
      </div>
    </Router>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AppInner />
    </LanguageProvider>
  );
}

export default App;
