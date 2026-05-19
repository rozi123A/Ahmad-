import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getBalance } from '../services/api';

function Home({ user, updatePoints }) {
  const [balance, setBalance] = useState(user?.points || 0);
  const navigate = useNavigate();

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

  const handleInvite = () => {
    navigate('/referral');
  };

  return (
    <div>
      <div className="header">
        <div className="user-info">
          <img
            src={user?.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.firstName || 'U')}&background=0a0a1a&color=00d4ff`}
            alt="avatar"
            className="user-avatar"
          />
          <div>
            <div className="user-name">مرحباً، {user?.firstName} 👋</div>
            <div className="user-points">💰 {balance.toLocaleString()} pts</div>
          </div>
        </div>
        {user?.isAdmin && (
          <Link to="/admin" style={{ color: 'var(--neon-pink)', fontSize: '12px', textDecoration: 'none' }}>
            🛡️ لوحة التحكم
          </Link>
        )}
      </div>

      <div className="points-display" style={{ margin: '24px 0 16px' }}>
        {balance.toLocaleString()} pts
      </div>

      <div style={{ padding: '0 16px' }}>
        <div
          onClick={handleInvite}
          style={{
            background: 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(0,212,255,0.2))',
            border: '1px solid rgba(168,85,247,0.4)',
            borderRadius: '16px',
            padding: '16px 20px',
            marginBottom: '16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <p style={{ color: 'var(--neon-purple)', fontWeight: '700', fontSize: '15px', marginBottom: '4px' }}>
              👥 ادعُ أصدقاءك
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              اربح 100 نقطة لكل صديق يسجّل عبر رابطك
            </p>
          </div>
          <div style={{ fontSize: '32px' }}>🎁</div>
        </div>

        <div className="stats-grid">
          <Link to="/spin" style={{ textDecoration: 'none' }}>
            <div className="stat-card" style={{ cursor: 'pointer' }}>
              <div style={{ fontSize: '32px' }}>🎰</div>
              <div className="stat-label">عجلة الحظ</div>
            </div>
          </Link>
          <Link to="/daily" style={{ textDecoration: 'none' }}>
            <div className="stat-card" style={{ cursor: 'pointer' }}>
              <div style={{ fontSize: '32px' }}>🎁</div>
              <div className="stat-label">هدية يومية</div>
            </div>
          </Link>
          <Link to="/ads" style={{ textDecoration: 'none' }}>
            <div className="stat-card" style={{ cursor: 'pointer' }}>
              <div style={{ fontSize: '32px' }}>📺</div>
              <div className="stat-label">إعلانات</div>
            </div>
          </Link>
          <Link to="/withdraw" style={{ textDecoration: 'none' }}>
            <div className="stat-card" style={{ cursor: 'pointer' }}>
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
