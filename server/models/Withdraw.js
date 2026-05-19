const pool = require('../config/db');

const mapWithdraw = (row) => {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    userId: row.user_id,
    telegramId: row.telegram_id,
    username: row.username,
    amount: row.amount,
    stars: row.stars,
    status: row.status,
    adminNote: row.admin_note,
    processedAt: row.processed_at,
    createdAt: row.created_at,
  };
};

const Withdraw = {
  async findOne(query) {
    const conditions = [];
    const vals = [];
    if (query.telegramId !== undefined) { conditions.push(`telegram_id = $${vals.length + 1}`); vals.push(query.telegramId); }
    if (query.status !== undefined) { conditions.push(`status = $${vals.length + 1}`); vals.push(query.status); }
    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
    const res = await pool.query(`SELECT * FROM withdrawals${where} ORDER BY created_at DESC LIMIT 1`, vals);
    return mapWithdraw(res.rows[0]);
  },

  async findById(id) {
    const res = await pool.query('SELECT * FROM withdrawals WHERE id = $1 LIMIT 1', [id]);
    return mapWithdraw(res.rows[0]);
  },

  async create(data) {
    const res = await pool.query(
      `INSERT INTO withdrawals (user_id, telegram_id, username, amount, stars)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.userId, data.telegramId, data.username || '', data.amount, data.stars]
    );
    return mapWithdraw(res.rows[0]);
  },

  async save(withdrawal) {
    const res = await pool.query(
      `UPDATE withdrawals SET status = $1, admin_note = $2, processed_at = $3 WHERE id = $4 RETURNING *`,
      [withdrawal.status, withdrawal.adminNote || '', withdrawal.processedAt || null, withdrawal._id]
    );
    return mapWithdraw(res.rows[0]);
  },

  async countDocuments(query = {}) {
    const conditions = [];
    const vals = [];
    if (query.telegramId !== undefined) { conditions.push(`telegram_id = $${vals.length + 1}`); vals.push(query.telegramId); }
    if (query.status !== undefined) { conditions.push(`status = $${vals.length + 1}`); vals.push(query.status); }
    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
    const res = await pool.query(`SELECT COUNT(*) FROM withdrawals${where}`, vals);
    return parseInt(res.rows[0].count);
  },

  async sumApprovedStars() {
    const res = await pool.query(`SELECT COALESCE(SUM(stars), 0) as total FROM withdrawals WHERE status = 'approved'`);
    return parseInt(res.rows[0].total);
  },

  async find(query = {}, opts = {}) {
    const conditions = [];
    const vals = [];
    if (query.telegramId !== undefined) { conditions.push(`telegram_id = $${vals.length + 1}`); vals.push(query.telegramId); }
    if (query.status !== undefined) { conditions.push(`status = $${vals.length + 1}`); vals.push(query.status); }
    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
    let sql = `SELECT * FROM withdrawals${where} ORDER BY created_at DESC`;
    if (opts.limit != null) { sql += ` LIMIT $${vals.length + 1}`; vals.push(opts.limit); }
    if (opts.offset != null) { sql += ` OFFSET $${vals.length + 1}`; vals.push(opts.offset); }
    const res = await pool.query(sql, vals);
    return res.rows.map(mapWithdraw);
  },
};

module.exports = Withdraw;
