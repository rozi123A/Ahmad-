import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBalance } from '../services/api';
import { useLang } from '../LanguageContext';

function Home({ user, updatePoints }) {
  const { t } = useLang();
  const [balance, setBalance] = useState(user?.points || 0);

  useEffect(() => { fetchBalance(); }, []);

  const fetchBalance = async () => {
    try { const res = await getBalance(); setBalance(res.data.points); updatePoints(res.data.points); } catch (err) {}
  };

  const actions = [
    { to: '/spin', icon: '🎰', label: t('spinWheel'), sub: t('spinSub'), color: '#8b5cf6' },
    { to: '/daily', icon: '🎁', label: t('dailyGift'), sub: t('dailySub'), color: '#f59e0b' },
    { to: '/ads', icon: '📺', label: t('watchAds'), sub: t('adsSub'), color: '#3b82f6' },
    { to: '/referral', icon: '👥', label: t('inviteF'), sub: t('inviteFSub'), color: '#10b981' },
    { to: '/withdraw', icon: '⭐', label: t('withdrawStars'), sub: t('withdrawSub'), color: '#ec4899' },
    { to: '/profile', icon: '👤', label: t('profileTitle'), sub: t('profileSub'), color: '#06b6d4' },
  ];

  return (
    <div style={{ paddingBottom: '20px', position: 'relative', zIndex: 1 }}>
      <div className="header">
        <div className="user-info">
          <img src={user?.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.firstName || 'U')}&background=8b5cf6&color=fff&size=80`} alt="avatar" className="user-avatar" />
          <div>
            <div className="user-name">{t('greeting')}، {user?.firstName || 'مستخدم'} 👋</div>
            <div className="user-points">⭐ {balance.toLocaleString()} {t('points')}</div>
          </div>
        </div>
        {user?.isAdmin && (
          <Link to="/admin" style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: '8px', padding: '6px 12px', color: '#a78bfa', fontSize: '12px', textDecoration: 'none', fontWeight: '700' }}>
            🛡️ {t('admin')}
          </Link>
        )}
      </div>

      <div style={{ margin: '16px', position: 'relative' }}>
        <div className="balance-card">
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>{t('currentBalance')}</div>
          <div className="balance-amount">{balance.toLocaleString()}</div>
          <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>{t('points')}</div>
          <div className="balance-stars">≈ {Math.floor(balance / 1000)} ⭐ Stars</div>
          <Link to="/referral" style={{ textDecoration: 'none' }}>
            <div style={{ marginTop: '20px', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#a78bfa' }}>{t('inviteFriends')}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{t('inviteSub')}</div>
              </div>
              <div style={{ fontSize: '24px' }}>🎁</div>
            </div>
          </Link>
        </div>
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px', fontWeight: '600' }}>{t('earnWays')}</div>
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
