// ============================================================
// HMBMS — Recipient Routes (Stage 7)
// Recipient registration and profile management
// ============================================================

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole, logAudit } = require('../middleware');

// GET /api/recipients — List recipients (Admin, Nurse)
router.get('/', requireAuth, requireRole('admin', 'nurse'), (req, res) => {
  const db = global.db;
  const recipients = db.prepare(`
    SELECT r.*, u.username, u.status as account_status
    FROM recipients r
    JOIN users u ON r.user_id = u.user_id
    ORDER BY r.created_at DESC
  `).all();
  res.json(recipients);
});

// GET /api/recipients/my/profile — Get own recipient profile
router.get('/my/profile', requireAuth, requireRole('recipient'), (req, res) => {
  const db = global.db;
  const recipient = db.prepare('SELECT * FROM recipients WHERE user_id = ?').get(req.session.user.user_id);
  if (!recipient) return res.status(404).json({ error: 'Recipient profile not found.' });
  res.json(recipient);
});

// PUT /api/recipients/my/profile — Update own profile
router.put('/my/profile', requireAuth, requireRole('recipient'), (req, res) => {
  const { infant_name, guardian_name, hospital_name, doctor_name, diagnosis, birth_weight_grams } = req.body;
  const db = global.db;

  db.prepare(`
    UPDATE recipients SET
      infant_name = COALESCE(?, infant_name),
      guardian_name = COALESCE(?, guardian_name),
      hospital_name = COALESCE(?, hospital_name),
      doctor_name = COALESCE(?, doctor_name),
      diagnosis = COALESCE(?, diagnosis),
      birth_weight_grams = COALESCE(?, birth_weight_grams)
    WHERE user_id = ?
  `).run(infant_name, guardian_name, hospital_name, doctor_name, diagnosis, birth_weight_grams, req.session.user.user_id);

  logAudit(req.session.user.user_id, req.session.user.username, 'RECIPIENT_PROFILE_UPDATED', '', req.ip);
  res.json({ success: true, message: 'Profile updated.' });
});

// POST /api/recipients/assess — Assess priority (Admin, Nurse)
router.post('/assess', requireAuth, requireRole('admin', 'nurse'), (req, res) => {
  const { recipient_id, priority_status } = req.body;
  if (!recipient_id || !priority_status) {
    return res.status(400).json({ error: 'Recipient ID and priority status required.' });
  }

  const db = global.db;
  db.prepare('UPDATE recipients SET priority_status = ? WHERE recipient_id = ?').run(priority_status, recipient_id);

  logAudit(req.session.user.user_id, req.session.user.username, 'PRIORITY_ASSESSED',
    `Recipient ${recipient_id} set to ${priority_status}`, req.ip);

  res.json({ success: true, message: `Priority updated to ${priority_status}.` });
});

module.exports = router;
