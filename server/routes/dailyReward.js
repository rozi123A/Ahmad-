const express = require('express');
const User = require('../models/User');
const DailyReward = require('../models/DailyReward');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const DAILY_REWARD_AMOUNT = 100;
const COOLDOWN_HOURS = 24;

// GET /api/daily/status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const lastClaim = await DailyReward.findOne({ telegramId: req.user.telegramId })
      .sort({ claimedAt: -1 });

    if (!lastClaim) {
      return res.json({ canClaim: true, nextClaimAt: null, lastClaimAt: null });
    }

    const nextClaimAt = new Date(lastClaim.claimedAt.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000);
    const canClaim = new Date() >= nextClaimAt;

    res.json({
      canClaim,
      nextClaimAt: canClaim ? null : nextClaimAt,
      lastClaimAt: lastClaim.claimedAt,
      amount: DAILY_REWARD_AMOUNT,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get daily reward status' });
  }
});

// POST /api/daily/claim
router.post('/claim', authMiddleware, async (req, res) => {
  try {
    const lastClaim = await DailyReward.findOne({ telegramId: req.user.telegramId })
      .sort({ claimedAt: -1 });

    if (lastClaim) {
      const nextClaimAt = new Date(lastClaim.claimedAt.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000);
      if (new Date() < nextClaimAt) {
        return res.status(400).json({ error: 'Daily reward already claimed', nextClaimAt });
      }
    }

    // Create reward record
    await DailyReward.create({
      userId: req.user._id,
      telegramId: req.user.telegramId,
      amount: DAILY_REWARD_AMOUNT,
    });

    // Update user points
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { points: DAILY_REWARD_AMOUNT, totalEarned: DAILY_REWARD_AMOUNT } },
      { new: true }
    );

    res.json({
      success: true,
      amount: DAILY_REWARD_AMOUNT,
      newBalance: user.points,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to claim daily reward' });
  }
});

module.exports = router;
