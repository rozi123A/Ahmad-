const express = require('express');
const pool = require('../config/db');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const DAILY_FREE_SPINS = 5;
const DAILY_AD_SPINS = 5;
const PRIZES = [50, 200, 100, 500, 75, 1000, 150, 250];
const PRIZE_WEIGHTS = [28, 12, 20, 6, 15, 2, 12, 5];

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
    const result = await pool.query(
      'SELECT * FROM spins WHERE telegram_id = $1 AND last_spin_date = $2 LIMIT 1',
      [req.user.telegramId, today]
    );

    if (!result.rows[0]) {
      return res.json({
        freeSpinsLeft: DAILY_FREE_SPINS,
        adSpinsLeft: DAILY_AD_SPINS,
        spinsUsed: 0,
        adSpinsUsed: 0,
      });
    }

    const row = result.rows[0];
    res.json({
      freeSpinsLeft: Math.max(0, DAILY_FREE_SPINS - row.spins_used),
      adSpinsLeft: Math.max(0, DAILY_AD_SPINS - row.ad_spins_used),
      spinsUsed: row.spins_used,
      adSpinsUsed: row.ad_spins_used,
    });
  } catch (error) {
    console.error('Spin status error:', error);
    res.status(500).json({ error: 'Failed to get spin status' });
  }
});

router.post('/play', authMiddleware, async (req, res) => {
  try {
    const { isAdSpin } = req.body;
    const today = getTodayString();
    const telegramId = req.user.telegramId;
    const userId = req.user._id;

    const result = await pool.query(
      'SELECT * FROM spins WHERE telegram_id = $1 AND last_spin_date = $2 LIMIT 1',
      [telegramId, today]
    );

    let spinsUsed = 0;
    let adSpinsUsed = 0;
    let spinId = null;

    if (result.rows[0]) {
      spinsUsed = result.rows[0].spins_used;
      adSpinsUsed = result.rows[0].ad_spins_used;
      spinId = result.rows[0].id;
    }

    if (isAdSpin) {
      if (adSpinsUsed >= DAILY_AD_SPINS) {
        return res.status(400).json({ error: 'لا توجد دورات إعلانية متبقية اليوم!' });
      }
    } else {
      if (spinsUsed >= DAILY_FREE_SPINS) {
        return res.status(400).json({ error: 'لا توجد دورات مجانية متبقية اليوم!', needAd: true });
      }
    }

    const prize = getRandomPrize();
    const newSpinsUsed = isAdSpin ? spinsUsed : spinsUsed + 1;
    const newAdSpinsUsed = isAdSpin ? adSpinsUsed + 1 : adSpinsUsed;

    if (spinId) {
      await pool.query(
        'UPDATE spins SET spins_used = $1, ad_spins_used = $2 WHERE id = $3',
        [newSpinsUsed, newAdSpinsUsed, spinId]
      );
    } else {
      await pool.query(
        `INSERT INTO spins (user_id, telegram_id, spins_used, ad_spins_used, last_spin_date)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (telegram_id, last_spin_date)
         DO UPDATE SET spins_used = EXCLUDED.spins_used, ad_spins_used = EXCLUDED.ad_spins_used`,
        [userId, telegramId, newSpinsUsed, newAdSpinsUsed, today]
      );
    }

    const updatedUser = await pool.query(
      'UPDATE users SET points = points + $1, total_earned = total_earned + $1 WHERE id = $2 RETURNING points',
      [prize, userId]
    );

    const newBalance = updatedUser.rows[0].points;

    res.json({
      success: true,
      prize,
      newBalance,
      freeSpinsLeft: Math.max(0, DAILY_FREE_SPINS - newSpinsUsed),
      adSpinsLeft: Math.max(0, DAILY_AD_SPINS - newAdSpinsUsed),
    });
  } catch (error) {
    console.error('Spin play error:', error);
    res.status(500).json({ error: 'Failed to spin' });
  }
});

module.exports = router;
