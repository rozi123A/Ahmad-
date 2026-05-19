const express = require('express');
const User = require('../models/User');
const AdsHistory = require('../models/AdsHistory');
const adsService = require('../services/adsService');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const getTodayString = () => new Date().toISOString().split('T')[0];

// GET /api/ads/status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const today = getTodayString();
    let adsRecord = await AdsHistory.findOne({ telegramId: req.user.telegramId, date: today });

    const dailyLimit = adsService.getDailyLimit();
    const adsWatched = adsRecord ? adsRecord.adsWatched : 0;

    res.json({
      adsWatched,
      adsRemaining: Math.max(0, dailyLimit - adsWatched),
      dailyLimit,
      pointsPerAd: adsService.getPointsPerAd(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get ads status' });
  }
});

// POST /api/ads/complete
router.post('/complete', authMiddleware, async (req, res) => {
  try {
    const { adId, watchDuration } = req.body;
    const today = getTodayString();

    // Verify ad completion
    const verification = await adsService.verifyAdCompletion(adId, req.user.telegramId, watchDuration);
    
    if (!verification.valid) {
      return res.status(400).json({ error: verification.reason || 'Ad not completed' });
    }

    let adsRecord = await AdsHistory.findOne({ telegramId: req.user.telegramId, date: today });

    if (!adsRecord) {
      adsRecord = await AdsHistory.create({
        userId: req.user._id,
        telegramId: req.user.telegramId,
        date: today,
        adsWatched: 0,
        pointsEarned: 0,
        history: [],
      });
    }

    if (adsRecord.adsWatched >= adsService.getDailyLimit()) {
      return res.status(400).json({ error: 'Daily ad limit reached' });
    }

    const points = adsService.getPointsPerAd();

    adsRecord.adsWatched += 1;
    adsRecord.pointsEarned += points;
    adsRecord.history.push({ points, adId: adId || 'rewarded', completed: true });
    await adsRecord.save();

    // Update user points
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { points, totalEarned: points } },
      { new: true }
    );

    res.json({
      success: true,
      points,
      newBalance: user.points,
      adsRemaining: Math.max(0, adsService.getDailyLimit() - adsRecord.adsWatched),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record ad completion' });
  }
});

// GET /api/ads/config
router.get('/config', authMiddleware, async (req, res) => {
  try {
    const adUnit = await adsService.getAdUnit(req.user.telegramId);
    res.json(adUnit);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get ad config' });
  }
});

module.exports = router;
