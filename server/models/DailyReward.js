const pool = require('../config/db');

const mapReward = (row) => {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    userId: row.user_id,
    telegramId: row.telegram_id,
    amount: row.amount,
    claimedAt: row.claimed_at,
  };
};

const DailyReward = {
  async findOne(query) {
    if (query.telegramId !== undefined) {
      const res = await pool.query(
        'SELECT * FROM daily_rewards WHERE telegram_id = $1 ORDER BY claimed_at DESC LIMIT 1',
        [query.telegramId]
      );
      return mapReward(res.rows[0]);
    }
    return null;
  },

  async create(data) {
    const res = await pool.query(
      `INSERT INTO daily_rewards (user_id, telegram_id, amount)
       VALUES ($1, $2, $3) RETURNING *`,
      [data.userId, data.telegramId, data.amount || 100]
    );
    return mapReward(res.rows[0]);
  },
};

module.exports = DailyReward;
