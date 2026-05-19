const pool = require('../config/db');

const mapNotif = (row) => {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    userId: row.user_id,
    telegramId: row.telegram_id,
    type: row.type,
    title: row.title,
    message: row.message,
    read: row.read,
    createdAt: row.created_at,
  };
};

const Notification = {
  async create(data) {
    const res = await pool.query(
      `INSERT INTO notifications (user_id, telegram_id, type, title, message)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.userId || null, data.telegramId || null, data.type, data.title, data.message]
    );
    return mapNotif(res.rows[0]);
  },

  async insertMany(items) {
    for (const item of items) {
      await pool.query(
        `INSERT INTO notifications (user_id, telegram_id, type, title, message)
         VALUES ($1, $2, $3, $4, $5)`,
        [item.userId || null, item.telegramId || null, item.type, item.title, item.message]
      );
    }
  },

  async find(query = {}, opts = {}) {
    const conditions = [];
    const vals = [];
    if (query.telegramId !== undefined) { conditions.push(`telegram_id = $${vals.length + 1}`); vals.push(query.telegramId); }
    if (query.read !== undefined) { conditions.push(`read = $${vals.length + 1}`); vals.push(query.read); }
    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
    let sql = `SELECT * FROM notifications${where} ORDER BY created_at DESC`;
    if (opts.limit != null) { sql += ` LIMIT $${vals.length + 1}`; vals.push(opts.limit); }
    const res = await pool.query(sql, vals);
    return res.rows.map(mapNotif);
  },

  async countDocuments(query = {}) {
    const conditions = [];
    const vals = [];
    if (query.telegramId !== undefined) { conditions.push(`telegram_id = $${vals.length + 1}`); vals.push(query.telegramId); }
    if (query.read !== undefined) { conditions.push(`read = $${vals.length + 1}`); vals.push(query.read); }
    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
    const res = await pool.query(`SELECT COUNT(*) FROM notifications${where}`, vals);
    return parseInt(res.rows[0].count);
  },

  async updateMany(query, update) {
    const conditions = [];
    const vals = [];
    if (query.telegramId !== undefined) { conditions.push(`telegram_id = $${vals.length + 1}`); vals.push(query.telegramId); }
    if (query.read !== undefined) { conditions.push(`read = $${vals.length + 1}`); vals.push(query.read); }
    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
    if (update.read !== undefined) {
      vals.push(update.read);
      await pool.query(`UPDATE notifications SET read = $${vals.length}${where}`, vals);
    }
  },
};

module.exports = Notification;
