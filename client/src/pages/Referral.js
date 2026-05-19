import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getReferralInfo, getReferralList } from '../services/api';

function Referral({ user }) {
  const [info, setInfo] = useState(null);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [infoRes, listRes] = await Promise.all([getReferralInfo(), getReferralList()]);
      setInfo(infoRes.data);
      setFriends(listRes.data.referrals || []);
    } catch (err) {
      toast.error('حدث خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!info?.referralLink) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(info.referralLink).then(() => {
        setCopied(true);
        toast.success('✅ تم نسخ الرابط!');
        setTimeout(() => setCopied(false), 2000);
      });
    } else {
      const el = document.createElement('textarea');
      el.value = info.referralLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      toast.success('✅ تم نسخ الرابط!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = () => {
    if (!info?.referralLink) return;
    const shareText = `🎰 انضم إلى RewardSpin واربح نقاط يومياً!\nسجّل عبر رابطي واحصل على مكافأة ترحيبية 🎁\n${info.referralLink}`;
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(info.referralLink)}&text=${encodeURIComponent('🎰 انضم إلى RewardSpin واربح! سجّل عبر رابطي 🎁')}`);
    } else if (navigator.share) {
      navigator.share({ title: 'RewardSpin', text: shareText, url: info.referralLink });
    } else {
      handleCopy();
    }
  };

  if (loading) {
    return <div className="loading-screen"><div className="spinner"></div></div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1 className="page-title">👥 ادعُ أصدقاءك</h1>

      <div className="neon-card" style={{ textAlign: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎁</div>
        <h3 style={{ color: 'var(--neon-gold)', fontSize: '18px', marginBottom: '8px' }}>
          اربح 100 نقطة لكل صديق!
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          شارك رابطك الخاص وستحصل على 100 نقطة فور تسجيل كل صديق
        </p>
      </div>

      <div className="stats-grid" style={{ marginBottom: '16px' }}>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--neon-green)' }}>{info?.referralCount || 0}</div>
          <div className="stat-label">أصدقاء انضموا</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--neon-gold)' }}>{info?.pointsEarned || 0}</div>
          <div className="stat-label">نقاط ربحتها</div>
        </div>
      </div>

      <div className="neon-card">
        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '8px' }}>رابط الدعوة الخاص بك:</p>
        <div style={{
          background: 'var(--bg-primary)',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '12px',
          wordBreak: 'break-all',
          fontSize: '12px',
          color: 'var(--neon-blue)',
          border: '1px solid rgba(0,212,255,0.2)',
          direction: 'ltr',
          textAlign: 'left',
        }}>
          {info?.referralLink || 'جاري التحميل...'}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="glow-btn" onClick={handleCopy} style={{ flex: 1 }}>
            {copied ? '✅ تم النسخ!' : '📋 نسخ الرابط'}
          </button>
          <button className="glow-btn green" onClick={handleShare} style={{ flex: 1 }}>
            📤 مشاركة
          </button>
        </div>
      </div>

      {friends.length > 0 && (
        <div className="neon-card">
          <h3 style={{ color: 'var(--neon-blue)', marginBottom: '12px', fontSize: '15px' }}>
            👥 الأصدقاء الذين دعوتهم ({friends.length})
          </h3>
          {friends.map((f, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 0',
              borderBottom: i < friends.length - 1 ? '1px solid rgba(0,212,255,0.1)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--neon-blue), var(--neon-purple))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                }}>
                  👤
                </div>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '600' }}>
                    {f.firstName} {f.lastName}
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {f.username ? `@${f.username}` : 'بدون يوزر'} · {new Date(f.joinedAt).toLocaleDateString('ar')}
                  </p>
                </div>
              </div>
              <span style={{
                color: 'var(--neon-green)',
                fontSize: '14px',
                fontWeight: '700',
              }}>
                +{f.pointsAwarded} pts
              </span>
            </div>
          ))}
        </div>
      )}

      {friends.length === 0 && (
        <div className="neon-card" style={{ textAlign: 'center', marginTop: '8px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            لم تدعُ أي صديق بعد 😊
          </p>
          <p style={{ color: 'var(--neon-blue)', fontSize: '13px', marginTop: '8px' }}>
            شارك رابطك وابدأ بربح النقاط!
          </p>
        </div>
      )}

      <div className="neon-card" style={{ marginTop: '8px' }}>
        <h3 style={{ color: 'var(--neon-purple)', marginBottom: '8px', fontSize: '14px' }}>📋 كيف يعمل النظام؟</h3>
        <div style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.8' }}>
          <p>1️⃣ انسخ رابطك الخاص واشاركه مع أصدقائك</p>
          <p>2️⃣ عندما يسجل صديق عبر رابطك تحصل على +100 نقطة فوراً</p>
          <p>3️⃣ ستصلك إشعار فور انضمام كل صديق</p>
          <p>4️⃣ لا يوجد حد أقصى للمكافآت - كلما زاد أصدقاؤك زادت نقاطك!</p>
        </div>
      </div>
    </div>
  );
}

export default Referral;
