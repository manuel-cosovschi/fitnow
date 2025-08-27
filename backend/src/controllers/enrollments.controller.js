import pool from '../db.js';

/**
 * POST /api/enrollments
 * Body: { activity_id }
 */
export async function createEnrollment(req, res) {
  try {
    const { activity_id } = req.body;
    if (!activity_id) return res.status(400).json({ error: 'activity_id is required' });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Bloqueamos la actividad para verificar cupos
      const [actRows] = await conn.query(
        'SELECT id, seats_left FROM activities WHERE id = ? FOR UPDATE',
        [activity_id]
      );
      if (!actRows.length) {
        await conn.rollback();
        return res.status(404).json({ error: 'Activity not found' });
      }
      const act = actRows[0];
      if (act.seats_left <= 0) {
        await conn.rollback();
        return res.status(409).json({ error: 'No seats left' });
      }

      // Intento de inscripción
      await conn.query(
        'INSERT INTO enrollments (user_id, activity_id) VALUES (?, ?)',
        [req.user.id, activity_id]
      );

      // Descontar cupo
      await conn.query(
        'UPDATE activities SET seats_left = seats_left - 1 WHERE id = ?',
        [activity_id]
      );

      await conn.commit();
      return res.status(201).json({ status: 'ok' });
    } catch (e) {
      await conn.rollback();
      if (e && e.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Already enrolled' });
      }
      console.error('createEnrollment error:', e);
      return res.status(500).json({ error: 'Server error' });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('createEnrollment outer error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
}

/**
 * GET /api/enrollments/mine
 * Retorna inscripciones del usuario con datos de la actividad (incluye fechas).
 */
export async function listMyEnrollments(req, res) {
  try {
    const when = String((req.query.when ?? 'upcoming')).toLowerCase();

    // MySQL guarda UTC; comparamos con hora UTC del server
    // - upcoming: fecha futura o NULL (si no definiste fecha)
    // - past:     fecha pasada estricta
    // - all:      sin filtro
    let extra = ' AND (a.date_start IS NULL OR a.date_start >= UTC_TIMESTAMP()) ';
    let order = ' a.date_start ASC ';
    if (when === 'past') {
      extra = ' AND a.date_start < UTC_TIMESTAMP() ';
      order = ' a.date_start DESC ';
    } else if (when === 'all') {
      extra = '';
      order = ' a.date_start DESC ';
    }

    const [rows] = await pool.query(
      `SELECT e.id,
              e.activity_id,
              a.title,
              a.location,
              a.date_start,
              a.date_end,
              a.price
         FROM enrollments e
         JOIN activities a ON a.id = e.activity_id
        WHERE e.user_id = ? ${extra}
        ORDER BY ${order}`,
      [req.user.id]
    );

    return res.json({ items: rows });
  } catch (e) {
    console.error('listMyEnrollments error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
}


/**
 * DELETE /api/enrollments/:id
 * Cancela la inscripción (del usuario autenticado) y devuelve cupo.
 */
export async function cancelEnrollment(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Tomamos la inscripción y bloqueamos la actividad asociada
      const [rows] = await conn.query(
        'SELECT id, activity_id FROM enrollments WHERE id = ? AND user_id = ? FOR UPDATE',
        [id, userId]
      );
      if (!rows.length) {
        await conn.rollback();
        return res.status(404).json({ error: 'Enrollment not found' });
      }
      const activityId = rows[0].activity_id;

      // Borrar inscripción
      await conn.query(
        'DELETE FROM enrollments WHERE id = ? AND user_id = ?',
        [id, userId]
      );

      // Devolver cupo
      await conn.query(
        'UPDATE activities SET seats_left = seats_left + 1 WHERE id = ?',
        [activityId]
      );

      await conn.commit();
      return res.json({ status: 'ok' });
    } catch (e) {
      await conn.rollback();
      console.error('cancelEnrollment error:', e);
      return res.status(500).json({ error: 'Server error' });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('cancelEnrollment outer error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
}



