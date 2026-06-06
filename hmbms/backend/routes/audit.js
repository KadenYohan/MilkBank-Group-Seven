// ============================================================
// HMBMS — Audit Trail Routes (PostgreSQL)
// Immutable audit log viewing (Admin only)
// ============================================================

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware');
const db = require('../db');

// GET /api/audit — View audit trail (Admin only)
router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { limit, offset, action, user_id } = req.query;

  let query = 'SELECT * FROM audit_trail WHERE 1=1';
  const params = [];
  let paramIndex = 1;

  if (action) {
    query += ` AND action LIKE $${paramIndex++}`;
    params.push(`%${action}%`);
  }

  if (user_id) {
    query += ` AND user_id = $${paramIndex++}`;
    params.push(user_id);
  }

  query += ' ORDER BY timestamp DESC';
  
  const limitVal = parseInt(limit, 10) || 100;
  const offsetVal = parseInt(offset, 10) || 0;
  query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
  params.push(limitVal, offsetVal);

  try {
    const logsRes = await db.query(query, params);
    const totalRes = await db.query('SELECT COUNT(*) as c FROM audit_trail');
    const total = parseInt(totalRes.rows[0].c, 10);

    res.json({ logs: logsRes.rows, total });
  } catch (err) {
    console.error('Error fetching audit trail:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
