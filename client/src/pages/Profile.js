import React, { useState, useEffect } from 'react';
import { getProfile, getNotifications, markAllRead } from '../services/api';

function Profile({ user }) {
  const [profile, setProfile] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => { fetchProfile(); fetchNotifications(); }, []);

  const fetchProfile = async () => {
    try { const res = await getProfile(); setProfile(res.data); } catch (err) {}
  };

  const fetchNotifications = async () => {
    try { const res = await getNotifications(); setNotifications(res.data.notifications || []); setUnread(res.data.unreadCount || 0); } catch (err) {}
  };

  const handleMarkRead = async () => {
    try { await markAllRead(); setUnread(0); setNotifications(prev => prev.map(n => ({ ...n, read: true }))); } catch (err) {}
  };

  if (!profile) return <div className="loading-screen"><div className="spinner" /></div>;

  const statItems = [
    { label: 'الرصيد الحالي', value: profile.points.toLocaleString(), color: '#f59e0b', icon: '💰' },
    { label: 'إجمالي الأرباح', value: profile.totalEarned.toLocaleString(), color: '#10b981', icon: '📈' },
    { label: 'إجمالي السحب', value: (profile.totalWithdrawn || 0).toLocaleString(), color: '#8b5cf6', icon: '💸' },
    { label: 'تاريخ الانضمام', value: new Date(profile.createdAt).toLocaleDateString('ar'), color: '#3b82f6', icon: '📅' },
  ];

  return (
    <div style={{ padding: '0 0 24px', position: 'relative', zIndex: 1 }}>
      {/* Profile Card */}
      <div style={{ margin: '24px 16px 16px' }}>
        <div className="balance-card">
          <img
            src={profile.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.firstName)}&background=8b5cf6&color=fff&size=100`}
            alt="avatar"
            style={{ width: '72px', height: '72px', borderRadius: '50%', border: '3px solid rgba(139,92,246,0.5)', boxShadow: '0 0 20px rgba(139,92,246,0.3)', marginBottom: '12px' }}
          />
          <div style={{ fontSize: '20px', fontWeight: '900' }}>{profile.firstName} {profile.lastName}</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '4px' }}>
            {profile.username ? `@${profile.username}` : '• بدون يوزر •'}
          </div>
          {profile.isAdmin && (
            <div style={{ marginTop: '10px', display: 'inline-block', background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: '8px', padding: '4px 12px', fontSize: '12px', color: '#a78bfa', fontWeight: '700' }}>
              🛡️ مدير
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ margin: '0 16px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {statItems.map((s, i) => (
            <div key={i} className="stat-card" style={{ borderColor: `${s.color}22` }}>
              <div style={{ fontSize: '20px', marginBottom: '4px' }}>{s.icon}</div>
              <div className="stat-value" style={{ color: s.color, fontSize: '18px' }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Notifications */}
      <div style={{ margin: '0 16px' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ fontSize: '18px' }}>🔔</div>
              <div style={{ fontSize: '16px', fontWeight: '700' }}>
                الإشعارات
                {unread > 0 && <span style={{ marginRight: '6px', background: '#ef4444', borderRadius: '50%', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '900' }}>{unread}</span>}
              </div>
            </div>
            {unread > 0 && (
              <button onClick={handleMarkRead} style={{ background: 'none', border: 'none', color: '#8b5cf6', cursor: 'pointer', fontSize: '12px', fontFamily: 'Cairo' }}>
                قراءة الكل ✓
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.3)', fontSize: '14px' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔕</div>
              لا توجد إشعارات
            </div>
          ) : (
            notifications.slice(0, 10).map((n, i) => (
              <div key={i} style={{
                padding: '12px 0',
                borderBottom: i < Math.min(notifications.length, 10) - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                opacity: n.read ? 0.5 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  {!n.read && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#8b5cf6', marginTop: '5px', flexShrink: 0 }} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: n.read ? '500' : '700' }}>{n.title}</div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{n.message}</div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '4px' }}>
                      {new Date(n.createdAt).toLocaleString('ar')}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default Profile;
