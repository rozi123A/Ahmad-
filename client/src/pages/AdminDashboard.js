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
  const [withdrawFilter, setWithdrawFilter] = useState('pending');

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
    } catch (err) { toast.error('حدث خطأ في تحميل المستخدمين'); }
  };

  const fetchWithdrawals = async (status = 'pending') => {
    setWithdrawFilter(status);
    try {
      const res = await getAdminWithdrawals(status);
      setWithdrawals(res.data.withdrawals);
    } catch (err) { toast.error('حدث خطأ في تحميل السحوبات'); }
  };

  const handleBan = async (userId, isBanned) => {
    if (!window.confirm(isBanned ? 'هل تريد فك حظر هذا المستخدم؟' : 'هل تريد حظر هذا المستخدم؟')) return;
    try {
      const res = await toggleBan(userId);
      toast.success(res.data.isBanned ? '🚫 تم حظر المستخدم' : '✅ تم فك الحظر');
      fetchUsers();
    } catch (err) { toast.error('حدث خطأ'); }
  };

  const handleBalance = async (userId, currentPoints) => {
    const amount = window.prompt(`الرصيد الحالي: ${currentPoints} نقطة\nأدخل المبلغ (موجب للإضافة، سالب للخصم):`);
    if (!amount) return;
    const num = parseInt(amount);
    if (isNaN(num)) { toast.error('أدخل رقماً صحيحاً'); return; }
    try {
      await updateBalance(userId, Math.abs(num), num >= 0 ? 'add' : 'subtract');
      toast.success(`تم ${num >= 0 ? 'إضافة' : 'خصم'} ${Math.abs(num)} نقطة`);
      fetchUsers();
    } catch (err) { toast.error('حدث خطأ'); }
  };

  const handleProcess = async (id, action, telegramId, stars) => {
    const note = action === 'reject' ? window.prompt('سبب الرفض (اختياري):') || '' : '';
    try {
      await processWithdrawal(id, action, note);
      if (action === 'approve') {
        toast.success(`✅ تم القبول! تذكر إرسال ${stars} Stars للمستخدم @${telegramId}`);
      } else {
        toast.info('❌ تم رفض الطلب وإعادة النقاط');
      }
      fetchWithdrawals(withdrawFilter);
    } catch (err) { toast.error('حدث خطأ'); }
  };

  const handleBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    if (!window.confirm(`إرسال رسالة بث لجميع المستخدمين؟`)) return;
    try {
      const res = await sendBroadcast(broadcastMsg);
      toast.success(`✅ تم الإرسال لـ ${res.data.sent} مستخدم (فشل: ${res.data.failed})`);
      setBroadcastMsg('');
    } catch (err) { toast.error('حدث خطأ'); }
  };

  const handleSendMsg = async () => {
    if (!msgTo || !msgText) return;
    try {
      await sendAdminMessage(msgTo, msgText);
      toast.success('✅ تم إرسال الرسالة');
      setMsgText('');
    } catch (err) { toast.error('حدث خطأ'); }
  };

  if (!user?.isAdmin) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ fontSize: '48px' }}>⛔</p>
        <p style={{ color: 'var(--neon-pink)', fontSize: '18px', marginTop: '12px' }}>غير مصرح لك بالدخول</p>
      </div>
    );
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
            onClick={() => {
              setTab(t.id);
              if (t.id === 'users') fetchUsers();
              if (t.id === 'withdrawals') fetchWithdrawals('pending');
            }}
            style={{
              padding: '8px 12px', borderRadius: '8px',
              border: tab === t.id ? '1px solid var(--neon-blue)' : '1px solid rgba(0,212,255,0.2)',
              background: tab === t.id ? 'rgba(0,212,255,0.1)' : 'var(--bg-card)',
              color: tab === t.id ? 'var(--neon-blue)' : 'var(--text-secondary)',
              fontSize: '12px', whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: 'Cairo',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <div>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{stats.totalUsers || 0}</div>
              <div className="stat-label">إجمالي المستخدمين</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--neon-green)' }}>{stats.newUsersToday || 0}</div>
              <div className="stat-label">مستخدمين اليوم</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--neon-gold)' }}>{stats.pendingWithdrawals || 0}</div>
              <div className="stat-label">سحوبات معلقة</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--neon-purple)' }}>{stats.totalStarsPaid || 0}</div>
              <div className="stat-label">Stars مدفوعة</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--neon-blue)' }}>{stats.todayAdsWatched || 0}</div>
              <div className="stat-label">إعلانات اليوم</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--neon-pink)' }}>{stats.totalReferrals || 0}</div>
              <div className="stat-label">إجمالي الإحالات</div>
            </div>
          </div>
          <button className="glow-btn" onClick={fetchDashboard} style={{ marginTop: '12px' }}>
            🔄 تحديث الإحصائيات
          </button>
        </div>
      )}

      {tab === 'users' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
              placeholder="بحث باسم أو ID أو يوزر..."
              style={{
                flex: 1, padding: '10px', background: 'var(--bg-primary)',
                border: '1px solid rgba(0,212,255,0.3)', borderRadius: '8px',
                color: 'white', fontFamily: 'Cairo',
              }}
            />
            <button className="glow-btn" onClick={fetchUsers} style={{ width: 'auto', padding: '10px 16px' }}>🔍</button>
          </div>
          {users.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '20px' }}>اضغط بحث لعرض المستخدمين</p>
          ) : (
            users.map(u => (
              <div key={u._id} className="neon-card" style={{ margin: '8px 0', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700' }}>{u.firstName} {u.lastName}</span>
                      {u.isBanned && (
                        <span style={{ background: 'rgba(255,0,110,0.2)', color: 'var(--neon-pink)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>
                          محظور
                        </span>
                      )}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                      @{u.username || 'بدون يوزر'} · ID: {u.telegramId}
                    </div>
                    <div style={{ color: 'var(--neon-gold)', fontSize: '13px', marginTop: '4px' }}>
                      💰 {(u.points || 0).toLocaleString()} نقطة
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                      انضم: {new Date(u.createdAt).toLocaleDateString('ar')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button
                      onClick={() => handleBan(u._id, u.isBanned)}
                      style={{
                        background: u.isBanned ? 'rgba(0,255,136,0.1)' : 'rgba(255,0,110,0.1)',
                        border: `1px solid ${u.isBanned ? 'var(--neon-green)' : 'var(--neon-pink)'}`,
                        borderRadius: '6px', padding: '4px 10px', cursor: 'pointer',
                        color: u.isBanned ? 'var(--neon-green)' : 'var(--neon-pink)',
                        fontSize: '12px', fontFamily: 'Cairo',
                      }}
                    >
                      {u.isBanned ? '✅ فك الحظر' : '🚫 حظر'}
                    </button>
                    <button
                      onClick={() => handleBalance(u._id, u.points)}
                      style={{
                        background: 'rgba(255,215,0,0.1)', border: '1px solid var(--neon-gold)',
                        borderRadius: '6px', padding: '4px 10px', cursor: 'pointer',
                        color: 'var(--neon-gold)', fontSize: '12px', fontFamily: 'Cairo',
                      }}
                    >
                      💰 تعديل
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'withdrawals' && (
        <div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            {['pending', 'approved', 'rejected'].map(s => (
              <button key={s} onClick={() => fetchWithdrawals(s)} style={{
                padding: '6px 12px', borderRadius: '6px',
                border: withdrawFilter === s ? '1px solid var(--neon-blue)' : '1px solid rgba(0,212,255,0.2)',
                background: withdrawFilter === s ? 'rgba(0,212,255,0.1)' : 'var(--bg-card)',
                color: withdrawFilter === s ? 'var(--neon-blue)' : 'var(--text-secondary)',
                cursor: 'pointer', fontSize: '12px', fontFamily: 'Cairo',
              }}>
                {s === 'pending' ? '⏳ معلق' : s === 'approved' ? '✅ مقبول' : '❌ مرفوض'}
              </button>
            ))}
          </div>
          {withdrawals.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '20px' }}>لا توجد سحوبات</p>
          ) : (
            withdrawals.map(w => (
              <div key={w._id || w.id} className="neon-card" style={{ margin: '8px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: '700' }}>
                      {w.firstName || ''} {w.lastName || ''}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      @{w.username || w.telegramId} · ID: {w.telegramId}
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--neon-gold)', marginTop: '4px' }}>
                      {(w.amount || 0).toLocaleString()} pts → ⭐ {w.stars} Stars
                    </p>
                    <p style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                      {new Date(w.createdAt).toLocaleString('ar')}
                    </p>
                    {w.adminNote && (
                      <p style={{ fontSize: '11px', color: 'var(--neon-pink)', marginTop: '4px' }}>
                        ملاحظة: {w.adminNote}
                      </p>
                    )}
                  </div>
                  {w.status === 'pending' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <button
                        onClick={() => handleProcess(w._id || w.id, 'approve', w.telegramId, w.stars)}
                        style={{
                          background: 'rgba(0,255,136,0.1)', border: '1px solid var(--neon-green)',
                          borderRadius: '6px', padding: '6px 12px', cursor: 'pointer',
                          color: 'var(--neon-green)', fontSize: '13px', fontFamily: 'Cairo',
                        }}
                      >
                        ✅ قبول
                      </button>
                      <button
                        onClick={() => handleProcess(w._id || w.id, 'reject', w.telegramId, w.stars)}
                        style={{
                          background: 'rgba(255,0,110,0.1)', border: '1px solid var(--neon-pink)',
                          borderRadius: '6px', padding: '6px 12px', cursor: 'pointer',
                          color: 'var(--neon-pink)', fontSize: '13px', fontFamily: 'Cairo',
                        }}
                      >
                        ❌ رفض
                      </button>
                    </div>
                  )}
                  {w.status !== 'pending' && (
                    <span className={`badge ${w.status === 'approved' ? 'approved' : 'rejected'}`}>
                      {w.status === 'approved' ? '✅ مقبول' : '❌ مرفوض'}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'broadcast' && (
        <div className="neon-card">
          <h3 style={{ color: 'var(--neon-blue)', marginBottom: '12px' }}>📢 إرسال بث لجميع المستخدمين</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '8px' }}>
            ⚠️ سيتم إرسال هذه الرسالة لجميع المستخدمين عبر البوت
          </p>
          <textarea
            value={broadcastMsg}
            onChange={(e) => setBroadcastMsg(e.target.value)}
            placeholder="اكتب رسالة البث..."
            rows={5}
            style={{
              width: '100%', padding: '12px', background: 'var(--bg-primary)',
              border: '1px solid rgba(0,212,255,0.3)', borderRadius: '8px',
              color: 'white', fontFamily: 'Cairo', resize: 'vertical',
            }}
          />
          <button className="glow-btn" onClick={handleBroadcast} style={{ marginTop: '12px' }} disabled={!broadcastMsg.trim()}>
            📤 إرسال للجميع
          </button>
        </div>
      )}

      {tab === 'message' && (
        <div className="neon-card">
          <h3 style={{ color: 'var(--neon-blue)', marginBottom: '12px' }}>💬 إرسال رسالة لمستخدم محدد</h3>
          <input
            value={msgTo}
            onChange={(e) => setMsgTo(e.target.value)}
            placeholder="Telegram ID المستخدم (مثال: 123456789)"
            style={{
              width: '100%', padding: '10px', marginBottom: '10px',
              background: 'var(--bg-primary)', border: '1px solid rgba(0,212,255,0.3)',
              borderRadius: '8px', color: 'white', fontFamily: 'Cairo', direction: 'ltr',
            }}
          />
          <textarea
            value={msgText}
            onChange={(e) => setMsgText(e.target.value)}
            placeholder="نص الرسالة..."
            rows={4}
            style={{
              width: '100%', padding: '12px', background: 'var(--bg-primary)',
              border: '1px solid rgba(0,212,255,0.3)', borderRadius: '8px',
              color: 'white', fontFamily: 'Cairo', resize: 'vertical',
            }}
          />
          <button className="glow-btn green" onClick={handleSendMsg} style={{ marginTop: '12px' }} disabled={!msgTo || !msgText}>
            📤 إرسال
          </button>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
