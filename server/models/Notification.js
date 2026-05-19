const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  telegramId: { type: String },
  type: { type: String, enum: ['withdraw_approved', 'withdraw_rejected', 'broadcast', 'bonus', 'system'], required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

notificationSchema.index({ telegramId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
