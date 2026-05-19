import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBalance } from '../services/api';

function Home({ user, updatePoints }) {
  const [balance, setBalance] = useState(user?.points || 0);

  useEffect(() => {
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    try {
      const res = await getBalance();
      setBalance(res.data.points);
      updatePoints(res.data.points);
    } catch (err) {}
  };

  return (
    <div>
      <div className="header">
        <div className="user-info">
          <img 
            src={user?.photoUrl || `https://ui-avatars.com/api/?name=${user?.firstName}&background=0a0a1a&color=00d4ff`} 
            alt="avatar" 
            className="user-avatar" 
          />
          <div>
            <div className="user-name">مرحباً، {user?.firstName} 👋</div>
            <div className="user-points">💰 {balance} pts</div>
          </div>
        </div>
        {user?.isAdmin && (
          <Link to="/admin" style={{ color: 'var(--neon-pink)', fontSize: '12px', textDecoration: 'none' }}>
            لوحة التحكم
          </Link>
        )}
      </div>

      <div className="points-display" style={{ margin: '30px 0' }}>
        {balance.toLocaleString()} pts
      </div>

      <div style={{ padding: '0 16px' }}>
        <div className="neon-card" style={{ textAlign: 'center' }}>
          <h3 style={{ color: 'var(--neon-blue)', marginBottom: '8px' }}>🎰 اربح نقاط يومياً</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            أدر العجلة، اجمع الهدايا، وشاهد الإعلانات لكسب النقاط!
          </p>
        </div>

        <div className="stats-grid" style={{ marginTop: '16px' }}>
          <Link to="/spin" style={{ textDecoration: 'none' }}>
            <div className="stat-card">
              <div style={{ fontSize: '32px' }}>🎰</div>
              <div className="stat-label">عجلة الحظ</div>
            </div>
          </Link>
          <Link to="/daily" style={{ textDecoration: 'none' }}>
            <div className="stat-card">
              <div style={{ fontSize: '32px' }}>🎁</div>
              <div className="stat-label">هدية يومية</div>
            </div>
          </Link>
          <Link to="/ads" style={{ textDecoration: 'none' }}>
            <div className="stat-card">
              <div style={{ fontSize: '32px' }}>📺</div>
              <div className="stat-label">إعلانات</div>
            </div>
          </Link>
          <Link to="/withdraw" style={{ textDecoration: 'none' }}>
            <div className="stat-card">
              <div style={{ fontSize: '32px' }}>⭐</div>
              <div className="stat-label">سحب Stars</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Home;
