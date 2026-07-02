// ============================================================
// MHMBS — Recipient Routes (Stage 7 - PostgreSQL)
// Recipient registration and profile management
// ============================================================

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole, logAudit } = require('../middleware');
const db = require('../db');

// GET /api/recipients — List recipients (Admin, Nurse)
router.get('/', requireAuth, requireRole('admin', 'nurse'), async (req, res) => {
  try {
    const recipientsRes = await db.query(`
      SELECT r.*, u.username, u.status as account_status
      FROM recipients r
      JOIN users u ON r.user_id = u.user_id
      ORDER BY r.created_at DESC
    `);
    res.json(recipientsRes.rows);
  } catch (err) {
    console.error('Error listing recipients:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/recipients/my/profile — Get own recipient profile
router.get('/my/profile', requireAuth, requireRole('recipient'), async (req, res) => {
  try {
    const recipientRes = await db.query('SELECT * FROM recipients WHERE user_id = $1', [req.session.user.user_id]);
    const recipient = recipientRes.rows[0];
    if (!recipient) return res.status(404).json({ error: 'Recipient profile not found.' });
    res.json(recipient);
  } catch (err) {
    console.error('Error fetching recipient profile:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/recipients/my/profile — Update own profile
router.put('/my/profile', requireAuth, requireRole('recipient'), async (req, res) => {
  const { infant_name, guardian_name, hospital_name, doctor_name, diagnosis, birth_weight_grams } = req.body;

  try {
    await db.query(`
      UPDATE recipients SET
        infant_name = COALESCE($1, infant_name),
        guardian_name = COALESCE($2, guardian_name),
        hospital_name = COALESCE($3, hospital_name),
        doctor_name = COALESCE($4, doctor_name),
        diagnosis = COALESCE($5, diagnosis),
        birth_weight_grams = COALESCE($6, birth_weight_grams)
      WHERE user_id = $7
    `, [infant_name || null, guardian_name || null, hospital_name || null, doctor_name || null, diagnosis || null, birth_weight_grams || null, req.session.user.user_id]);

    await logAudit(req.session.user.user_id, req.session.user.username, 'RECIPIENT_PROFILE_UPDATED', '', req.ip);
    res.json({ success: true, message: 'Profile updated.' });
  } catch (err) {
    console.error('Error updating recipient profile:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/recipients/assess — Assess priority (Admin, Nurse)
router.post('/assess', requireAuth, requireRole('admin', 'nurse'), async (req, res) => {
  const { recipient_id, priority_status } = req.body;
  if (!recipient_id || !priority_status) {
    return res.status(400).json({ error: 'Recipient ID and priority status required.' });
  }

  try {
    await db.query('UPDATE recipients SET priority_status = $1 WHERE recipient_id = $2', [priority_status, recipient_id]);

    await logAudit(req.session.user.user_id, req.session.user.username, 'PRIORITY_ASSESSED',
      `Recipient ${recipient_id} set to ${priority_status}`, req.ip);

    res.json({ success: true, message: `Priority updated to ${priority_status}.` });
  } catch (err) {
    console.error('Error assessing priority:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
