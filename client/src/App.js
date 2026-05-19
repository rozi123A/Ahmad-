import React, { useState, useEffect } from 'react';
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
import AdminDashboard from './pages/AdminDashboard';
import { authTelegram, getDailyStatus, claimDaily } from './services/api';
import confetti from 'canvas-confetti';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dailyModal, setDailyModal] = useState(false);
  const [dailyClaiming, setDailyClaiming] = useState(false);

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    try {
      const tg = window.Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();
        tg.setHeaderColor('#0a0a1a');
        tg.setBackgroundColor('#0a0a1a');
      }

      const telegramUser = tg?.initDataUnsafe?.user || {
        id: 'test_user',
        first_name: 'مستخدم',
        last_name: 'تجريبي',
        username: 'test',
      };

      const startParam = tg?.initDataUnsafe?.start_param || null;

      const response = await authTelegram(tg?.initData || '', telegramUser, startParam);
      const { token, user: userData } = response.data;

      localStorage.setItem('token', token);
      setUser(userData);

      setTimeout(async () => {
        try {
          const statusRes = await getDailyStatus();
          if (statusRes.data.canClaim) {
            setDailyModal(true);
          }
        } catch (e) {}
      }, 1500);
    } catch (error) {
      console.error('Init error:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePoints = (newPoints) => {
    setUser(prev => ({ ...prev, points: newPoints }));
  };

  const handleClaimDaily = async () => {
    setDailyClaiming(true);
    try {
      const res = await claimDaily();
      updatePoints(res.data.newBalance);
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.5 },
        colors: ['#a855f7', '#ffd700', '#ff006e', '#00d4ff'],
      });
      toast.success(`🎁 حصلت على ${res.data.amount} نقطة! هديتك اليومية`);
      setDailyModal(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'حدث خطأ');
    } finally {
      setDailyClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p style={{ color: 'var(--neon-blue)' }}>جاري التحميل...</p>
      </div>
    );
  }

  return (
    <Router>
      <div className="app">
        <ToastContainer position="top-center" rtl theme="dark" />

        {dailyModal && (
          <div className="daily-modal-overlay">
            <div className="daily-modal">
              <div style={{ fontSize: '64px', textAlign: 'center', marginBottom: '12px' }}>🎁</div>
              <h2 style={{ color: 'var(--neon-gold)', textAlign: 'center', fontSize: '22px', marginBottom: '8px' }}>
                هديتك اليومية جاهزة!
              </h2>
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '14px', marginBottom: '24px' }}>
                احصل على 100 نقطة مجاناً الآن!
              </p>
              <button
                className="glow-btn green"
                onClick={handleClaimDaily}
                disabled={dailyClaiming}
                style={{ marginBottom: '10px' }}
              >
                {dailyClaiming ? '⏳ جاري الاستلام...' : '🎁 استلم هديتك (+100 نقطة)'}
              </button>
              <button
                onClick={() => setDailyModal(false)}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'none',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontFamily: 'Cairo',
                  fontSize: '14px',
                }}
              >
                لاحقاً
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
          <Route path="/admin" element={<AdminDashboard user={user} />} />
        </Routes>

        <nav className="bottom-nav">
          <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
            <span>الرئيسية</span>
          </NavLink>
          <NavLink to="/spin" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/><circle cx="12" cy="12" r="3"/></svg>
            <span>الحظ</span>
          </NavLink>
          <NavLink to="/referral" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
            <span>أصدقاء</span>
          </NavLink>
          <NavLink to="/ads" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3c-1.11 0-2 .89-2 2v12c0 1.1.89 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.11-.9-2-2-2zm0 14H3V5h18v12zm-5-6l-7 4V7z"/></svg>
            <span>إعلانات</span>
          </NavLink>
          <NavLink to="/withdraw" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
            <span>سحب</span>
          </NavLink>
        </nav>
      </div>
    </Router>
  );
}

export default App;
