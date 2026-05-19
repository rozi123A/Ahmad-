const express = require('express');
const Notification = require('../models/Notification');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.find({ telegramId: req.user.telegramId }, { limit: 50 });

    const unreadCount = await Notification.countDocuments({
      telegramId: req.user.telegramId,
      read: false,
    });

    res.json({ notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

router.post('/read-all', authMiddleware, async (req, res) => {
  try {
    await Notification.updateMany(
      { telegramId: req.user.telegramId, read: false },
      { read: true }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

module.exports = router;
