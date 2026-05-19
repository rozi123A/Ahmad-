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

  const actions = [
    { to: '/spin', icon: '🎰', label: 'عجلة الحظ', sub: 'اربح حتى 500 نقطة', color: '#8b5cf6' },
    { to: '/daily', icon: '🎁', label: 'هدية يومية', sub: '+100 نقطة مجانية', color: '#f59e0b' },
    { to: '/ads', icon: '📺', label: 'مشاهدة إعلانات', sub: '+10 نقطة لكل إعلان', color: '#3b82f6' },
    { to: '/referral', icon: '👥', label: 'دعوة أصدقاء', sub: '+100 نقطة لكل صديق', color: '#10b981' },
    { to: '/withdraw', icon: '⭐', label: 'سحب Stars', sub: 'استبدل نقاطك', color: '#ec4899' },
    { to: '/profile', icon: '👤', label: 'الملف الشخصي', sub: 'الإحصائيات والإشعارات', color: '#06b6d4' },
  ];

  return (
    <div style={{ paddingBottom: '20px', position: 'relative', zIndex: 1 }}>
      {/* Header */}
      <div className="header">
        <div className="user-info">
          <img
            src={user?.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.firstName || 'U')}&background=8b5cf6&color=fff&size=80`}
            alt="avatar"
            className="user-avatar"
          />
          <div>
            <div className="user-name">مرحباً، {user?.firstName || 'مستخدم'} 👋</div>
            <div className="user-points">⭐ {balance.toLocaleString()} نقطة</div>
          </div>
        </div>
        {user?.isAdmin && (
          <Link to="/admin" style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: '8px', padding: '6px 12px', color: '#a78bfa', fontSize: '12px', textDecoration: 'none', fontWeight: '700' }}>
            🛡️ أدمن
          </Link>
        )}
      </div>

      {/* Balance Card */}
      <div style={{ margin: '16px', position: 'relative' }}>
        <div className="balance-card">
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', letterSpacing: '1px' }}>
            رصيدك الحالي
          </div>
          <div className="balance-amount">{balance.toLocaleString()}</div>
          <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>نقطة</div>
          <div className="balance-stars">≈ {Math.floor(balance / 1000)} ⭐ Stars</div>

          {/* Invite button inside card */}
          <Link to="/referral" style={{ textDecoration: 'none' }}>
            <div style={{
              marginTop: '20px',
              background: 'rgba(139,92,246,0.15)',
              border: '1px solid rgba(139,92,246,0.3)',
              borderRadius: '12px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#a78bfa' }}>ادعُ أصدقاءك واربح</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>+100 نقطة لكل صديق • +50 نقطة ترحيب</div>
              </div>
              <div style={{ fontSize: '24px' }}>🎁</div>
            </div>
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px', fontWeight: '600', letterSpacing: '0.5px' }}>
          الطرق السريعة للربح
        </div>
        <div className="quick-actions">
          {actions.map((a) => (
            <Link key={a.to} to={a.to} style={{ textDecoration: 'none' }}>
              <div className="quick-card">
                <div className="quick-card-icon">{a.icon}</div>
                <div className="quick-card-label">{a.label}</div>
                <div className="quick-card-sub" style={{ color: a.color, opacity: 0.8 }}>{a.sub}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Home;
