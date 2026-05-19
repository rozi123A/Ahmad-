import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getWithdrawInfo, requestWithdraw, getWithdrawHistory } from '../services/api';
import { useLang } from '../LanguageContext';

function Withdraw({ user }) {
  const { t } = useLang();
  const [info, setInfo] = useState({ balance: 0, minWithdraw: 10000, starsRate: 1000, canWithdraw: false, pendingRequests: 0 });
  const [amount, setAmount] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [infoLoading, setInfoLoading] = useState(true);

  useEffect(() => { fetchInfo(); fetchHistory(); }, []);

  const fetchInfo = async () => {
    try { const res = await getWithdrawInfo(); setInfo(res.data); } catch (err) {}
    finally { setInfoLoading(false); }
  };

  const fetchHistory = async () => {
    try { const res = await getWithdrawHistory(); setHistory(res.data); } catch (err) {}
  };

  const handleWithdraw = async () => {
    const pts = parseInt(amount);
    if (!pts || pts < info.minWithdraw) { toast.error(`${t('minWithdraw')} ${info.minWithdraw.toLocaleString()}`); return; }
    if (pts > info.balance) { toast.error('Insufficient balance'); return; }
    setLoading(true);
    try {
      await requestWithdraw(pts);
      toast.success('✅ Request sent!');
      setAmount(''); fetchInfo(); fetchHistory();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
    finally { setLoading(false); }
  };

  const stars = amount ? Math.floor(parseInt(amount || 0) / info.starsRate) : 0;
  const progress = Math.min((info.balance / info.minWithdraw) * 100, 100);
  const remaining = Math.max(0, info.minWithdraw - info.balance);

  const statusLabel = (s) => s === 'pending' ? t('pending') : s === 'approved' ? t('approved') : t('rejected');

  return (
    <div style={{ padding: '0 0 24px', position: 'relative', zIndex: 1 }}>
      <div style={{ padding: '24px 20px 0', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '8px' }}>⭐</div>
        <h1 style={{ fontSize: '22px', fontWeight: '900', background: 'linear-gradient(135deg,#f59e0b,#fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          {t('withdrawTitle')}
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '4px' }}>{t('withdrawDesc')}</p>
      </div>

      <div style={{ margin: '20px 16px 0' }}>
        <div className="balance-card">
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>{t('availableBalance')}</div>
          <div className="balance-amount">{infoLoading ? '...' : info.balance.toLocaleString()}</div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>{t('points')}</div>
          <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>
              <span>{t('progressLabel')}</span>
              <span style={{ color: progress >= 100 ? '#10b981' : '#8b5cf6' }}>{Math.round(progress)}%</span>
            </div>
            <div className="progress-bar">
              <div className={`progress-fill ${progress >= 100 ? 'green' : ''}`} style={{ width: `${progress}%` }} />
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: '6px' }}>
              {progress < 100 ? `${remaining.toLocaleString()} ${t('needMore')}` : t('canWithdraw')}
            </div>
          </div>
        </div>
      </div>

      <div style={{ margin: '16px' }}>
        <div className="card">
          <div className="section-header">
            <div className="section-icon gold">💸</div>
            <div>
              <div className="section-title">{t('withdrawRequest')}</div>
              <div className="section-subtitle">{t('minWithdraw')}: {info.minWithdraw.toLocaleString()} = {info.minWithdraw / info.starsRate} ⭐</div>
            </div>
          </div>
          {info.canWithdraw && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '8px' }}>{t('pointsLabel')}</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`${info.minWithdraw.toLocaleString()}`} className="input" />
              {amount && parseInt(amount) >= info.minWithdraw && (
                <div style={{ marginTop: '12px', padding: '14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '22px', fontWeight: '900', color: '#f59e0b' }}>⭐ {stars} Stars</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>{info.starsRate.toLocaleString()} pts = 1 ⭐</div>
                </div>
              )}
            </div>
          )}
          {info.pendingRequests > 0 && (
            <div style={{ padding: '12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '10px', marginBottom: '12px', textAlign: 'center', fontSize: '13px', color: '#f59e0b' }}>
              {t('pendingRequest')}
            </div>
          )}
          <button className="glow-btn gold" onClick={handleWithdraw} disabled={loading || !info.canWithdraw || infoLoading || info.pendingRequests > 0}>
            {infoLoading ? '⏳...' : loading ? '⏳...' : info.pendingRequests > 0 ? t('pendingRequest') : !info.canWithdraw ? `${remaining.toLocaleString()} ${t('needMore')}` : t('sendRequest')}
          </button>
        </div>
      </div>

      {history.length > 0 && (
        <div style={{ margin: '0 16px' }}>
          <div className="card">
            <div className="section-header">
              <div className="section-icon purple">📋</div>
              <div><div className="section-title">{t('history')}</div></div>
            </div>
            {history.map((w, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < history.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600' }}>⭐ {w.stars || Math.floor((w.amount || 0) / info.starsRate)} Stars</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{(w.amount || 0).toLocaleString()} pts · {new Date(w.createdAt).toLocaleDateString()}</div>
                </div>
                <span className={`badge ${w.status}`}>{statusLabel(w.status)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Withdraw;
