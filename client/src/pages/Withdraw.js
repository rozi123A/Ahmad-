import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getWithdrawInfo, requestWithdraw, getWithdrawHistory } from '../services/api';

function Withdraw({ user }) {
  const [info, setInfo] = useState({ balance: 0, minWithdraw: 10000, starsRate: 1000, canWithdraw: false, pendingRequests: 0 });
  const [amount, setAmount] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [infoLoading, setInfoLoading] = useState(true);

  useEffect(() => { fetchInfo(); fetchHistory(); }, []);

  const fetchInfo = async () => {
    try {
      const res = await getWithdrawInfo();
      setInfo(res.data);
    } catch (err) {
      toast.error('تعذّر تحميل بيانات السحب');
    } finally { setInfoLoading(false); }
  };

  const fetchHistory = async () => {
    try { const res = await getWithdrawHistory(); setHistory(res.data); } catch (err) {}
  };

  const handleWithdraw = async () => {
    const pts = parseInt(amount);
    if (!pts || pts < info.minWithdraw) { toast.error(`الحد الأدنى ${info.minWithdraw.toLocaleString()} نقطة`); return; }
    if (pts > info.balance) { toast.error('رصيدك غير كافٍ'); return; }
    setLoading(true);
    try {
      await requestWithdraw(pts);
      toast.success('✅ تم إرسال الطلب! سيُراجع خلال 24 ساعة');
      setAmount(''); fetchInfo(); fetchHistory();
    } catch (err) {
      toast.error(err.response?.data?.error || 'حدث خطأ، حاول مجدداً');
    } finally { setLoading(false); }
  };

  const stars = amount ? Math.floor(parseInt(amount || 0) / info.starsRate) : 0;
  const progress = Math.min((info.balance / info.minWithdraw) * 100, 100);
  const remaining = Math.max(0, info.minWithdraw - info.balance);

  return (
    <div style={{ padding: '0 0 24px', position: 'relative', zIndex: 1 }}>
      {/* Header */}
      <div style={{ padding: '24px 20px 0', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '8px' }}>⭐</div>
        <h1 style={{ fontSize: '22px', fontWeight: '900', background: 'linear-gradient(135deg,#f59e0b,#fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          سحب Telegram Stars
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '4px' }}>
          استبدل نقاطك بـ Telegram Stars حقيقية
        </p>
      </div>

      {/* Balance Card */}
      <div style={{ margin: '20px 16px 0' }}>
        <div className="balance-card">
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>رصيدك المتاح</div>
          <div className="balance-amount">{infoLoading ? '...' : info.balance.toLocaleString()}</div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>نقطة</div>

          {/* Progress */}
          <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>
              <span>التقدم نحو الحد الأدنى</span>
              <span style={{ color: progress >= 100 ? '#10b981' : '#8b5cf6' }}>{Math.round(progress)}%</span>
            </div>
            <div className="progress-bar">
              <div className={`progress-fill ${progress >= 100 ? 'green' : ''}`} style={{ width: `${progress}%` }} />
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: '6px' }}>
              {progress < 100 ? `تحتاج ${remaining.toLocaleString()} نقطة إضافية للسحب` : '✅ يمكنك السحب الآن!'}
            </div>
          </div>
        </div>
      </div>

      {/* Withdraw Form */}
      <div style={{ margin: '16px' }}>
        <div className="card" style={{ borderColor: info.canWithdraw ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)' }}>
          <div className="section-header">
            <div className="section-icon gold">💸</div>
            <div>
              <div className="section-title">طلب سحب</div>
              <div className="section-subtitle">الحد الأدنى: {info.minWithdraw.toLocaleString()} نقطة = {info.minWithdraw / info.starsRate} Stars</div>
            </div>
          </div>

          {info.canWithdraw && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '8px' }}>
                عدد النقاط:
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`الحد الأدنى ${info.minWithdraw.toLocaleString()}`}
                className="input"
              />
              {amount && parseInt(amount) >= info.minWithdraw && (
                <div style={{ marginTop: '12px', padding: '14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '22px', fontWeight: '900', color: '#f59e0b' }}>⭐ {stars} Stars</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                    {info.starsRate.toLocaleString()} نقطة = 1 Star
                  </div>
                </div>
              )}
            </div>
          )}

          {info.pendingRequests > 0 && (
            <div style={{ padding: '12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '10px', marginBottom: '12px', textAlign: 'center', fontSize: '13px', color: '#f59e0b' }}>
              ⏳ لديك طلب قيد المراجعة - يرجى الانتظار
            </div>
          )}

          <button
            className="glow-btn gold"
            onClick={handleWithdraw}
            disabled={loading || !info.canWithdraw || infoLoading || info.pendingRequests > 0}
          >
            {infoLoading ? '⏳ جاري التحميل...' :
              loading ? '⏳ جاري الإرسال...' :
              info.pendingRequests > 0 ? '⏳ انتظر معالجة طلبك السابق' :
              !info.canWithdraw ? `تحتاج ${remaining.toLocaleString()} نقطة أخرى` :
              '💸 إرسال طلب السحب'}
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div style={{ margin: '0 16px' }}>
        <div className="card">
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.9' }}>
            <div>💡 كل {info.starsRate.toLocaleString()} نقطة = 1 ⭐ Telegram Star</div>
            <div>⏱️ يُعالج الطلب خلال 24-48 ساعة</div>
            <div>✅ يُرسل مباشرة لحسابك على Telegram</div>
          </div>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div style={{ margin: '16px 16px 0' }}>
          <div className="card">
            <div className="section-header">
              <div className="section-icon purple">📋</div>
              <div>
                <div className="section-title">سجل السحوبات</div>
                <div className="section-subtitle">{history.length} طلب سابق</div>
              </div>
            </div>
            {history.map((w, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < history.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600' }}>⭐ {w.stars || Math.floor((w.amount || 0) / info.starsRate)} Stars</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                    {(w.amount || 0).toLocaleString()} نقطة · {new Date(w.createdAt).toLocaleDateString('ar')}
                  </div>
                </div>
                <span className={`badge ${w.status}`}>
                  {w.status === 'pending' ? '⏳ قيد المراجعة' : w.status === 'approved' ? '✅ مقبول' : '❌ مرفوض'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Withdraw;
