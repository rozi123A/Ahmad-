const pool = require('../config/db');

const mapUser = (row) => {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    telegramId: row.telegram_id,
    username: row.username,
    firstName: row.first_name,
    lastName: row.last_name,
    photoUrl: row.photo_url,
    points: row.points,
    totalEarned: row.total_earned,
    totalWithdrawn: row.total_withdrawn,
    isBanned: row.is_banned,
    isAdmin: row.is_admin,
    referredBy: row.referred_by || '',
    lastLogin: row.last_login,
    createdAt: row.created_at,
  };
};

const User = {
  async findOne(query) {
    if (query.telegramId !== undefined) {
      const res = await pool.query('SELECT * FROM users WHERE telegram_id = $1 LIMIT 1', [query.telegramId]);
      return mapUser(res.rows[0]);
    }
    return null;
  },

  async findById(id) {
    const res = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
    return mapUser(res.rows[0]);
  },

  async create(data) {
    const res = await pool.query(
      `INSERT INTO users (telegram_id, username, first_name, last_name, photo_url, is_admin, referred_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.telegramId,
        data.username || '',
        data.firstName || '',
        data.lastName || '',
        data.photoUrl || '',
        data.isAdmin || false,
        data.referredBy || '',
      ]
    );
    return mapUser(res.rows[0]);
  },

  async save(user) {
    const res = await pool.query(
      `UPDATE users SET
        username = $1, first_name = $2, last_name = $3, photo_url = $4,
        is_banned = $5, is_admin = $6, last_login = $7, points = $8
       WHERE id = $9 RETURNING *`,
      [
        user.username,
        user.firstName,
        user.lastName,
        user.photoUrl,
        user.isBanned,
        user.isAdmin,
        user.lastLogin || new Date(),
        user.points,
        user._id,
      ]
    );
    return mapUser(res.rows[0]);
  },

  async findByIdAndUpdate(id, update) {
    if (update.$inc) {
      const inc = update.$inc;
      const sets = [];
      const vals = [];
      let i = 1;
      if (inc.points !== undefined) { sets.push(`points = points + $${i++}`); vals.push(inc.points); }
      if (inc.totalEarned !== undefined) { sets.push(`total_earned = total_earned + $${i++}`); vals.push(inc.totalEarned); }
      if (inc.totalWithdrawn !== undefined) { sets.push(`total_withdrawn = total_withdrawn + $${i++}`); vals.push(inc.totalWithdrawn); }
      if (sets.length === 0) return null;
      vals.push(id);
      const res = await pool.query(
        `UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
        vals
      );
      return mapUser(res.rows[0]);
    }
    if (update.$set) {
      const s = update.$set;
      const sets = [];
      const vals = [];
      let i = 1;
      if (s.points !== undefined) { sets.push(`points = $${i++}`); vals.push(s.points); }
      if (s.isBanned !== undefined) { sets.push(`is_banned = $${i++}`); vals.push(s.isBanned); }
      if (sets.length === 0) return null;
      vals.push(id);
      const res = await pool.query(
        `UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
        vals
      );
      return mapUser(res.rows[0]);
    }
    return null;
  },

  async countDocuments(query = {}) {
    const vals = [];
    const conditions = [];

    if (query.isBanned !== undefined) {
      conditions.push(`is_banned = $${vals.length + 1}`); vals.push(query.isBanned);
    }
    if (query.createdAt && query.createdAt.$gte) {
      conditions.push(`created_at >= $${vals.length + 1}`); vals.push(query.createdAt.$gte);
    }
    if (query.$or) {
      const orParts = [];
      for (const cond of query.$or) {
        if (cond.username && cond.username.$regex) {
          orParts.push(`username ILIKE $${vals.length + 1}`); vals.push(`%${cond.username.$regex}%`);
        } else if (cond.firstName && cond.firstName.$regex) {
          orParts.push(`first_name ILIKE $${vals.length + 1}`); vals.push(`%${cond.firstName.$regex}%`);
        } else if (cond.telegramId) {
          orParts.push(`telegram_id = $${vals.length + 1}`); vals.push(cond.telegramId);
        }
      }
      if (orParts.length) conditions.push(`(${orParts.join(' OR ')})`);
    }

    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
    const res = await pool.query(`SELECT COUNT(*) FROM users${where}`, vals);
    return parseInt(res.rows[0].count);
  },

  async find(query = {}, opts = {}) {
    let sql = 'SELECT * FROM users';
    const vals = [];
    const conditions = [];

    if (query.isBanned !== undefined) {
      conditions.push(`is_banned = $${vals.length + 1}`);
      vals.push(query.isBanned);
    }
    if (query.$or) {
      const orParts = [];
      for (const cond of query.$or) {
        if (cond.username && cond.username.$regex) {
          orParts.push(`username ILIKE $${vals.length + 1}`);
          vals.push(`%${cond.username.$regex}%`);
        } else if (cond.firstName && cond.firstName.$regex) {
          orParts.push(`first_name ILIKE $${vals.length + 1}`);
          vals.push(`%${cond.firstName.$regex}%`);
        } else if (cond.telegramId) {
          orParts.push(`telegram_id = $${vals.length + 1}`);
          vals.push(cond.telegramId);
        }
      }
      if (orParts.length) conditions.push(`(${orParts.join(' OR ')})`);
    }

    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY created_at DESC';

    if (opts.limit != null) { sql += ` LIMIT $${vals.length + 1}`; vals.push(opts.limit); }
    if (opts.offset != null) { sql += ` OFFSET $${vals.length + 1}`; vals.push(opts.offset); }

    const res = await pool.query(sql, vals);
    return res.rows.map(mapUser);
  },
};

module.exports = User;
