import React, { useEffect, useState } from 'react';
import { getNotifications, markAllRead } from '../services/api';

const TYPE_ICON = {
  admin_message: '💬',
  referral: '🎉',
  withdraw_approved: '✅',
  withdraw_rejected: '❌',
  broadcast: '📢',
  daily: '🎁',
  default: '🔔',
};

export default function Notifications({ onMarkRead }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAndMarkRead();
  }, []);

  const fetchAndMarkRead = async () => {
    try {
      const res = await getNotifications();
      setNotifications(res.data.notifications || []);
      // Mark all as read
      if ((res.data.unreadCount || 0) > 0) {
        await markAllRead();
        if (onMarkRead) onMarkRead();
      }
    } catch (e) {}
    finally { setLoading(false); }
  };

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'الآن';
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `منذ ${hrs} ساعة`;
    const days = Math.floor(hrs / 24);
    return `منذ ${days} يوم`;
  };

  return (
    <div style={{ padding: '20px 16px 100px', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 26 }}>🔔</span>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, background: 'linear-gradient(135deg,#a78bfa,#60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          الإشعارات
        </h1>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, border: '3px solid rgba(139,92,246,0.3)', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : notifications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🔕</div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, fontWeight: 700 }}>لا توجد إشعارات بعد</p>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, marginTop: 8 }}>ستظهر هنا الإشعارات من الإدارة والمكافآت</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {notifications.map((notif, i) => (
            <div key={notif._id || i} style={{
              background: notif.read ? 'rgba(255,255,255,0.03)' : 'rgba(139,92,246,0.08)',
              border: '1px solid ' + (notif.read ? 'rgba(255,255,255,0.06)' : 'rgba(139,92,246,0.3)'),
              borderRadius: 18,
              padding: '14px 16px',
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              position: 'relative',
              transition: 'all 0.3s',
            }}>
              {!notif.read && (
                <div style={{
                  position: 'absolute', top: 14, left: 14,
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#8b5cf6',
                  boxShadow: '0 0 8px rgba(139,92,246,0.8)',
                }} />
              )}
              <div style={{
                width: 42, height: 42, borderRadius: 14, flexShrink: 0,
                background: notif.read ? 'rgba(255,255,255,0.05)' : 'rgba(139,92,246,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20,
              }}>
                {TYPE_ICON[notif.type] || TYPE_ICON.default}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: notif.read ? 'rgba(255,255,255,0.7)' : '#fff', marginBottom: 4, lineHeight: 1.3 }}>
                  {notif.title}
                </p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5, marginBottom: 6, whiteSpace: 'pre-wrap' }}>
                  {notif.message}
                </p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontWeight: 600 }}>
                  {timeAgo(notif.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
