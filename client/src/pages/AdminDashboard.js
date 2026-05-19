import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { 
  getAdminDashboard, getAdminUsers, toggleBan, updateBalance,
  getAdminWithdrawals, processWithdrawal, sendBroadcast, sendAdminMessage
} from '../services/api';

function AdminDashboard({ user }) {
  const [tab, setTab] = useState('dashboard');
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [search, setSearch] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [msgTo, setMsgTo] = useState('');
  const [msgText, setMsgText] = useState('');

  useEffect(() => {
    if (!user?.isAdmin) return;
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await getAdminDashboard();
      setStats(res.data);
    } catch (err) {}
  };

  const fetchUsers = async () => {
    try {
      const res = await getAdminUsers(search);
      setUsers(res.data.users);
    } catch (err) {}
  };

  const fetchWithdrawals = async (status = '') => {
    try {
      const res = await getAdminWithdrawals(status);
      setWithdrawals(res.data.withdrawals);
    } catch (err) {}
  };

  const handleBan = async (userId) => {
    try {
      const res = await toggleBan(userId);
      toast.success(res.data.isBanned ? 'تم حظر المستخدم' : 'تم فك الحظر');
      fetchUsers();
    } catch (err) { toast.error('حدث خطأ'); }
  };

  const handleBalance = async (userId) => {
    const amount = prompt('أدخل المبلغ (موجب للإضافة، سالب للخصم):');
    if (!amount) return;
    try {
      await updateBalance(userId, parseInt(amount), 'add');
      toast.success('تم تحديث الرصيد');
      fetchUsers();
    } catch (err) { toast.error('حدث خطأ'); }
  };

  const handleProcess = async (id, action) => {
    const note = action === 'reject' ? prompt('سبب الرفض:') : '';
    try {
      await processWithdrawal(id, action, note);
      toast.success(action === 'approve' ? '✅ تم القبول' : '❌ تم الرفض');
      fetchWithdrawals('pending');
    } catch (err) { toast.error('حدث خطأ'); }
  };

  const handleBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    try {
      const res = await sendBroadcast(broadcastMsg);
      toast.success(`تم الإرسال لـ ${res.data.sent} مستخدم`);
      setBroadcastMsg('');
    } catch (err) { toast.error('حدث خطأ'); }
  };

  const handleSendMsg = async () => {
    if (!msgTo || !msgText) return;
    try {
      await sendAdminMessage(msgTo, msgText);
      toast.success('تم إرسال الرسالة');
      setMsgText('');
    } catch (err) { toast.error('حدث خطأ'); }
  };

  if (!user?.isAdmin) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--neon-pink)' }}>⛔ غير مصرح</div>;
  }

  const tabs = [
    { id: 'dashboard', label: '📊 إحصائيات' },
    { id: 'users', label: '👥 المستخدمين' },
    { id: 'withdrawals', label: '💰 السحوبات' },
    { id: 'broadcast', label: '📢 بث' },
    { id: 'message', label: '💬 رسالة' },
  ];

  return (
    <div className="admin-container">
      <h1 className="page-title">🛡️ لوحة التحكم</h1>

      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', marginBottom: '16px', paddingBottom: '8px' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); if (t.id === 'users') fetchUsers(); if (t.id === 'withdrawals') fetchWithdrawals('pending'); }}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: tab === t.id ? '1px solid var(--neon-blue)' : '1px solid rgba(0,212,255,0.2)',
              background: tab === t.id ? 'rgba(0,212,255,0.1)' : 'var(--bg-card)',
              color: tab === t.id ? 'var(--neon-blue)' : 'var(--text-secondary)',
              fontSize: '12px',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              fontFamily: 'Cairo',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {tab === 'dashboard' && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.totalUsers || 0}</div>
            <div className="stat-label">إجمالي المستخدمين</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.newUsersToday || 0}</div>
            <div className="stat-label">مستخدمين اليوم</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.pendingWithdrawals || 0}</div>
            <div className="stat-label">سحوبات معلقة</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalStarsPaid || 0}</div>
            <div className="stat-label">Stars مدفوعة</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.todayAdsWatched || 0}</div>
            <div className="stat-label">إعلانات اليوم</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalWithdrawals || 0}</div>
            <div className="stat-label">إجمالي السحوبات</div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {tab === 'users' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث باسم أو ID..."
              style={{ flex: 1, padding: '10px', background: 'var(--bg-primary)', border: '1px solid rgba(0,212,255,0.3)', borderRadius: '8px', color: 'white', fontFamily: 'Cairo' }}
            />
            <button className="glow-btn" onClick={fetchUsers} style={{ width: 'auto', padding: '10px 16px' }}>🔍</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>المستخدم</th>
                  <th>الرصيد</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u._id}>
                    <td>
                      <div>{u.firstName} {u.lastName}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>@{u.username || u.telegramId}</div>
                    </td>
                    <td style={{ color: 'var(--neon-gold)' }}>{u.points}</td>
                    <td>
                      <span className={`badge ${u.isBanned ? 'rejected' : 'approved'}`}>
                        {u.isBanned ? 'محظور' : 'نشط'}
                      </span>
                    </td>
                    <td>
                      <button onClick={() => handleBan(u._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
                        {u.isBanned ? '✅' : '🚫'}
                      </button>
                      <button onClick={() => handleBalance(u._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', marginRight: '8px' }}>
                        💰
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Withdrawals Tab */}
      {tab === 'withdrawals' && (
        <div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            {['pending', 'approved', 'rejected'].map(s => (
              <button key={s} onClick={() => fetchWithdrawals(s)} style={{
                padding: '6px 12px', borderRadius: '6px', border: 'none',
                background: 'var(--bg-card)', color: 'var(--text-secondary)',
                cursor: 'pointer', fontSize: '12px', fontFamily: 'Cairo'
              }}>
                {s === 'pending' ? '⏳ معلق' : s === 'approved' ? '✅ مقبول' : '❌ مرفوض'}
              </button>
            ))}
          </div>
          {withdrawals.map(w => (
            <div key={w._id} className="neon-card" style={{ margin: '8px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: '14px' }}>@{w.username || w.telegramId}</p>
                  <p style={{ fontSize: '12px', color: 'var(--neon-gold)' }}>{w.amount} pts → ⭐{w.stars} Stars</p>
                  <p style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{new Date(w.createdAt).toLocaleString('ar')}</p>
                </div>
                {w.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button onClick={() => handleProcess(w._id, 'approve')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>✅</button>
                    <button onClick={() => handleProcess(w._id, 'reject')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>❌</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Broadcast Tab */}
      {tab === 'broadcast' && (
        <div className="neon-card">
          <h3 style={{ color: 'var(--neon-blue)', marginBottom: '12px' }}>📢 إرسال بث لجميع المستخدمين</h3>
          <textarea
            value={broadcastMsg}
            onChange={(e) => setBroadcastMsg(e.target.value)}
            placeholder="اكتب رسالة البث..."
            rows={4}
            style={{ width: '100%', padding: '12px', background: 'var(--bg-primary)', border: '1px solid rgba(0,212,255,0.3)', borderRadius: '8px', color: 'white', fontFamily: 'Cairo', resize: 'vertical' }}
          />
          <button className="glow-btn" onClick={handleBroadcast} style={{ marginTop: '12px' }}>📤 إرسال للجميع</button>
        </div>
      )}

      {/* Message Tab */}
      {tab === 'message' && (
        <div className="neon-card">
          <h3 style={{ color: 'var(--neon-blue)', marginBottom: '12px' }}>💬 إرسال رسالة لمستخدم</h3>
          <input
            value={msgTo}
            onChange={(e) => setMsgTo(e.target.value)}
            placeholder="Telegram ID المستخدم"
            style={{ width: '100%', padding: '10px', marginBottom: '8px', background: 'var(--bg-primary)', border: '1px solid rgba(0,212,255,0.3)', borderRadius: '8px', color: 'white', fontFamily: 'Cairo' }}
          />
          <textarea
            value={msgText}
            onChange={(e) => setMsgText(e.target.value)}
            placeholder="نص الرسالة..."
            rows={3}
            style={{ width: '100%', padding: '12px', background: 'var(--bg-primary)', border: '1px solid rgba(0,212,255,0.3)', borderRadius: '8px', color: 'white', fontFamily: 'Cairo', resize: 'vertical' }}
          />
          <button className="glow-btn green" onClick={handleSendMsg} style={{ marginTop: '12px' }}>📤 إرسال</button>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
