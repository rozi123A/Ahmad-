const express = require('express');
const User = require('../models/User');
const AdsHistory = require('../models/AdsHistory');
const adsService = require('../services/adsService');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const getTodayString = () => new Date().toISOString().split('T')[0];

router.get('/status', authMiddleware, async (req, res) => {
  try {
    const today = getTodayString();
    const adsRecord = await AdsHistory.findOne({ telegramId: req.user.telegramId, date: today });

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

// Start an ad session — returns a server-side token to verify real watch time
router.post('/start', authMiddleware, async (req, res) => {
  try {
    const token = adsService.startSession(req.user.telegramId);
    res.json({ sessionToken: token });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start ad session' });
  }
});

router.post('/complete', authMiddleware, async (req, res) => {
  try {
    const { adId, watchDuration, sessionToken } = req.body;
    const today = getTodayString();

    const verification = await adsService.verifyAdCompletion(adId, req.user.telegramId, watchDuration, sessionToken);
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
      });
    }

    if (adsRecord.adsWatched >= adsService.getDailyLimit()) {
      return res.status(400).json({ error: 'Daily ad limit reached' });
    }

    const points = adsService.getPointsPerAd();
    const newAdsWatched = adsRecord.adsWatched + 1;
    const newPointsEarned = adsRecord.pointsEarned + points;

    await AdsHistory.updateAds(adsRecord._id, newAdsWatched, newPointsEarned);

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { points, totalEarned: points } }
    );

    res.json({
      success: true,
      points,
      newBalance: user.points,
      adsRemaining: Math.max(0, adsService.getDailyLimit() - newAdsWatched),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record ad completion' });
  }
});

router.get('/config', authMiddleware, async (req, res) => {
  try {
    const adUnit = await adsService.getAdUnit(req.user.telegramId);
    res.json(adUnit);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get ad config' });
  }
});

module.exports = router;
