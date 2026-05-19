const express = require('express');
const User = require('../models/User');
const Spins = require('../models/Spins');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const DAILY_FREE_SPINS = 5;
const DAILY_AD_SPINS = 5;
const PRIZES = [50, 75, 100, 200, 500];
const PRIZE_WEIGHTS = [35, 30, 20, 10, 5];

const getRandomPrize = () => {
  const totalWeight = PRIZE_WEIGHTS.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;
  for (let i = 0; i < PRIZES.length; i++) {
    random -= PRIZE_WEIGHTS[i];
    if (random <= 0) return PRIZES[i];
  }
  return PRIZES[0];
};

const getTodayString = () => new Date().toISOString().split('T')[0];

router.get('/status', authMiddleware, async (req, res) => {
  try {
    const today = getTodayString();
    const spinRecord = await Spins.findOne({ telegramId: req.user.telegramId, lastSpinDate: today });

    if (!spinRecord) {
      return res.json({
        freeSpinsLeft: DAILY_FREE_SPINS,
        adSpinsLeft: DAILY_AD_SPINS,
        spinsUsed: 0,
        adSpinsUsed: 0,
      });
    }

    res.json({
      freeSpinsLeft: Math.max(0, DAILY_FREE_SPINS - spinRecord.spinsUsed),
      adSpinsLeft: Math.max(0, DAILY_AD_SPINS - spinRecord.adSpinsUsed),
      spinsUsed: spinRecord.spinsUsed,
      adSpinsUsed: spinRecord.adSpinsUsed,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get spin status' });
  }
});

router.post('/play', authMiddleware, async (req, res) => {
  try {
    const { isAdSpin } = req.body;
    const today = getTodayString();

    let spinRecord = await Spins.findOne({ telegramId: req.user.telegramId, lastSpinDate: today });

    if (!spinRecord) {
      spinRecord = await Spins.create({
        userId: req.user._id,
        telegramId: req.user.telegramId,
        lastSpinDate: today,
        spinsUsed: 0,
        adSpinsUsed: 0,
      });
    }

    if (isAdSpin) {
      if (spinRecord.adSpinsUsed >= DAILY_AD_SPINS) {
        return res.status(400).json({ error: 'No ad spins left today' });
      }
    } else {
      if (spinRecord.spinsUsed >= DAILY_FREE_SPINS) {
        return res.status(400).json({ error: 'No free spins left today', needAd: true });
      }
    }

    const prize = getRandomPrize();

    const newSpinsUsed = isAdSpin ? spinRecord.spinsUsed : spinRecord.spinsUsed + 1;
    const newAdSpinsUsed = isAdSpin ? spinRecord.adSpinsUsed + 1 : spinRecord.adSpinsUsed;
    await Spins.updateSpins(spinRecord._id, newSpinsUsed, newAdSpinsUsed);

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { points: prize, totalEarned: prize } }
    );

    res.json({
      success: true,
      prize,
      newBalance: user.points,
      freeSpinsLeft: Math.max(0, DAILY_FREE_SPINS - newSpinsUsed),
      adSpinsLeft: Math.max(0, DAILY_AD_SPINS - newAdSpinsUsed),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to spin' });
  }
});

module.exports = router;
