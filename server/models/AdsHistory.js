const pool = require('../config/db');

const mapAds = (row) => {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    userId: row.user_id,
    telegramId: row.telegram_id,
    adsWatched: row.ads_watched,
    pointsEarned: row.points_earned,
    date: row.date,
  };
};

const AdsHistory = {
  async findOne(query) {
    if (query.telegramId !== undefined && query.date !== undefined) {
      const res = await pool.query(
        'SELECT * FROM ads_history WHERE telegram_id = $1 AND date = $2 LIMIT 1',
        [query.telegramId, query.date]
      );
      return mapAds(res.rows[0]);
    }
    return null;
  },

  async create(data) {
    const res = await pool.query(
      `INSERT INTO ads_history (user_id, telegram_id, ads_watched, points_earned, date)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (telegram_id, date) DO UPDATE
         SET ads_watched = EXCLUDED.ads_watched, points_earned = EXCLUDED.points_earned
       RETURNING *`,
      [data.userId, data.telegramId, data.adsWatched || 0, data.pointsEarned || 0, data.date]
    );
    return mapAds(res.rows[0]);
  },

  async updateAds(id, adsWatched, pointsEarned) {
    const res = await pool.query(
      'UPDATE ads_history SET ads_watched = $1, points_earned = $2 WHERE id = $3 RETURNING *',
      [adsWatched, pointsEarned, id]
    );
    return mapAds(res.rows[0]);
  },

  async sumTodayAds(date) {
    const res = await pool.query(
      'SELECT COALESCE(SUM(ads_watched), 0) as total FROM ads_history WHERE date = $1',
      [date]
    );
    return parseInt(res.rows[0].total);
  },
};

module.exports = AdsHistory;
