import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles/App.css';

import Home from './pages/Home';
import Spin from './pages/Spin';
import DailyGift from './pages/DailyGift';
import WatchAds from './pages/WatchAds';
import Withdraw from './pages/Withdraw';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';
import { authTelegram } from './services/api';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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

      const response = await authTelegram(tg?.initData || '', telegramUser);
      const { token, user: userData } = response.data;

      localStorage.setItem('token', token);
      setUser(userData);
    } catch (error) {
      console.error('Init error:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePoints = (newPoints) => {
    setUser(prev => ({ ...prev, points: newPoints }));
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
        
        <Routes>
          <Route path="/" element={<Home user={user} updatePoints={updatePoints} />} />
          <Route path="/spin" element={<Spin user={user} updatePoints={updatePoints} />} />
          <Route path="/daily" element={<DailyGift user={user} updatePoints={updatePoints} />} />
          <Route path="/ads" element={<WatchAds user={user} updatePoints={updatePoints} />} />
          <Route path="/withdraw" element={<Withdraw user={user} />} />
          <Route path="/profile" element={<Profile user={user} />} />
          <Route path="/admin" element={<AdminDashboard user={user} />} />
        </Routes>

        <nav className="bottom-nav">
          <NavLink to="/" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
            <span>الرئيسية</span>
          </NavLink>
          <NavLink to="/spin" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/><circle cx="12" cy="12" r="3"/></svg>
            <span>الحظ</span>
          </NavLink>
          <NavLink to="/daily" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2z"/></svg>
            <span>الهدية</span>
          </NavLink>
          <NavLink to="/ads" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3c-1.11 0-2 .89-2 2v12c0 1.1.89 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.11-.9-2-2-2zm0 14H3V5h18v12zm-5-6l-7 4V7z"/></svg>
            <span>إعلانات</span>
          </NavLink>
          <NavLink to="/withdraw" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
            <span>سحب</span>
          </NavLink>
        </nav>
      </div>
    </Router>
  );
}

export default App;
