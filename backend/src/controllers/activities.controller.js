import pool from '../db.js';

export async function listActivities(req, res) {
  try {
    // Sanitizar paginación
    let limit = parseInt(req.query.limit ?? '50', 10);
    let offset = parseInt(req.query.offset ?? '0', 10);
    if (!Number.isFinite(limit) || limit <= 0 || limit > 100) limit = 50;
    if (!Number.isFinite(offset) || offset < 0) offset = 0;

    const { q, difficulty, modality, min_price, max_price } = req.query;

    let sql = `
      SELECT id, title, description, modality, difficulty, location, price,
             date_start, date_end, capacity, seats_left
      FROM activities
      WHERE 1=1`;
    const params = [];

    if (q && q.trim()) {
      sql += ' AND (title LIKE ? OR description LIKE ? OR location LIKE ?)';
      const like = `%${q.trim()}%`;
      params.push(like, like, like);
    }
    if (difficulty && difficulty.trim()) {
      sql += ' AND difficulty = ?';
      params.push(difficulty.trim());
    }
    if (modality && modality.trim()) {
      sql += ' AND modality = ?';
      params.push(modality.trim());
    }
    if (min_price && !Number.isNaN(Number(min_price))) {
      sql += ' AND price >= ?';
      params.push(Number(min_price));
    }
    if (max_price && !Number.isNaN(Number(max_price))) {
      sql += ' AND price <= ?';
      params.push(Number(max_price));
    }

    // MySQL no soporta "NULLS LAST": usamos (date_start IS NULL) ASC para mandar los NULL al final
    sql += ` ORDER BY (date_start IS NULL) ASC, date_start ASC LIMIT ${limit} OFFSET ${offset}`;

    const [rows] = await pool.query(sql, params);
    return res.json({ items: rows, limit, offset });
  } catch (e) {
    console.error('listActivities error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function getActivityById(req, res) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT id, title, description, modality, difficulty, location, price,
              date_start, date_end, capacity, seats_left
       FROM activities
       WHERE id = ?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    return res.json({ activity: rows[0] });
  } catch (e) {
    console.error('getActivityById error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
}




