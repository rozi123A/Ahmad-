const express = require('express');
const pool = require('../config/db');
const User = require('../models/User');
const Withdraw = require('../models/Withdraw');
const AdsHistory = require('../models/AdsHistory');
const Notification = require('../models/Notification');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { sendNotification, broadcastMessage } = require('../services/telegramService');

const router = express.Router();

router.use(authMiddleware, adminMiddleware);

router.get('/dashboard', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [totalUsers, totalWithdrawals, pendingWithdrawals, totalStarsPaid, todayAdsWatched, newUsersToday, referralsResult] =
      await Promise.all([
        User.countDocuments(),
        Withdraw.countDocuments(),
        Withdraw.countDocuments({ status: 'pending' }),
        Withdraw.sumApprovedStars(),
        AdsHistory.sumTodayAds(today),
        User.countDocuments({ createdAt: { $gte: new Date(today) } }),
        pool.query('SELECT COUNT(*) FROM referrals'),
      ]);

    res.json({
      totalUsers,
      newUsersToday,
      totalWithdrawals,
      pendingWithdrawals,
      totalStarsPaid,
      todayAdsWatched,
      totalReferrals: parseInt(referralsResult.rows[0].count) || 0,
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { telegramId: search },
      ];
    }

    const users = await User.find(query, { limit: parseInt(limit), offset: (page - 1) * limit });
    const total = await User.countDocuments(query);

    res.json({ users, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

router.post('/users/:id/ban', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.isBanned = !user.isBanned;
    await User.save(user);

    res.json({ success: true, isBanned: user.isBanned });
  } catch (error) {
    console.error('Admin ban error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.post('/users/:id/balance', async (req, res) => {
  try {
    const { amount, action } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (action === 'set') {
      user.points = parseInt(amount);
    } else if (action === 'subtract') {
      user.points = Math.max(0, user.points - parseInt(amount));
    } else {
      user.points = user.points + parseInt(amount);
    }
    await User.save(user);

    res.json({ success: true, newBalance: user.points });
  } catch (error) {
    console.error('Admin balance error:', error);
    res.status(500).json({ error: 'Failed to update balance' });
  }
});

router.get('/withdrawals', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = status ? { status } : {};

    const withdrawals = await Withdraw.find(query, { limit: parseInt(limit), offset: (page - 1) * limit });
    const total = await Withdraw.countDocuments(query);

    res.json({ withdrawals, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('Admin withdrawals error:', error);
    res.status(500).json({ error: 'Failed to get withdrawals' });
  }
});

router.post('/withdrawals/:id/process', async (req, res) => {
  try {
    const { action, note } = req.body;
    const withdrawal = await Withdraw.findById(req.params.id);

    if (!withdrawal) return res.status(404).json({ error: 'Withdrawal not found' });
    if (withdrawal.status !== 'pending') return res.status(400).json({ error: 'Already processed' });

    withdrawal.status = action === 'approve' ? 'approved' : 'rejected';
    withdrawal.adminNote = note || '';
    withdrawal.processedAt = new Date();
    await Withdraw.save(withdrawal);

    if (action === 'approve') {
      await User.findByIdAndUpdate(withdrawal.userId, {
        $inc: { points: -withdrawal.amount, totalWithdrawn: withdrawal.amount }
      });

      await sendNotification(
        withdrawal.telegramId,
        '✅ تم قبول طلب السحب',
        `تم تحويل ${withdrawal.stars} Stars إلى حسابك.`
      );

      await Notification.create({
        userId: withdrawal.userId,
        telegramId: withdrawal.telegramId,
        type: 'withdraw_approved',
        title: 'تم قبول طلب السحب',
        message: `تم تحويل ${withdrawal.stars} Stars إلى حسابك.`,
      });
    } else {
      await sendNotification(
        withdrawal.telegramId,
        '❌ تم رفض طلب السحب',
        `السبب: ${note || 'لم يتم تحديد سبب'}`
      );

      await Notification.create({
        userId: withdrawal.userId,
        telegramId: withdrawal.telegramId,
        type: 'withdraw_rejected',
        title: 'تم رفض طلب السحب',
        message: `السبب: ${note || 'لم يتم تحديد سبب'}`,
      });
    }

    res.json({ success: true, withdrawal });
  } catch (error) {
    console.error('Admin process withdrawal error:', error);
    res.status(500).json({ error: 'Failed to process withdrawal' });
  }
});

router.post('/broadcast', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const users = await User.find({ isBanned: false });
    const userIds = users.map(u => u.telegramId);

    const results = await broadcastMessage(userIds, message);

    const notifications = users.map(u => ({
      userId: u._id,
      telegramId: u.telegramId,
      type: 'broadcast',
      title: '📢 إشعار عام',
      message,
    }));
    await Notification.insertMany(notifications);

    res.json({ success: true, ...results, totalUsers: userIds.length });
  } catch (error) {
    console.error('Admin broadcast error:', error);
    res.status(500).json({ error: 'Failed to send broadcast' });
  }
});

router.post('/send-message/:telegramId', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });
    await sendNotification(req.params.telegramId, '💬 رسالة من الإدارة', message);
    res.json({ success: true });
  } catch (error) {
    console.error('Admin send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;
