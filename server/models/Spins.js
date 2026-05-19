const pool = require('../config/db');

const mapSpin = (row) => {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    userId: row.user_id,
    telegramId: row.telegram_id,
    spinsUsed: row.spins_used,
    adSpinsUsed: row.ad_spins_used,
    lastSpinDate: row.last_spin_date,
  };
};

const Spins = {
  async findOne(query) {
    if (query.telegramId !== undefined && query.lastSpinDate !== undefined) {
      const res = await pool.query(
        'SELECT * FROM spins WHERE telegram_id = $1 AND last_spin_date = $2 LIMIT 1',
        [query.telegramId, query.lastSpinDate]
      );
      return mapSpin(res.rows[0]);
    }
    return null;
  },

  async create(data) {
    const res = await pool.query(
      `INSERT INTO spins (user_id, telegram_id, spins_used, ad_spins_used, last_spin_date)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (telegram_id, last_spin_date) DO UPDATE
         SET spins_used = EXCLUDED.spins_used, ad_spins_used = EXCLUDED.ad_spins_used
       RETURNING *`,
      [
        data.userId,
        data.telegramId,
        data.spinsUsed || 0,
        data.adSpinsUsed || 0,
        data.lastSpinDate,
      ]
    );
    return mapSpin(res.rows[0]);
  },

  async updateSpins(id, spinsUsed, adSpinsUsed) {
    const res = await pool.query(
      'UPDATE spins SET spins_used = $1, ad_spins_used = $2 WHERE id = $3 RETURNING *',
      [spinsUsed, adSpinsUsed, id]
    );
    return mapSpin(res.rows[0]);
  },
};

module.exports = Spins;
