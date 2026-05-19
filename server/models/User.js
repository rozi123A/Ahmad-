const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  username: { type: String, default: '' },
  firstName: { type: String, default: '' },
  lastName: { type: String, default: '' },
  photoUrl: { type: String, default: '' },
  points: { type: Number, default: 0 },
  totalEarned: { type: Number, default: 0 },
  totalWithdrawn: { type: Number, default: 0 },
  isBanned: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  lastLogin: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', userSchema);
