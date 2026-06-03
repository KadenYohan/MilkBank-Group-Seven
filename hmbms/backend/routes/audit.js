// ============================================================
// HMBMS — Audit Trail Routes
// Immutable audit log viewing (Admin only)
// ============================================================

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware');

// GET /api/audit — View audit trail (Admin only)
router.get('/', requireAuth, requireRole('admin'), (req, res) => {
  const db = global.db;
  const { limit, offset, action, user_id } = req.query;

  let query = 'SELECT * FROM audit_trail WHERE 1=1';
  const params = [];

  if (action) {
    query += ' AND action LIKE ?';
    params.push(`%${action}%`);
  }

  if (user_id) {
    query += ' AND user_id = ?';
    params.push(user_id);
  }

  query += ' ORDER BY timestamp DESC';
  query += ` LIMIT ${parseInt(limit) || 100} OFFSET ${parseInt(offset) || 0}`;

  const logs = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as c FROM audit_trail').get().c;

  res.json({ logs, total });
});

module.exports = router;
