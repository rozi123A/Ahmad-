const express = require('express');
const User = require('../models/User');
const Withdraw = require('../models/Withdraw');
const Notification = require('../models/Notification');
const { authMiddleware } = require('../middleware/auth');
const { sendNotification } = require('../services/telegramService');

const router = express.Router();

const MIN_WITHDRAW = 10000; // 10000 pts
const STARS_RATE = 1000; // 1000 pts = 1 Star

// GET /api/withdraw/info
router.get('/info', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const pendingWithdrawals = await Withdraw.countDocuments({
      telegramId: user.telegramId,
      status: 'pending'
    });

    res.json({
      balance: user.points,
      minWithdraw: MIN_WITHDRAW,
      starsRate: STARS_RATE,
      canWithdraw: user.points >= MIN_WITHDRAW && pendingWithdrawals === 0,
      pendingRequests: pendingWithdrawals,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get withdraw info' });
  }
});

// POST /api/withdraw/request
router.post('/request', authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    const user = req.user;

    if (!amount || amount < MIN_WITHDRAW) {
      return res.status(400).json({ error: `Minimum withdrawal is ${MIN_WITHDRAW} pts` });
    }

    if (user.points < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Check for pending requests
    const pendingExists = await Withdraw.findOne({
      telegramId: user.telegramId,
      status: 'pending'
    });

    if (pendingExists) {
      return res.status(400).json({ error: 'You already have a pending withdrawal request' });
    }

    const stars = Math.floor(amount / STARS_RATE);

    const withdrawal = await Withdraw.create({
      userId: user._id,
      telegramId: user.telegramId,
      username: user.username,
      amount,
      stars,
    });

    res.json({
      success: true,
      withdrawal: {
        id: withdrawal._id,
        amount: withdrawal.amount,
        stars: withdrawal.stars,
        status: withdrawal.status,
        createdAt: withdrawal.createdAt,
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create withdrawal request' });
  }
});

// GET /api/withdraw/history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const withdrawals = await Withdraw.find({ telegramId: req.user.telegramId })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json(withdrawals);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get withdrawal history' });
  }
});

module.exports = router;
