const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { verifyTelegramData } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/telegram - Authenticate via Telegram WebApp
router.post('/telegram', async (req, res) => {
  try {
    const { initData, user: telegramUser } = req.body;

    if (!telegramUser || !telegramUser.id) {
      return res.status(400).json({ error: 'Invalid user data' });
    }

    // Verify Telegram initData in production
    if (process.env.NODE_ENV === 'production' && initData) {
      const isValid = verifyTelegramData(initData);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid Telegram data' });
      }
    }

    const telegramId = telegramUser.id.toString();
    const adminIds = process.env.ADMIN_TELEGRAM_IDS?.split(',') || [];

    // Find or create user
    let user = await User.findOne({ telegramId });

    if (!user) {
      user = await User.create({
        telegramId,
        username: telegramUser.username || '',
        firstName: telegramUser.first_name || '',
        lastName: telegramUser.last_name || '',
        photoUrl: telegramUser.photo_url || '',
        isAdmin: adminIds.includes(telegramId),
      });
    } else {
      user.username = telegramUser.username || user.username;
      user.firstName = telegramUser.first_name || user.firstName;
      user.lastName = telegramUser.last_name || user.lastName;
      user.photoUrl = telegramUser.photo_url || user.photoUrl;
      user.lastLogin = new Date();
      user.isAdmin = adminIds.includes(telegramId);
      await user.save();
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
    res.status(500).json({ error: 'Authentication failed' });
  }
});

module.exports = router;
