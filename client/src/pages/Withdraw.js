import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getWithdrawInfo, requestWithdraw, getWithdrawHistory } from '../services/api';

function Withdraw({ user }) {
  const [info, setInfo] = useState({ balance: 0, minWithdraw: 10000, starsRate: 1000, canWithdraw: false, pendingRequests: 0 });
  const [amount, setAmount] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [infoLoading, setInfoLoading] = useState(true);

  useEffect(() => {
    fetchInfo();
    fetchHistory();
  }, []);

  const fetchInfo = async () => {
    try {
      const res = await getWithdrawInfo();
      setInfo(res.data);
    } catch (err) {
      toast.error('تعذّر تحميل معلومات السحب');
    } finally {
      setInfoLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await getWithdrawHistory();
      setHistory(res.data);
    } catch (err) {}
  };

  const handleWithdraw = async () => {
    const pts = parseInt(amount);
    if (!pts || pts < info.minWithdraw) {
      toast.error(`الحد الأدنى ${info.minWithdraw.toLocaleString()} نقطة`);
      return;
    }
    if (pts > info.balance) {
      toast.error('رصيدك غير كافٍ');
      return;
    }

    setLoading(true);
    try {
      await requestWithdraw(pts);
      toast.success('✅ تم إرسال طلب السحب! سيُراجع خلال 24 ساعة');
      setAmount('');
      fetchInfo();
      fetchHistory();
    } catch (err) {
      toast.error(err.response?.data?.error || 'حدث خطأ، حاول مجدداً');
    } finally {
      setLoading(false);
    }
  };

  const stars = amount ? Math.floor(parseInt(amount || 0) / info.starsRate) : 0;
  const progress = Math.min((info.balance / info.minWithdraw) * 100, 100);

  const getButtonLabel = () => {
    if (loading) return '⏳ جاري الإرسال...';
    if (info.pendingRequests > 0) return '⏳ لديك طلب قيد المراجعة';
    if (info.balance < info.minWithdraw) return `تحتاج ${(info.minWithdraw - info.balance).toLocaleString()} نقطة إضافية`;
    return '💫 طلب سحب';
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1 className="page-title">⭐ سحب Telegram Stars</h1>

      <div className="neon-card">
        <div style={{ textAlign: 'center', marginBottom: '12px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>رصيدك الحالي</p>
          <div className="points-display">{info.balance.toLocaleString()} pts</div>
        </div>

        {/* Progress bar toward minimum */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            <span>التقدم نحو الحد الأدنى</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: progress >= 100 ? 'var(--neon-green, #00ff88)' : 'var(--neon-blue)',
              borderRadius: '4px',
              transition: 'width 0.5s ease',
            }} />
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '11px', textAlign: 'center', marginTop: '4px' }}>
            الحد الأدنى: {info.minWithdraw.toLocaleString()} نقطة = {info.minWithdraw / info.starsRate} Stars
          </p>
        </div>

        {info.canWithdraw && (
          <>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ color: 'var(--text-secondary)', fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                المبلغ (نقاط):
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`الحد الأدنى ${info.minWithdraw.toLocaleString()}`}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'var(--bg-primary)',
                  border: '1px solid rgba(0, 212, 255, 0.3)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '16px',
                  fontFamily: 'Cairo',
                  direction: 'ltr',
                  textAlign: 'right',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {amount && parseInt(amount) >= info.minWithdraw && (
              <div style={{ textAlign: 'center', marginBottom: '12px', padding: '12px', background: 'var(--bg-primary)', borderRadius: '8px' }}>
                <p style={{ color: 'var(--neon-gold)', fontSize: '18px', fontWeight: '700' }}>
                  ⭐ ستحصل على {stars} Stars
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                  ({info.starsRate.toLocaleString()} نقطة = 1 Star)
                </p>
              </div>
            )}
          </>
        )}

        <button
          className="glow-btn gold"
          onClick={handleWithdraw}
          disabled={loading || !info.canWithdraw}
          style={{ opacity: (!info.canWithdraw && !loading) ? 0.6 : 1 }}
        >
          {infoLoading ? '⏳ جاري التحميل...' : getButtonLabel()}
        </button>
      </div>

      {history.length > 0 && (
        <div className="neon-card">
          <h3 style={{ color: 'var(--neon-blue)', marginBottom: '12px', fontSize: '16px' }}>📋 سجل السحوبات</h3>
          {history.map((w, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 0',
              borderBottom: i < history.length - 1 ? '1px solid rgba(0,212,255,0.1)' : 'none',
            }}>
              <div>
                <p style={{ fontSize: '14px' }}>⭐ {w.stars} Stars ({w.amount?.toLocaleString()} pts)</p>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {new Date(w.createdAt).toLocaleDateString('ar')}
                </p>
              </div>
              <span className={`badge ${w.status}`}>
                {w.status === 'pending' ? '⏳ قيد المراجعة' : w.status === 'approved' ? '✅ مقبول' : '❌ مرفوض'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Withdraw;
