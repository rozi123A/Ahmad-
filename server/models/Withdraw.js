const mongoose = require('mongoose');

const withdrawSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  telegramId: { type: String, required: true },
  username: { type: String, default: '' },
  amount: { type: Number, required: true },
  stars: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  adminNote: { type: String, default: '' },
  processedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

withdrawSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Withdraw', withdrawSchema);
