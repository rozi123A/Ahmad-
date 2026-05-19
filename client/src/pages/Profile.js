import React, { useState, useEffect } from 'react';
import { getProfile, getNotifications, markAllRead } from '../services/api';

function Profile({ user }) {
  const [profile, setProfile] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    fetchProfile();
    fetchNotifications();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await getProfile();
      setProfile(res.data);
    } catch (err) {}
  };

  const fetchNotifications = async () => {
    try {
      const res = await getNotifications();
      setNotifications(res.data.notifications);
      setUnread(res.data.unreadCount);
    } catch (err) {}
  };

  const handleMarkRead = async () => {
    try {
      await markAllRead();
      setUnread(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {}
  };

  if (!profile) {
    return <div className="loading-screen"><div className="spinner"></div></div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1 className="page-title">👤 الملف الشخصي</h1>

      <div className="neon-card" style={{ textAlign: 'center' }}>
        <img 
          src={profile.photoUrl || `https://ui-avatars.com/api/?name=${profile.firstName}&background=1a1a3e&color=00d4ff&size=100`}
          alt="avatar"
          style={{ width: '80px', height: '80px', borderRadius: '50%', border: '3px solid var(--neon-blue)', boxShadow: 'var(--glow-blue)' }}
        />
        <h2 style={{ marginTop: '12px', fontSize: '20px' }}>{profile.firstName} {profile.lastName}</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>@{profile.username || 'بدون يوزر'}</p>
      </div>

      <div className="stats-grid" style={{ marginTop: '16px' }}>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--neon-gold)' }}>{profile.points.toLocaleString()}</div>
          <div className="stat-label">الرصيد</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--neon-green)' }}>{profile.totalEarned.toLocaleString()}</div>
          <div className="stat-label">إجمالي الأرباح</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--neon-purple)' }}>{profile.totalWithdrawn.toLocaleString()}</div>
          <div className="stat-label">إجمالي السحب</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--neon-blue)' }}>
            {new Date(profile.createdAt).toLocaleDateString('ar')}
          </div>
          <div className="stat-label">تاريخ الانضمام</div>
        </div>
      </div>

      {/* Notifications */}
      <div className="neon-card" style={{ marginTop: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ color: 'var(--neon-blue)', fontSize: '16px' }}>
            🔔 الإشعارات {unread > 0 && <span style={{ color: 'var(--neon-pink)' }}>({unread})</span>}
          </h3>
          {unread > 0 && (
            <button onClick={handleMarkRead} style={{ background: 'none', border: 'none', color: 'var(--neon-blue)', cursor: 'pointer', fontSize: '12px' }}>
              تحديد الكل كمقروء
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center' }}>لا توجد إشعارات</p>
        ) : (
          notifications.slice(0, 10).map((n, i) => (
            <div key={i} style={{ 
              padding: '10px 0', 
              borderBottom: i < Math.min(notifications.length, 10) - 1 ? '1px solid rgba(0,212,255,0.1)' : 'none',
              opacity: n.read ? 0.6 : 1,
            }}>
              <p style={{ fontSize: '13px', fontWeight: n.read ? '400' : '700' }}>{n.title}</p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{n.message}</p>
              <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {new Date(n.createdAt).toLocaleString('ar')}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Profile;
