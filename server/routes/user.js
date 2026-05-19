const express = require('express');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    res.json({
      id: user._id,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      photoUrl: user.photoUrl,
      points: user.points,
      totalEarned: user.totalEarned,
      totalWithdrawn: user.totalWithdrawn,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

router.get('/balance', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ points: user.points, totalEarned: user.totalEarned, totalWithdrawn: user.totalWithdrawn });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

module.exports = router;
