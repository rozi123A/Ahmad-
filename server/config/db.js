const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.warn('⚠️ DATABASE_URL is not configured. Database features will not work.');
}

const cleanConnectionString = (url) => {
  if (!url) return url;
  return url
    .replace(/[?&]sslmode=[^&]*/g, '')
    .replace(/[?&]channel_binding=[^&]*/g, '')
    .replace(/[?&]$/, '')
    .replace(/\?$/, '');
};

const pool = new Pool({
  connectionString: cleanConnectionString(process.env.DATABASE_URL),
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err.message);
});

const initSchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      telegram_id VARCHAR(50) UNIQUE NOT NULL,
      username VARCHAR(255) DEFAULT '',
      first_name VARCHAR(255) DEFAULT '',
      last_name VARCHAR(255) DEFAULT '',
      photo_url TEXT DEFAULT '',
      points INTEGER DEFAULT 0,
      total_earned INTEGER DEFAULT 0,
      total_withdrawn INTEGER DEFAULT 0,
      is_banned BOOLEAN DEFAULT false,
      is_admin BOOLEAN DEFAULT false,
      referred_by VARCHAR(50) DEFAULT '',
      last_login TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS spins (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      telegram_id VARCHAR(50) NOT NULL,
      spins_used INTEGER DEFAULT 0,
      ad_spins_used INTEGER DEFAULT 0,
      last_spin_date VARCHAR(20) NOT NULL,
      UNIQUE(telegram_id, last_spin_date)
    );

    CREATE TABLE IF NOT EXISTS daily_rewards (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      telegram_id VARCHAR(50) NOT NULL,
      amount INTEGER DEFAULT 100,
      claimed_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS withdrawals (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      telegram_id VARCHAR(50) NOT NULL,
      username VARCHAR(255) DEFAULT '',
      amount INTEGER NOT NULL,
      stars INTEGER NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      admin_note TEXT DEFAULT '',
      processed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ads_history (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      telegram_id VARCHAR(50) NOT NULL,
      ads_watched INTEGER DEFAULT 0,
      points_earned INTEGER DEFAULT 0,
      date VARCHAR(20) NOT NULL,
      UNIQUE(telegram_id, date)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      telegram_id VARCHAR(50),
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      read BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS referrals (
      id SERIAL PRIMARY KEY,
      referrer_telegram_id VARCHAR(50) NOT NULL,
      referred_telegram_id VARCHAR(50) UNIQUE NOT NULL,
      points_awarded INTEGER DEFAULT 100,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by VARCHAR(50) DEFAULT '';`);

  console.log('✅ Database schema initialized');
};

const connectDB = async () => {
  try {
    if (!process.env.DATABASE_URL) return null;
    const client = await pool.connect();
    console.log('✅ PostgreSQL Connected');
    client.release();
    await initSchema();
    return pool;
  } catch (error) {
    console.error(`❌ PostgreSQL Connection Error: ${error.message}`);
    console.warn('⚠️ The app will continue running, but database features may not work.');
    return null;
  }
};

module.exports = pool;
module.exports.connectDB = connectDB;
