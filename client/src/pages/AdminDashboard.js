import React, { useState, useEffect } from 'react';
import {
  getAdminDashboard, getAdminUsers, toggleBan, updateBalance,
  getAdminWithdrawals, processWithdrawal, sendBroadcast, sendAdminMessage
} from '../services/api';

const fmtN = (n) => Number(n)?.toLocaleString() ?? '0';
const fmtDate = (d) =>
  new Date(d).toLocaleDateString('ar-EG', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 20, overflow: 'hidden', ...style
    }}>
      {children}
    </div>
  );
}

function CardHead({ icon, title, color = '#A78BFA' }) {
  return (
    <div style={{
      padding: '13px 18px',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'rgba(255,255,255,0.02)'
    }}>
      <span style={{ color }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</span>
    </div>
  );
}

function StatCard({ emoji, label, value, color, sub }) {
  return (
    <div style={{
      background: color + '0e', border: '1px solid ' + color + '28',
      borderRadius: 18, padding: '16px 16px 14px',
      display: 'flex', flexDirection: 'column', gap: 4
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: 26 }}>{emoji}</span>
        {sub && (
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600, background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '2px 8px' }}>
            {sub}
          </span>
        )}
      </div>
      <p style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1, marginTop: 6 }}>
        {typeof value === 'number' ? fmtN(value) : value}
      </p>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {label}
      </p>
    </div>
  );
}

const SPINNER = (
  <div style={{
    width: 28, height: 28,
    border: '3px solid rgba(139,92,246,0.3)',
    borderTopColor: '#8B5CF6',
    borderRadius: '50%', animation: 'adminSpin 0.9s linear infinite'
  }} />
);

export default function AdminDashboard({ user }) {
  const [tab, setTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userPage, setUserPage] = useState(1);
  const [userSearch, setUserSearch] = useState('');
  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawFilter, setWithdrawFilter] = useState('pending');
  const [withdrawActionLoading, setWithdrawActionLoading] = useState(null);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastTarget, setBroadcastTarget] = useState('all');
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [msgTo, setMsgTo] = useState('');
  const [msgText, setMsgText] = useState('');
  const [msgLoading, setMsgLoading] = useState(false);
  const [toastState, setToastState] = useState(null);

  const showToast = (title, desc, type = 'success') => {
    setToastState({ title, desc, type });
    setTimeout(() => setToastState(null), 3500);
  };

  useEffect(() => {
    if (!user?.isAdmin) return;
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const res = await getAdminDashboard();
      setStats(res.data);
    } catch (err) {
      showToast('خطأ', 'تعذر تحميل الإحصائيات', 'error');
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchUsers = async (page, search) => {
    setUsersLoading(true);
    try {
      const res = await getAdminUsers(search, page);
      setUsers(res.data.users || []);
    } catch (err) {
      showToast('خطأ', 'تعذر تحميل المستخدمين', 'error');
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchWithdrawals = async (status) => {
    setWithdrawLoading(true);
    try {
      const res = await getAdminWithdrawals(status);
      setWithdrawals(res.data.withdrawals || []);
    } catch (err) {
      showToast('خطأ', 'تعذر تحميل السحوبات', 'error');
    } finally {
      setWithdrawLoading(false);
    }
  };

  const handleBan = async (userId, isBanned) => {
    try {
      const res = await toggleBan(userId);
      showToast(res.data.isBanned ? '🚫 تم الحظر' : '✅ تم رفع الحظر', '');
      fetchUsers(userPage, userSearch);
    } catch (err) {
      showToast('خطأ', 'فشلت العملية', 'error');
    }
  };

  const handleBalance = async (userId, currentPoints) => {
    const amount = window.prompt('الرصيد الحالي: ' + currentPoints + ' نقطة\nأدخل المبلغ (موجب للإضافة، سالب للخصم):');
    if (!amount) return;
    const num = parseInt(amount);
    if (isNaN(num)) { showToast('خطأ', 'أدخل رقماً صحيحاً', 'error'); return; }
    try {
      await updateBalance(userId, Math.abs(num), num >= 0 ? 'add' : 'subtract');
      showToast((num >= 0 ? 'إضافة' : 'خصم') + ' ' + Math.abs(num) + ' نقطة', 'تم تحديث الرصيد');
      fetchUsers(userPage, userSearch);
    } catch (err) {
      showToast('خطأ', 'فشلت العملية', 'error');
    }
  };

  const handleWithdrawAction = async (id, action, telegramId, stars) => {
    setWithdrawActionLoading(id);
    const note = action === 'reject' ? (window.prompt('سبب الرفض (اختياري):') || '') : '';
    try {
      await processWithdrawal(id, action, note);
      if (action === 'approve') {
        showToast('✅ تمت الموافقة', 'تذكر إرسال ' + stars + ' Stars للمستخدم');
      } else {
        showToast('❌ تم الرفض', 'تم إعادة النقاط للمستخدم');
      }
      fetchWithdrawals(withdrawFilter);
    } catch (err) {
      showToast('خطأ', 'فشلت العملية', 'error');
    } finally {
      setWithdrawActionLoading(null);
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    setBroadcastLoading(true);
    try {
      const res = await sendBroadcast(broadcastMsg);
      showToast('✅ تم الإرسال', 'أُرسلت لـ ' + res.data.sent + ' مستخدم');
      setBroadcastMsg('');
    } catch (err) {
      showToast('خطأ', 'فشل الإرسال', 'error');
    } finally {
      setBroadcastLoading(false);
    }
  };

  const handleSendMsg = async () => {
    if (!msgTo || !msgText) return;
    setMsgLoading(true);
    try {
      await sendAdminMessage(msgTo, msgText);
      showToast('✅ تم الإرسال', 'تم إرسال الرسالة للمستخدم');
      setMsgText('');
    } catch (err) {
      showToast('خطأ', 'فشل الإرسال', 'error');
    } finally {
      setMsgLoading(false);
    }
  };

  if (!user?.isAdmin) {
    return (
      <div style={{ minHeight: '100vh', background: '#070711', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🚫</div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>غير مصرح</p>
        </div>
      </div>
    );
  }

  const TABS = [
    { id: 'stats', icon: '📊', label: 'الإحصائيات' },
    { id: 'users', icon: '👥', label: 'المستخدمون' },
    { id: 'withdrawals', icon: '💰', label: 'السحوبات' },
    { id: 'broadcast', icon: '📢', label: 'البث' },
    { id: 'message', icon: '💬', label: 'رسالة' },
  ];

  return (
    <div style={{
      minHeight: '100vh', background: '#070711',
      color: '#fff', fontFamily: "'Cairo','Inter',system-ui,sans-serif",
      padding: '0 14px 100px', direction: 'rtl'
    }}>
      <style>{`
        @keyframes adminSpin { to { transform: rotate(360deg); } }
        @keyframes adminToastIn { from { opacity:0; transform: translateX(-50%) translateY(-16px) scale(0.95); } to { opacity:1; transform: translateX(-50%) translateY(0) scale(1); } }
        .admin-orb-1 { position:absolute; width:400px; height:400px; border-radius:50%; background: radial-gradient(circle, rgba(124,58,237,0.15), transparent 70%); top:-100px; right:-100px; pointer-events:none; }
        .admin-orb-2 { position:absolute; width:300px; height:300px; border-radius:50%; background: radial-gradient(circle, rgba(79,70,229,0.1), transparent 70%); bottom:0; left:-80px; pointer-events:none; }
      `}</style>

      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div className="admin-orb-1" />
        <div className="admin-orb-2" />
      </div>

      {toastState && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, background: toastState.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
          border: '1px solid ' + (toastState.type === 'error' ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)'),
          borderRadius: 16, padding: '12px 20px', backdropFilter: 'blur(12px)',
          minWidth: 240, textAlign: 'center', animation: 'adminToastIn 0.3s ease',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
        }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: toastState.desc ? 4 : 0 }}>{toastState.title}</p>
          {toastState.desc && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{toastState.desc}</p>}
        </div>
      )}

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 900, margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0 24px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: 'linear-gradient(135deg,#7C3AED,#4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🛡️</div>
              <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, background: 'linear-gradient(135deg,#A78BFA,#60A5FA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>لوحة التحكم</h1>
            </div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 600, margin: 0 }}>Admin Panel</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <a href="/" style={{ height: 40, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', cursor: 'pointer', padding: '0 14px', display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontSize: 12, textDecoration: 'none' }}>
              ← رجوع
            </a>
            <button onClick={fetchStats} style={{ width: 40, height: 40, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 16 }}>
              🔄
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 24, padding: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: 18, border: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => {
              setTab(t.id);
              if (t.id === 'users') fetchUsers(1, '');
              if (t.id === 'withdrawals') fetchWithdrawals('pending');
            }} style={{
              flex: 1, minWidth: 70, height: 40, borderRadius: 13, border: 'none',
              background: tab === t.id ? 'rgba(139,92,246,0.25)' : 'transparent',
              color: tab === t.id ? '#A78BFA' : 'rgba(255,255,255,0.35)',
              fontWeight: 800, fontSize: 11, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              transition: 'all 0.2s',
              boxShadow: tab === t.id ? '0 0 0 1px rgba(139,92,246,0.3)' : 'none',
              fontFamily: 'inherit', whiteSpace: 'nowrap'
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === 'stats' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {statsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>{SPINNER}</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
                  <StatCard emoji="👥" label="إجمالي المستخدمين" value={stats?.totalUsers ?? 0} color="#60A5FA" />
                  <StatCard emoji="🆕" label="مستخدمون اليوم" value={stats?.newUsersToday ?? 0} color="#34D399" />
                  <StatCard emoji="⏳" label="سحوبات معلقة" value={stats?.pendingWithdrawals ?? 0} color="#F59E0B" />
                  <StatCard emoji="⭐" label="Stars مدفوعة" value={stats?.totalStarsPaid ?? 0} color="#FFD700" />
                  <StatCard emoji="📺" label="إعلانات اليوم" value={stats?.todayAdsWatched ?? 0} color="#10B981" />
                  <StatCard emoji="👫" label="إجمالي الإحالات" value={stats?.totalReferrals ?? 0} color="#EC4899" />
                </div>
                <Card>
                  <CardHead icon="📈" title="ملخص النشاط" color="#10B981" />
                  <div style={{ padding: 16 }}>
                    {[
                      { label: 'إجمالي المستخدمين', value: fmtN(stats?.totalUsers ?? 0), color: '#A78BFA' },
                      { label: 'مستخدمون جدد اليوم', value: fmtN(stats?.newUsersToday ?? 0), color: '#34D399' },
                      { label: 'إعلانات مشاهدة اليوم', value: fmtN(stats?.todayAdsWatched ?? 0), color: '#60A5FA' },
                      { label: 'إجمالي Stars مدفوعة', value: fmtN(stats?.totalStarsPaid ?? 0), color: '#FFD700' },
                    ].map((row, i, arr) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{row.label}</span>
                        <span style={{ fontSize: 15, fontWeight: 900, color: row.color }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </>
            )}
          </div>
        )}

        {tab === 'users' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchUsers(1, userSearch)}
                placeholder="بحث باسم أو ID أو يوزر..."
                style={{ flex: 1, height: 44, borderRadius: 14, padding: '0 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(139,92,246,0.25)', color: '#fff', fontSize: 13, fontFamily: 'inherit', outline: 'none', direction: 'rtl' }}
              />
              <button onClick={() => fetchUsers(1, userSearch)}
                style={{ height: 44, width: 44, borderRadius: 14, border: 'none', background: 'rgba(139,92,246,0.25)', color: '#A78BFA', cursor: 'pointer', fontSize: 18 }}>🔍</button>
            </div>
            <Card>
              <CardHead icon="👥" title={'المستخدمون — صفحة ' + userPage} color="#60A5FA" />
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {usersLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>{SPINNER}</div>
                ) : users.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: 24, fontSize: 13 }}>اضغط بحث لعرض المستخدمين</p>
                ) : users.map((u) => (
                  <div key={u._id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                    background: u.isBanned ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.025)',
                    border: '1px solid ' + (u.isBanned ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)'),
                    borderRadius: 14
                  }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                      {u.firstName?.[0] || u.username?.[0] || '👤'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <p style={{ fontSize: 13, fontWeight: 800, color: '#E2E8F0', margin: 0 }}>{u.firstName || ''} {u.lastName || ''}</p>
                        {u.isBanned && <span style={{ fontSize: 9, color: '#EF4444', background: 'rgba(239,68,68,0.15)', borderRadius: 6, padding: '1px 6px', fontWeight: 700 }}>محظور</span>}
                      </div>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: 0 }}>
                        {u.username ? '@' + u.username + ' · ' : ''}{u.telegramId} · 💰 {fmtN(Number(u.points))} نقطة
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => handleBalance(u._id, u.points)}
                        style={{ height: 32, borderRadius: 10, border: 'none', background: 'rgba(255,215,0,0.15)', color: '#FFD700', fontWeight: 700, fontSize: 11, cursor: 'pointer', padding: '0 10px' }}>💰</button>
                      <button onClick={() => handleBan(u._id, u.isBanned)}
                        style={{ height: 32, borderRadius: 10, border: 'none', background: u.isBanned ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)', color: u.isBanned ? '#34D399' : '#FCA5A5', fontWeight: 700, fontSize: 11, cursor: 'pointer', padding: '0 12px', fontFamily: 'inherit' }}>
                        {u.isBanned ? '✅ رفع' : '🚫 حظر'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <button onClick={() => { const p = Math.max(1, userPage - 1); setUserPage(p); fetchUsers(p, userSearch); }} disabled={userPage === 1}
                  style={{ flex: 1, height: 38, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: userPage === 1 ? 'rgba(255,255,255,0.2)' : '#fff', fontWeight: 700, fontSize: 12, cursor: userPage === 1 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>← السابق</button>
                <div style={{ height: 38, padding: '0 16px', display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 800, color: '#A78BFA' }}>صفحة {userPage}</div>
                <button onClick={() => { const p = userPage + 1; setUserPage(p); fetchUsers(p, userSearch); }} disabled={users.length < 20}
                  style={{ flex: 1, height: 38, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: users.length < 20 ? 'rgba(255,255,255,0.2)' : '#fff', fontWeight: 700, fontSize: 12, cursor: users.length < 20 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>التالي →</button>
              </div>
            </Card>
          </div>
        )}

        {tab === 'withdrawals' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['pending','⏳ معلقة'],['approved','✅ موافق'],['rejected','❌ مرفوضة']].map(([v, l]) => (
                <button key={v} onClick={() => { setWithdrawFilter(v); fetchWithdrawals(v); }}
                  style={{ flex: 1, height: 38, borderRadius: 12, border: '1px solid ' + (withdrawFilter === v ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)'), background: withdrawFilter === v ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.03)', color: withdrawFilter === v ? '#A78BFA' : 'rgba(255,255,255,0.4)', fontWeight: 800, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {l}
                </button>
              ))}
            </div>
            <Card>
              <CardHead icon="💰" title="طلبات السحب" color="#F59E0B" />
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {withdrawLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>{SPINNER}</div>
                ) : withdrawals.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: 24, fontSize: 13 }}>لا توجد طلبات</p>
                ) : withdrawals.map((w) => (
                  <div key={w._id || w.id} style={{ padding: '14px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 800, color: '#E2E8F0', marginBottom: 2 }}>
                          {w.firstName ? (w.firstName + (w.lastName ? ' ' + w.lastName : '')) : '🆔 ' + w.telegramId}
                        </p>
                        {w.username && <p style={{ fontSize: 11, color: '#60A5FA', marginBottom: 2 }}>@{w.username}</p>}
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{fmtDate(w.createdAt)}</p>
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <p style={{ fontSize: 16, fontWeight: 900, color: '#FFD700' }}>⭐ {fmtN(Number(w.stars))}</p>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{fmtN(Number(w.amount))} نقطة</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 8,
                        background: w.status === 'pending' ? 'rgba(245,158,11,0.15)' : w.status === 'approved' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                        color: w.status === 'pending' ? '#FCD34D' : w.status === 'approved' ? '#34D399' : '#FCA5A5'
                      }}>
                        {w.status === 'pending' ? '⏳ معلق' : w.status === 'approved' ? '✅ موافق' : '❌ مرفوض'}
                      </span>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>ID: {w.telegramId}</span>
                      {w.adminNote && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>• {w.adminNote}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {w.username && (
                        <a href={'https://t.me/' + w.username} target="_blank" rel="noreferrer"
                          style={{ flex: 1, height: 36, borderRadius: 10, border: '1px solid rgba(96,165,250,0.3)', background: 'rgba(96,165,250,0.1)', color: '#60A5FA', fontWeight: 700, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none' }}>
                          💬 راسله
                        </a>
                      )}
                      {w.status === 'pending' && (
                        <>
                          <button onClick={() => handleWithdrawAction(w._id || w.id, 'approve', w.telegramId, w.stars)}
                            disabled={withdrawActionLoading === (w._id || w.id)}
                            style={{ flex: 1, height: 36, borderRadius: 10, border: 'none', background: 'rgba(16,185,129,0.2)', color: '#34D399', fontWeight: 800, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit' }}>
                            {withdrawActionLoading === (w._id || w.id) ? <div style={{ width: 14, height: 14, border: '2px solid rgba(52,211,153,0.3)', borderTopColor: '#34D399', borderRadius: '50%', animation: 'adminSpin 0.8s linear infinite' }} /> : '✅'} موافقة
                          </button>
                          <button onClick={() => handleWithdrawAction(w._id || w.id, 'reject', w.telegramId, w.stars)}
                            disabled={withdrawActionLoading === (w._id || w.id)}
                            style={{ flex: 1, height: 36, borderRadius: 10, border: 'none', background: 'rgba(239,68,68,0.15)', color: '#FCA5A5', fontWeight: 800, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit' }}>
                            ❌ رفض
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {tab === 'broadcast' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card>
              <CardHead icon="📢" title="إرسال رسالة جماعية" color="#EC4899" />
              <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>المجموعة المستهدفة</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[['all','🌍','جميع المستخدمين','كل المستخدمين النشطين'],['inactive','😴','الغائبون (+3 أيام)','من لم يدخل منذ 3 أيام']].map(([v, e, t, d]) => (
                      <button key={v} onClick={() => setBroadcastTarget(v)}
                        style={{ padding: '12px', borderRadius: 16, border: '1px solid ' + (broadcastTarget === v ? 'rgba(236,72,153,0.4)' : 'rgba(255,255,255,0.07)'), background: broadcastTarget === v ? 'rgba(236,72,153,0.12)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', textAlign: 'right', fontFamily: 'inherit' }}>
                        <div style={{ fontSize: 22, marginBottom: 6 }}>{e}</div>
                        <p style={{ fontSize: 12, fontWeight: 800, color: broadcastTarget === v ? '#F9A8D4' : 'rgba(255,255,255,0.6)', marginBottom: 3 }}>{t}</p>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{d}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>نص الرسالة</p>
                  <textarea value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} rows={5}
                    placeholder={'اكتب رسالتك هنا...\n\nمثال: 🎁 هدية مجانية! ادخل الآن واستلم 50 نقطة 🎮'}
                    style={{ width: '100%', borderRadius: 16, padding: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.6, direction: 'rtl' }} />
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 6 }}>{broadcastMsg.length} / 1000 حرف</p>
                </div>
                {broadcastMsg.trim() && (
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 14 }}>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>معاينة</p>
                    <div style={{ background: 'rgba(30,30,50,0.8)', borderRadius: 12, padding: 14 }}>
                      <p style={{ fontSize: 13, color: '#E2E8F0', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{broadcastMsg}</p>
                      <div style={{ marginTop: 10, background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 800, color: '#A78BFA', textAlign: 'center' }}>🎮 افتح التطبيق</div>
                    </div>
                  </div>
                )}
                <button onClick={handleBroadcast} disabled={broadcastLoading || !broadcastMsg.trim()}
                  style={{ height: 56, borderRadius: 18, border: 'none', background: broadcastMsg.trim() ? 'linear-gradient(135deg,#EC4899,#DB2777)' : 'rgba(255,255,255,0.05)', color: broadcastMsg.trim() ? '#fff' : 'rgba(255,255,255,0.2)', fontWeight: 900, fontSize: 15, cursor: broadcastMsg.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, transition: 'all 0.3s', boxShadow: broadcastMsg.trim() ? '0 6px 24px rgba(236,72,153,0.35)' : 'none', fontFamily: 'inherit' }}>
                  {broadcastLoading ? <div style={{ width: 22, height: 22, border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'adminSpin 0.8s linear infinite' }} /> : '📤'}
                  {broadcastLoading ? 'جاري الإرسال...' : broadcastTarget === 'all' ? 'إرسال لجميع المستخدمين 🚀' : 'إرسال للغائبين 📩'}
                </button>
                <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 14, padding: '12px 14px' }}>
                  <p style={{ fontSize: 11, color: '#FCD34D', fontWeight: 700, marginBottom: 4 }}>⚠️ تنبيه</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>الرسائل الجماعية تُرسَل بمعدل 1 رسالة كل 50ms لتجنب الحظر من Telegram.</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {tab === 'message' && (
          <Card>
            <CardHead icon="💬" title="إرسال رسالة لمستخدم محدد" color="#60A5FA" />
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Telegram ID للمستخدم</p>
                <input value={msgTo} onChange={(e) => setMsgTo(e.target.value)} placeholder="مثال: 123456789"
                  style={{ width: '100%', height: 44, borderRadius: 14, padding: '0 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(96,165,250,0.25)', color: '#fff', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', direction: 'ltr' }} />
              </div>
              <div>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>نص الرسالة</p>
                <textarea value={msgText} onChange={(e) => setMsgText(e.target.value)} placeholder="نص الرسالة..." rows={4}
                  style={{ width: '100%', borderRadius: 16, padding: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.6, direction: 'rtl' }} />
              </div>
              <button onClick={handleSendMsg} disabled={msgLoading || !msgTo || !msgText}
                style={{ height: 52, borderRadius: 18, border: 'none', background: msgTo && msgText ? 'linear-gradient(135deg,#60A5FA,#3B82F6)' : 'rgba(255,255,255,0.05)', color: msgTo && msgText ? '#fff' : 'rgba(255,255,255,0.2)', fontWeight: 900, fontSize: 14, cursor: msgTo && msgText ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontFamily: 'inherit' }}>
                {msgLoading ? <div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'adminSpin 0.8s linear infinite' }} /> : '📤'}
                {msgLoading ? 'جاري الإرسال...' : 'إرسال الرسالة'}
              </button>
            </div>
          </Card>
        )}

      </div>
    </div>
  );
}
