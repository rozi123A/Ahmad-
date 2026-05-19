const express = require('express');
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/info', authMiddleware, async (req, res) => {
  try {
    const telegramId = req.user.telegramId;
    const botUsername = process.env.BOT_USERNAME || process.env.TELEGRAM_BOT || 'YourBot';

    const refRes = await pool.query(
      'SELECT COUNT(*) as count, COALESCE(SUM(points_awarded), 0) as total_points FROM referrals WHERE referrer_telegram_id = $1',
      [telegramId]
    );

    const referralCount = parseInt(refRes.rows[0].count) || 0;
    const pointsEarned = parseInt(refRes.rows[0].total_points) || 0;

    const referralLink = `https://t.me/${botUsername}?start=${telegramId}`;

    res.json({
      referralCode: telegramId,
      referralLink,
      referralCount,
      pointsEarned,
      pointsPerReferral: 100,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get referral info' });
  }
});

router.get('/list', authMiddleware, async (req, res) => {
  try {
    const telegramId = req.user.telegramId;

    const result = await pool.query(
      `SELECT r.referred_telegram_id, r.points_awarded, r.created_at,
              u.first_name, u.last_name, u.username
       FROM referrals r
       LEFT JOIN users u ON u.telegram_id = r.referred_telegram_id
       WHERE r.referrer_telegram_id = $1
       ORDER BY r.created_at DESC
       LIMIT 50`,
      [telegramId]
    );

    res.json({
      referrals: result.rows.map(r => ({
        telegramId: r.referred_telegram_id,
        firstName: r.first_name || 'مستخدم',
        lastName: r.last_name || '',
        username: r.username || '',
        pointsAwarded: r.points_awarded,
        joinedAt: r.created_at,
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get referral list' });
  }
});

module.exports = router;
