// ============================================================
// MHMBS — Notification Routes (PostgreSQL)
// Web-push style notifications
// ============================================================

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware');
const db = require('../db');

// GET /api/notifications — Get user notifications
router.get('/', requireAuth, async (req, res) => {
  try {
    const notificationsRes = await db.query(`
      SELECT * FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [req.session.user.user_id]);

    const unreadRes = await db.query(`
      SELECT COUNT(*) as c FROM notifications WHERE user_id = $1 AND is_read = 0
    `, [req.session.user.user_id]);
    const unread = parseInt(unreadRes.rows[0].c, 10);

    res.json({ notifications: notificationsRes.rows, unread });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bug #2 fix: read-all MUST be defined BEFORE /:id/read to avoid
// Express matching "read-all" as an :id parameter.

// PUT /api/notifications/read-all — Mark all as read
router.put('/read-all', requireAuth, async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = $1', [req.session.user.user_id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/notifications/:id/read — Mark as read
router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read = 1 WHERE notification_id = $1 AND user_id = $2', 
      [req.params.id, req.session.user.user_id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
