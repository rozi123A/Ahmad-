const mongoose = require('mongoose');

const adsHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  telegramId: { type: String, required: true },
  adsWatched: { type: Number, default: 0 },
  pointsEarned: { type: Number, default: 0 },
  date: { type: String, required: true },
  history: [{
    watchedAt: { type: Date, default: Date.now },
    points: Number,
    adId: String,
    completed: { type: Boolean, default: true }
  }]
});

adsHistorySchema.index({ telegramId: 1, date: 1 });

module.exports = mongoose.model('AdsHistory', adsHistorySchema);
