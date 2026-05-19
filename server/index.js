require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { connectDB } = require('./config/db');
const { initBot } = require('./services/telegramService');

const app = express();

connectDB().catch(err => {
  console.error('Failed to connect to PostgreSQL:', err.message);
});

initBot();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
}));

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Diagnostic endpoint - shows config status (no sensitive values)
app.get('/api/debug/config', (req, res) => {
  res.json({
    env: process.env.NODE_ENV,
    database: process.env.DATABASE_URL ? 'configured' : 'MISSING',
    jwtSecret: process.env.JWT_SECRET ? 'configured' : 'MISSING',
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ? `configured (${process.env.TELEGRAM_BOT_TOKEN.length} chars)` : 'MISSING',
    adminIds: process.env.ADMIN_TELEGRAM_IDS || 'MISSING',
    clientUrl: process.env.CLIENT_URL || 'not set',
  });
});

// DB health check
app.get('/api/debug/db', async (req, res) => {
  try {
    const pool = require('./config/db');
    const result = await pool.query('SELECT NOW() as time, current_database() as db');
    res.json({ status: 'connected', db: result.rows[0].db, time: result.rows[0].time });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/user'));
app.use('/api/daily', require('./routes/dailyReward'));
app.use('/api/spin', require('./routes/spin'));
app.use('/api/ads', require('./routes/ads'));
app.use('/api/withdraw', require('./routes/withdraw'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/referral', require('./routes/referral'));

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`🚀 RewardSpin server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Database: ${process.env.DATABASE_URL ? 'configured' : 'NOT configured'}`);
  console.log(`Telegram Bot Token: ${process.env.TELEGRAM_BOT_TOKEN ? 'configured' : 'NOT configured'}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;
