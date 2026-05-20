import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBalance } from '../services/api';
import { useLang, LANGUAGES } from '../LanguageContext';

function Home({ user, updatePoints }) {
  const { t, lang, setLang } = useLang();
  const [balance, setBalance] = useState(Math.max(0, user?.points || 0));

  useEffect(() => { fetchBalance(); }, []);

  const fetchBalance = async () => {
    try {
      const res = await getBalance();
      const pts = Math.max(0, res.data.points || 0);
      setBalance(pts);
      updatePoints(pts);
    } catch (err) {}
  };

  const starsEquivalent = Math.floor(balance / 1000);

  const actions = [
    { to: '/spin',     icon: '🎡', label: t('spinWheel'),     sub: t('spinSub'),     color: '#EC4899', bg: 'rgba(236,72,153,0.08)',   border: 'rgba(236,72,153,0.2)'   },
    { to: '/daily',    icon: '🎁', label: t('dailyGift'),     sub: t('dailySub'),    color: '#F59E0B', bg: 'rgba(245,158,11,0.08)',   border: 'rgba(245,158,11,0.2)'   },
    { to: '/ads',      icon: '📺', label: t('watchAds'),      sub: t('adsSub'),      color: '#3B82F6', bg: 'rgba(59,130,246,0.08)',   border: 'rgba(59,130,246,0.2)'   },
    { to: '/referral', icon: '👥', label: t('inviteF'),       sub: t('inviteFSub'),  color: '#10B981', bg: 'rgba(16,185,129,0.08)',   border: 'rgba(16,185,129,0.2)'   },
    { to: '/withdraw', icon: '💸', label: t('withdrawStars'), sub: t('withdrawSub'), color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)',   border: 'rgba(139,92,246,0.2)'   },
    { to: '/profile',  icon: '👤', label: t('profileTitle'),  sub: t('profileSub'),  color: '#06B6D4', bg: 'rgba(6,182,212,0.08)',    border: 'rgba(6,182,212,0.2)'    },
  ];

  const langFlag = { ar: '🇸🇦', en: '🇬🇧', ru: '🇷🇺' };
  const nextLang = () => {
    const ls = LANGUAGES.map(l => l.code);
    setLang(ls[(ls.indexOf(lang) + 1) % ls.length]);
  };

  return (
    <div style={{ paddingBottom: '24px', position: 'relative', zIndex: 1 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 0' }}>
        <div>
          <p style={{ fontSize: 10, color: 'rgba(139,92,246,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0, marginBottom: 3 }}>
            {t('greeting')}
          </p>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, background: 'linear-gradient(135deg,#FFD700 0%,#F59E0B 50%,#EF4444 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {user?.firstName || 'مستخدم'} ✨
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {user?.isAdmin && (
            <Link to="/admin" style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: '8px', padding: '6px 10px', color: '#a78bfa', fontSize: '12px', textDecoration: 'none', fontWeight: '700' }}>
              🛡️
            </Link>
          )}
          <button onClick={nextLang} style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 24, padding: '8px 12px', cursor: 'pointer', fontSize: 18, lineHeight: 1, color: '#fff' }}>
            {langFlag[lang] || '🌐'}
          </button>
        </div>
      </div>

      {/* Balance Card — Claude style */}
      <div style={{ margin: '14px 16px 0', borderRadius: 24, padding: '22px 22px 18px', position: 'relative', overflow: 'hidden', background: 'linear-gradient(145deg,#130826 0%,#0b1240 50%,#150b2e 100%)', border: '1px solid rgba(139,92,246,0.28)', boxShadow: '0 8px 40px rgba(139,92,246,0.12),0 2px 8px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.06)' }}>
        <div className="shimmer" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.4 }} />
        <div style={{ position: 'relative' }}>
          <p style={{ fontSize: 9, color: 'rgba(167,139,250,0.65)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 10 }}>
            {t('currentBalance')}
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 46, fontWeight: 900, lineHeight: 1, background: 'linear-gradient(135deg,#FFE44D,#FFB800)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 0 18px rgba(255,200,0,0.35))' }}>
              {balance.toLocaleString()}
            </span>
            <span style={{ fontSize: 14, color: 'rgba(255,215,0,0.4)', fontWeight: 700, letterSpacing: '0.05em' }}>{t('points')}</span>
          </div>
          <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)', margin: '14px 0' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <p style={{ fontSize: 9, color: 'rgba(167,139,250,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>{t('totalEarned')}</p>
              <p style={{ fontSize: 18, fontWeight: 900, color: '#C4B5FD' }}>{(user?.totalEarned || 0).toLocaleString()}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 9, color: 'rgba(167,139,250,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>Telegram Stars</p>
              <p style={{ fontSize: 18, fontWeight: 900, color: '#FFD700' }}>⭐ {starsEquivalent}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Invite Banner */}
      <div style={{ margin: '12px 16px 0' }}>
        <Link to="/referral" style={{ textDecoration: 'none' }}>
          <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.22)', borderRadius: 18, padding: '13px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#C4B5FD' }}>{t('inviteFriends')}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{t('inviteSub')}</div>
            </div>
            <span style={{ fontSize: 26 }}>🎁</span>
          </div>
        </Link>
      </div>

      {/* Quick Actions */}
      <div style={{ padding: '16px 16px 0' }}>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>⚡ {t('earnWays')}</p>
        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, overflow: 'hidden' }}>
          {actions.map((a, i) => (
            <Link key={a.to} to={a.to} style={{ textDecoration: 'none' }}>
              <div style={{ padding: '13px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: i < actions.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', transition: 'background 0.15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{a.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{a.label}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, color: a.color, background: a.bg, border: `1px solid ${a.border}`, borderRadius: 8, padding: '3px 9px' }}>
                  {a.sub}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Home;
