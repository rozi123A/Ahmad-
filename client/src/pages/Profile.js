import React, { useState, useEffect } from 'react';
import { getProfile, getNotifications, markAllRead } from '../services/api';
import { useLang, LANGUAGES } from '../LanguageContext';

const TYPE_ICONS  = { broadcast: '📢', admin_message: '💬', referral: '👥', withdraw_approved: '✅', withdraw_rejected: '❌', bonus: '🎁' };
const TYPE_COLORS = { broadcast: '#F59E0B', admin_message: '#8B5CF6', referral: '#3B82F6', withdraw_approved: '#10B981', withdraw_rejected: '#EF4444', bonus: '#EC4899' };

function Profile({ user }) {
  const { t, lang, setLang } = useLang();
  const [profile,       setProfile]       = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unread,        setUnread]        = useState(0);
  const [tab,           setTab]           = useState('stats');

  useEffect(() => { fetchProfile(); fetchNotifications(); }, []);

  const fetchProfile       = async () => { try { const r = await getProfile();       setProfile(r.data); } catch {} };
  const fetchNotifications = async () => { try { const r = await getNotifications(); setNotifications(r.data.notifications || []); setUnread(r.data.unreadCount || 0); } catch {} };
  const handleMarkRead     = async () => { try { await markAllRead(); setUnread(0); setNotifications(prev => prev.map(n => ({ ...n, read: true }))); } catch {} };

  if (!profile) return <div className="loading-screen"><div className="spinner" /></div>;

  const statItems = [
    { label: t('currentBal'),     value: Math.max(0, profile.points).toLocaleString(),         color: '#F59E0B', icon: '💰' },
    { label: t('totalEarned'),    value: (profile.totalEarned || 0).toLocaleString(),           color: '#10B981', icon: '📈' },
    { label: t('totalWithdrawn'), value: (profile.totalWithdrawn || 0).toLocaleString(),        color: '#8B5CF6', icon: '💸' },
    { label: t('joinDate'),       value: new Date(profile.createdAt).toLocaleDateString(),      color: '#3B82F6', icon: '📅' },
  ];

  return (
    <div style={{ paddingBottom: 28, position: 'relative', zIndex: 1 }}>

      {/* Avatar Card */}
      <div style={{ margin: '20px 16px 14px', background: 'linear-gradient(145deg,#130826,#0b1240)', border: '1px solid rgba(139,92,246,0.28)', borderRadius: 24, padding: '24px 20px', textAlign: 'center', boxShadow: '0 8px 32px rgba(139,92,246,0.1)' }}>
        <img
          src={profile.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.firstName)}&background=8b5cf6&color=fff&size=100`}
          alt="avatar"
          style={{ width: 76, height: 76, borderRadius: '50%', border: '3px solid rgba(139,92,246,0.5)', boxShadow: '0 0 24px rgba(139,92,246,0.35)', marginBottom: 12 }}
        />
        <div style={{ fontSize: 20, fontWeight: 900 }}>{profile.firstName} {profile.lastName}</div>
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 4 }}>{profile.username ? `@${profile.username}` : '—'}</div>
        {profile.isAdmin && (
          <div style={{ marginTop: 10, display: 'inline-block', background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 8, padding: '4px 14px', fontSize: 12, color: '#a78bfa', fontWeight: 700 }}>🛡️ Admin</div>
        )}
      </div>

      {/* Language Switcher */}
      <div style={{ margin: '0 16px 14px' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '14px 16px' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>🌐 {t('language')}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {LANGUAGES.map(l => (
              <button key={l.code} onClick={() => setLang(l.code)} style={{
                padding: '10px 6px', borderRadius: 12, cursor: 'pointer', fontFamily: 'Cairo, sans-serif', fontSize: 13, transition: 'all 0.2s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                background: lang === l.code ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${lang === l.code ? 'rgba(139,92,246,0.6)' : 'rgba(255,255,255,0.08)'}`,
                color: lang === l.code ? '#a78bfa' : 'rgba(255,255,255,0.5)',
                fontWeight: lang === l.code ? 700 : 400,
              }}>
                <span style={{ fontSize: 20 }}>{l.flag}</span>
                <span>{l.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div style={{ margin: '0 16px 14px', display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 4 }}>
        {[['stats', '📊 ' + t('stats')], ['notif', `🔔 ${t('notifications')}${unread > 0 ? ` (${unread})` : ''}`]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'Cairo, sans-serif', transition: 'all 0.2s',
            background: tab === id ? 'rgba(139,92,246,0.25)' : 'transparent',
            color: tab === id ? '#a78bfa' : 'rgba(255,255,255,0.35)',
            boxShadow: tab === id ? '0 2px 12px rgba(139,92,246,0.2)' : 'none',
          }}>{label}</button>
        ))}
      </div>

      {/* Stats Tab */}
      {tab === 'stats' && (
        <div style={{ margin: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {statItems.map((s, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${s.color}22`, borderRadius: 18, padding: '16px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: s.color, marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Notifications Tab */}
      {tab === 'notif' && (
        <div style={{ margin: '0 16px' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.6)' }}>
                🔔 {t('notifications')}
                {unread > 0 && <span style={{ marginRight: 8, background: '#EF4444', borderRadius: '50%', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900 }}>{unread}</span>}
              </span>
              {unread > 0 && (
                <button onClick={handleMarkRead} style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, color: '#a78bfa', cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: '4px 10px', fontFamily: 'Cairo, sans-serif' }}>
                  {t('markRead')}
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 20px', color: 'rgba(255,255,255,0.25)' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🔕</div>
                <p style={{ fontSize: 13 }}>{t('noNotif')}</p>
              </div>
            ) : (
              <div style={{ padding: '4px 0' }}>
                {notifications.slice(0, 20).map((n, i) => {
                  const icon  = TYPE_ICONS[n.type]  || '📌';
                  const color = TYPE_COLORS[n.type] || '#8B5CF6';
                  return (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: '13px 16px', borderBottom: i < Math.min(notifications.length, 20) - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', opacity: n.read ? 0.5 : 1, background: !n.read ? 'rgba(139,92,246,0.04)' : 'transparent' }}>
                      <div style={{ width: 38, height: 38, borderRadius: 12, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>
                        {icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          {!n.read && <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />}
                          <span style={{ fontSize: 13, fontWeight: n.read ? 600 : 800, color: '#E2E8F0' }}>{n.title}</span>
                        </div>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '0 0 4px', lineHeight: 1.5 }}>{n.message}</p>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', margin: 0 }}>{new Date(n.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;
