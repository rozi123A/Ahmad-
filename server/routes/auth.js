const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const pool = require('../config/db');
const { verifyTelegramData } = require('../middleware/auth');
const { sendNotification } = require('../services/telegramService');

const router = express.Router();

router.post('/telegram', async (req, res) => {
  try {
    const { initData, user: telegramUser, startParam } = req.body;

    if (!telegramUser || !telegramUser.id) {
      return res.status(400).json({ error: 'Invalid user data' });
    }

    if (!process.env.DATABASE_URL) {
      return res.status(503).json({ error: 'Database not configured. Please contact the administrator.' });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(503).json({ error: 'Server misconfiguration. Please contact the administrator.' });
    }

    if (process.env.NODE_ENV === 'production' && initData) {
      const isValid = verifyTelegramData(initData);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid Telegram data' });
      }
    }

    const telegramId = telegramUser.id.toString();
    const adminIds = process.env.ADMIN_TELEGRAM_IDS?.split(',').map(s => s.trim()) || [];

    let user = await User.findOne({ telegramId });

    if (!user) {
      const referredBy = (startParam && startParam !== telegramId) ? startParam : '';
      user = await User.create({
        telegramId,
        username: telegramUser.username || '',
        firstName: telegramUser.first_name || '',
        lastName: telegramUser.last_name || '',
        photoUrl: telegramUser.photo_url || '',
        isAdmin: adminIds.includes(telegramId),
        referredBy,
      });

      if (referredBy) {
        const referrer = await User.findOne({ telegramId: referredBy });
        if (referrer && !referrer.isBanned) {
          await User.findByIdAndUpdate(referrer._id, { $inc: { points: 100, totalEarned: 100 } });
          await pool.query(
            'INSERT INTO referrals (referrer_telegram_id, referred_telegram_id, points_awarded) VALUES ($1, $2, 100) ON CONFLICT (referred_telegram_id) DO NOTHING',
            [referredBy, telegramId]
          );
          await pool.query(
            'INSERT INTO notifications (user_id, telegram_id, type, title, message) VALUES ($1, $2, $3, $4, $5)',
            [
              referrer._id,
              referrer.telegramId,
              'referral',
              '🎉 صديق جديد انضم!',
              `انضم ${telegramUser.first_name || 'مستخدم جديد'} عبر رابطك! حصلت على +100 نقطة 🎁`,
            ]
          );
          await sendNotification(
            referrer.telegramId,
            '🎉 صديق جديد انضم!',
            `انضم ${telegramUser.first_name || 'مستخدم جديد'} عبر رابطك!\n\nحصلت على +100 نقطة مكافأة 🎁`
          );
        }
      }
    } else {
      user.username = telegramUser.username || user.username;
      user.firstName = telegramUser.first_name || user.firstName;
      user.lastName = telegramUser.last_name || user.lastName;
      user.photoUrl = telegramUser.photo_url || user.photoUrl;
      user.lastLogin = new Date();
      user.isAdmin = adminIds.includes(telegramId);
      await User.save(user);
    }

    if (user.isBanned) {
      return res.status(403).json({ error: 'Account is banned' });
    }

    const token = jwt.sign(
      { telegramId: user.telegramId, userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        photoUrl: user.photoUrl,
        points: user.points,
        isAdmin: user.isAdmin,
      }
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed. Please try again.' });
  }
});

module.exports = router;
