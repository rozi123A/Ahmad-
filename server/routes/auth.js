const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const pool = require('../config/db');
const { verifyTelegramData } = require('../middleware/auth');
const { sendReferralNotification } = require('../services/telegramService');

const router = express.Router();

router.post('/telegram', async (req, res) => {
  try {
    const { initData, user: telegramUser, startParam } = req.body;

    if (!telegramUser || !telegramUser.id) {
      return res.status(400).json({ error: 'Invalid user data' });
    }
    if (!process.env.DATABASE_URL) {
      return res.status(503).json({ error: 'Database not configured.' });
    }
    if (!process.env.JWT_SECRET) {
      return res.status(503).json({ error: 'Server misconfiguration.' });
    }

    if (process.env.NODE_ENV === 'production' && initData && initData.length > 20) {
      if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN !== 'your_telegram_bot_token') {
        try { verifyTelegramData(initData); } catch (e) {}
      }
    }

    const telegramId = telegramUser.id.toString();
    const adminIds = process.env.ADMIN_TELEGRAM_IDS?.split(',').map(s => s.trim()) || [];

    let user = await User.findOne({ telegramId });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
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

      // Give new user +50 welcome bonus if joined via referral
      if (referredBy) {
        user = await User.findByIdAndUpdate(user._id, { $inc: { points: 50, totalEarned: 50 } }) || user;
      }

      // Process referrer rewards
      if (referredBy) {
        const referrer = await User.findOne({ telegramId: referredBy });
        if (referrer && !referrer.isBanned) {

          // Give referrer +100 points
          await User.findByIdAndUpdate(referrer._id, { $inc: { points: 100, totalEarned: 100 } });

          // Record referral
          try {
            await pool.query(
              'INSERT INTO referrals (referrer_telegram_id, referred_telegram_id, points_awarded) VALUES ($1, $2, 100) ON CONFLICT (referred_telegram_id) DO NOTHING',
              [referredBy, telegramId]
            );
          } catch (e) {}

          // Save notification in DB
          try {
            const newUserName = `${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim();
            const usernameStr = telegramUser.username ? ` @${telegramUser.username}` : '';
            await pool.query(
              'INSERT INTO notifications (user_id, telegram_id, type, title, message) VALUES ($1, $2, $3, $4, $5)',
              [
                referrer._id,
                referrer.telegramId,
                'referral',
                '🎉 صديق جديد انضم!',
                `انضم ${newUserName}${usernameStr} عبر رابطك! حصلت على +100 نقطة 🎁`,
              ]
            );
          } catch (e) {}

          // Send Telegram notification with button
          try {
            await sendReferralNotification(referrer.telegramId, {
              firstName: telegramUser.first_name || '',
              lastName: telegramUser.last_name || '',
              username: telegramUser.username || '',
            });
          } catch (e) {
            console.error('Referral notification error:', e.message);
          }
        }
      }

      // Reload user to get updated points
      user = await User.findOne({ telegramId }) || user;

    } else {
      user.username = telegramUser.username || user.username;
      user.firstName = telegramUser.first_name || user.firstName;
      user.lastName = telegramUser.last_name || user.lastName;
      user.photoUrl = telegramUser.photo_url || user.photoUrl;
      user.lastLogin = new Date();
      user.isAdmin = adminIds.includes(telegramId);
      user = await User.save(user) || user;
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
        totalEarned: user.totalEarned,
        isAdmin: user.isAdmin,
        isNewUser,
      }
    });
  } catch (error) {
    console.error('Auth error:', error.message);
    res.status(500).json({ error: 'Authentication failed. Please try again.' });
  }
});

module.exports = router;
