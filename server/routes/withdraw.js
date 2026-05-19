const express = require('express');
const User = require('../models/User');
const Withdraw = require('../models/Withdraw');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const getMinWithdraw = () => parseInt(process.env.MIN_WITHDRAW) || 10000;
const getStarsRate = () => parseInt(process.env.STARS_RATE) || 1000;

router.get('/info', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const MIN_WITHDRAW = getMinWithdraw();
    const STARS_RATE = getStarsRate();

    const pendingWithdrawals = await Withdraw.countDocuments({
      telegramId: user.telegramId,
      status: 'pending',
    });

    res.json({
      balance: user.points,
      minWithdraw: MIN_WITHDRAW,
      starsRate: STARS_RATE,
      canWithdraw: user.points >= MIN_WITHDRAW && pendingWithdrawals === 0,
      pendingRequests: pendingWithdrawals,
    });
  } catch (error) {
    console.error('Withdraw info error:', error.message);
    res.status(500).json({ error: 'Failed to get withdraw info' });
  }
});

router.post('/request', authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    const user = req.user;
    const MIN_WITHDRAW = getMinWithdraw();
    const STARS_RATE = getStarsRate();

    const pts = parseInt(amount);
    if (!pts || pts < MIN_WITHDRAW) {
      return res.status(400).json({ error: `الحد الأدنى للسحب ${MIN_WITHDRAW.toLocaleString()} نقطة` });
    }

    if (user.points < pts) {
      return res.status(400).json({ error: 'رصيدك غير كافٍ' });
    }

    const pendingExists = await Withdraw.findOne({
      telegramId: user.telegramId,
      status: 'pending',
    });

    if (pendingExists) {
      return res.status(400).json({ error: 'لديك طلب سحب قيد المراجعة، يرجى الانتظار' });
    }

    const stars = Math.floor(pts / STARS_RATE);

    // Deduct points immediately (hold them)
    await User.findByIdAndUpdate(user._id, { $inc: { points: -pts } });

    const withdrawal = await Withdraw.create({
      userId: user._id,
      telegramId: user.telegramId,
      username: user.username,
      amount: pts,
      stars,
    });

    res.json({
      success: true,
      message: 'تم إرسال طلب السحب بنجاح! سيتم مراجعته خلال 24 ساعة.',
      withdrawal: {
        id: withdrawal._id,
        amount: withdrawal.amount,
        stars: withdrawal.stars,
        status: withdrawal.status,
        createdAt: withdrawal.createdAt,
      },
    });
  } catch (error) {
    console.error('Withdraw request error:', error.message);
    res.status(500).json({ error: 'حدث خطأ أثناء إرسال الطلب، حاول مجدداً' });
  }
});

router.get('/history', authMiddleware, async (req, res) => {
  try {
    const withdrawals = await Withdraw.find(
      { telegramId: req.user.telegramId },
      { limit: 20 }
    );
    res.json(withdrawals);
  } catch (error) {
    console.error('Withdraw history error:', error.message);
    res.status(500).json({ error: 'Failed to get withdrawal history' });
  }
});

module.exports = router;
