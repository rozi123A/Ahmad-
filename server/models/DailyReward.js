const mongoose = require('mongoose');

const dailyRewardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  telegramId: { type: String, required: true },
  amount: { type: Number, default: 100 },
  claimedAt: { type: Date, default: Date.now },
});

dailyRewardSchema.index({ telegramId: 1, claimedAt: -1 });

module.exports = mongoose.model('DailyReward', dailyRewardSchema);
