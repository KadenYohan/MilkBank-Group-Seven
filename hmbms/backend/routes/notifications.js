// ============================================================
// HMBMS — Notification Routes
// Web-push style notifications
// ============================================================

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware');

// GET /api/notifications — Get user notifications
router.get('/', requireAuth, (req, res) => {
  const db = global.db;
  const notifications = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(req.session.user.user_id);

  const unread = db.prepare(`
    SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0
  `).get(req.session.user.user_id).c;

  res.json({ notifications, unread });
});

// PUT /api/notifications/:id/read — Mark as read
router.put('/:id/read', requireAuth, (req, res) => {
  const db = global.db;
  db.prepare('UPDATE notifications SET is_read = 1 WHERE notification_id = ? AND user_id = ?')
    .run(req.params.id, req.session.user.user_id);
  res.json({ success: true });
});

// PUT /api/notifications/read-all — Mark all as read
router.put('/read-all', requireAuth, (req, res) => {
  const db = global.db;
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.session.user.user_id);
  res.json({ success: true });
});

module.exports = router;
