const express = require('express');
const User = require('../models/User');
const Withdraw = require('../models/Withdraw');
const AdsHistory = require('../models/AdsHistory');
const Notification = require('../models/Notification');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { sendNotification, broadcastMessage } = require('../services/telegramService');

const router = express.Router();

// All admin routes require auth + admin
router.use(authMiddleware, adminMiddleware);

// GET /api/admin/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalWithdrawals = await Withdraw.countDocuments();
    const pendingWithdrawals = await Withdraw.countDocuments({ status: 'pending' });
    const approvedWithdrawals = await Withdraw.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$stars' } } }
    ]);
    
    const today = new Date().toISOString().split('T')[0];
    const todayAds = await AdsHistory.aggregate([
      { $match: { date: today } },
      { $group: { _id: null, total: { $sum: '$adsWatched' } } }
    ]);

    const newUsersToday = await User.countDocuments({
      createdAt: { $gte: new Date(today) }
    });

    res.json({
      totalUsers,
      newUsersToday,
      totalWithdrawals,
      pendingWithdrawals,
      totalStarsPaid: approvedWithdrawals[0]?.total || 0,
      todayAdsWatched: todayAds[0]?.total || 0,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
});

// GET /api/admin/users
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

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({ users, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// POST /api/admin/users/:id/ban
router.post('/users/:id/ban', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.isBanned = !user.isBanned;
    await user.save();

    res.json({ success: true, isBanned: user.isBanned });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// POST /api/admin/users/:id/balance
router.post('/users/:id/balance', async (req, res) => {
  try {
    const { amount, action } = req.body; // action: 'add' or 'set'
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (action === 'set') {
      user.points = amount;
    } else {
      user.points += amount;
    }
    await user.save();

    res.json({ success: true, newBalance: user.points });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update balance' });
  }
});

// GET /api/admin/withdrawals
router.get('/withdrawals', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = status ? { status } : {};

    const withdrawals = await Withdraw.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Withdraw.countDocuments(query);

    res.json({ withdrawals, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get withdrawals' });
  }
});

// POST /api/admin/withdrawals/:id/process
router.post('/withdrawals/:id/process', async (req, res) => {
  try {
    const { action, note } = req.body; // action: 'approve' or 'reject'
    const withdrawal = await Withdraw.findById(req.params.id);
    
    if (!withdrawal) return res.status(404).json({ error: 'Withdrawal not found' });
    if (withdrawal.status !== 'pending') return res.status(400).json({ error: 'Already processed' });

    withdrawal.status = action === 'approve' ? 'approved' : 'rejected';
    withdrawal.adminNote = note || '';
    withdrawal.processedAt = new Date();
    await withdrawal.save();

    if (action === 'approve') {
      // Deduct points
      await User.findByIdAndUpdate(withdrawal.userId, {
        $inc: { points: -withdrawal.amount, totalWithdrawn: withdrawal.amount }
      });

      // Send notification
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
    res.status(500).json({ error: 'Failed to process withdrawal' });
  }
});

// POST /api/admin/broadcast
router.post('/broadcast', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const users = await User.find({ isBanned: false }).select('telegramId');
    const userIds = users.map(u => u.telegramId);

    const results = await broadcastMessage(userIds, message);

    // Save notification for all users
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
    res.status(500).json({ error: 'Failed to send broadcast' });
  }
});

// GET /api/admin/chat/:telegramId
router.get('/chat/:telegramId', async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: req.params.telegramId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      user: {
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        chatLink: `https://t.me/${user.username}`,
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get chat info' });
  }
});

// POST /api/admin/send-message/:telegramId
router.post('/send-message/:telegramId', async (req, res) => {
  try {
    const { message } = req.body;
    await sendNotification(req.params.telegramId, '💬 رسالة من الإدارة', message);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;
