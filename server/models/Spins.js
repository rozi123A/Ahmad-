const mongoose = require('mongoose');

const spinsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  telegramId: { type: String, required: true },
  spinsUsed: { type: Number, default: 0 },
  adSpinsUsed: { type: Number, default: 0 },
  lastSpinDate: { type: String, required: true },
  results: [{
    amount: Number,
    timestamp: { type: Date, default: Date.now }
  }]
});

spinsSchema.index({ telegramId: 1, lastSpinDate: 1 });

module.exports = mongoose.model('Spins', spinsSchema);
