import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getReferralInfo, getReferralList } from '../services/api';

function Referral({ user }) {
  const [info, setInfo] = useState(null);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [infoRes, listRes] = await Promise.all([getReferralInfo(), getReferralList()]);
      setInfo(infoRes.data);
      setFriends(listRes.data.referrals || []);
    } catch (err) { toast.error('حدث خطأ في تحميل البيانات'); }
    finally { setLoading(false); }
  };

  const handleCopy = () => {
    if (!info?.referralLink) return;
    const copyText = () => {
      setCopied(true);
      toast.success('✅ تم نسخ الرابط!');
      setTimeout(() => setCopied(false), 2500);
    };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(info.referralLink).then(copyText).catch(() => {
        const el = document.createElement('textarea');
        el.value = info.referralLink;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        copyText();
      });
    } else {
      const el = document.createElement('textarea');
      el.value = info.referralLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      copyText();
    }
  };

  const handleShare = () => {
    if (!info?.referralLink) return;
    const text = `🎰 انضم إلى RewardSpin واربح نقاط يومياً!\nاحصل على مكافأة ترحيبية 🎁\n${info.referralLink}`;
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(info.referralLink)}&text=${encodeURIComponent('🎰 انضم وابدأ الربح فوراً!')}`);
    } else if (navigator.share) {
      navigator.share({ title: 'RewardSpin', text, url: info.referralLink });
    } else { handleCopy(); }
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  return (
    <div style={{ padding: '0 0 24px', position: 'relative', zIndex: 1 }}>
      {/* Hero */}
      <div style={{ padding: '24px 20px 0', textAlign: 'center' }}>
        <div style={{ fontSize: '52px', marginBottom: '12px' }}>👥</div>
        <h1 style={{ fontSize: '22px', fontWeight: '900', background: 'linear-gradient(135deg,#10b981,#3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          ادعُ أصدقاءك واربح
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '6px', lineHeight: '1.6' }}>
          شارك رابطك الخاص واكسب نقاط لا محدودة
        </p>
      </div>

      {/* Rewards Banner */}
      <div style={{ margin: '20px 16px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '16px', padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: '900', color: '#a78bfa' }}>+100</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>نقطة لك عند تسجيل صديق</div>
          </div>
          <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '16px', padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: '900', color: '#34d399' }}>+50</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>نقطة ترحيب لصديقك</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ margin: '12px 16px 0' }}>
        <div className="stats-grid" style={{ padding: 0 }}>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#10b981', fontSize: '28px' }}>{info?.referralCount || 0}</div>
            <div className="stat-label">أصدقاء انضموا</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#f59e0b', fontSize: '28px' }}>{(info?.pointsEarned || 0).toLocaleString()}</div>
            <div className="stat-label">نقاط ربحتها</div>
          </div>
        </div>
      </div>

      {/* Share Card */}
      <div style={{ margin: '16px' }}>
        <div className="card card-purple">
          <div className="section-header">
            <div className="section-icon green">🔗</div>
            <div>
              <div className="section-title">رابط الدعوة الخاص بك</div>
              <div className="section-subtitle">شاركه مع أصدقائك</div>
            </div>
          </div>
          <div className="referral-link-box">
            {info?.referralLink || 'جاري التحميل...'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button className="glow-btn" onClick={handleCopy} style={{ fontSize: '14px', padding: '12px' }}>
              {copied ? '✅ تم!' : '📋 نسخ'}
            </button>
            <button className="glow-btn green" onClick={handleShare} style={{ fontSize: '14px', padding: '12px' }}>
              📤 مشاركة
            </button>
          </div>
        </div>
      </div>

      {/* Friends List */}
      {friends.length > 0 ? (
        <div style={{ margin: '0 16px' }}>
          <div className="card">
            <div className="section-header" style={{ marginBottom: '8px' }}>
              <div className="section-icon blue">👤</div>
              <div>
                <div className="section-title">الأصدقاء ({friends.length})</div>
              </div>
            </div>
            {friends.map((f, i) => (
              <div key={i} className="friend-item" style={{ borderBottom: i < friends.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <div className="friend-avatar">👤</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '600' }}>{f.firstName} {f.lastName}</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                    {f.username ? `@${f.username}` : 'بدون يوزر'} · {new Date(f.joinedAt).toLocaleDateString('ar')}
                  </div>
                </div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#10b981' }}>+{f.pointsAwarded}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ margin: '0 16px' }}>
          <div className="card" style={{ textAlign: 'center', padding: '32px' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🤝</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>لم تدعُ أي صديق بعد</div>
            <div style={{ color: '#8b5cf6', fontSize: '13px', marginTop: '6px' }}>شارك رابطك وابدأ الربح!</div>
          </div>
        </div>
      )}

      {/* How it works */}
      <div style={{ margin: '16px' }}>
        <div className="card">
          <div style={{ fontSize: '14px', fontWeight: '700', color: 'rgba(255,255,255,0.7)', marginBottom: '12px' }}>📋 كيف يعمل؟</div>
          {[
            ['1️⃣', 'انسخ رابطك أو اضغط مشاركة'],
            ['2️⃣', 'يسجل صديقك عبر رابطك'],
            ['3️⃣', 'تحصل فوراً على +100 نقطة'],
            ['4️⃣', 'صديقك يحصل على +50 نقطة ترحيب'],
          ].map(([num, text], i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '8px 0', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
              <span style={{ fontSize: '18px', flexShrink: 0 }}>{num}</span>
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.5' }}>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Referral;
