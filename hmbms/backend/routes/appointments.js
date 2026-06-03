// ============================================================
// HMBMS — Appointment Routes (Stage 8)
// Scheduling calendar for health center appointments
// ============================================================

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole, logAudit } = require('../middleware');
const { v4: uuidv4 } = require('uuid');

// GET /api/appointments — List appointments
router.get('/', requireAuth, (req, res) => {
  const db = global.db;
  let appointments;

  if (req.session.user.role === 'donor') {
    const donor = db.prepare('SELECT donor_id FROM donors WHERE user_id = ?').get(req.session.user.user_id);
    if (!donor) return res.json([]);
    appointments = db.prepare(`
      SELECT a.*, d.first_name, d.last_name
      FROM appointments a
      LEFT JOIN donors d ON a.donor_id = d.donor_id
      WHERE a.donor_id = ?
      ORDER BY a.appointment_date DESC
    `).all(donor.donor_id);
  } else {
    appointments = db.prepare(`
      SELECT a.*, d.first_name, d.last_name
      FROM appointments a
      LEFT JOIN donors d ON a.donor_id = d.donor_id
      ORDER BY a.appointment_date DESC
    `).all();
  }

  res.json(appointments);
});

// POST /api/appointments — Create appointment (Admin, Nurse)
router.post('/', requireAuth, requireRole('admin', 'nurse'), (req, res) => {
  const { donor_id, program, appointment_date, appointment_time, location, notes } = req.body;

  if (!appointment_date) {
    return res.status(400).json({ error: 'Appointment date is required.' });
  }

  const db = global.db;
  const appointment_id = 'APT-' + Date.now().toString(36).toUpperCase();

  db.prepare(`
    INSERT INTO appointments (appointment_id, donor_id, program, appointment_date, appointment_time, location, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(appointment_id, donor_id || null, program || 'general', appointment_date,
    appointment_time || '', location || '', notes || '', req.session.user.user_id);

  // Notify donor if assigned
  if (donor_id) {
    const donor = db.prepare('SELECT user_id FROM donors WHERE donor_id = ?').get(donor_id);
    if (donor) {
      db.prepare(`
        INSERT INTO notifications (notification_id, user_id, type, title, message)
        VALUES (?, ?, 'APPOINTMENT', 'New Appointment Scheduled', ?)
      `).run(uuidv4(), donor.user_id, `You have a new appointment on ${appointment_date} at ${appointment_time || 'TBD'}. Location: ${location || 'Health Center'}`);
    }
  }

  logAudit(req.session.user.user_id, req.session.user.username, 'APPOINTMENT_CREATED',
    `Appointment ${appointment_id} on ${appointment_date}`, req.ip);

  res.json({ success: true, appointment_id, message: 'Appointment created.' });
});

// PUT /api/appointments/:id — Update appointment status
router.put('/:id', requireAuth, requireRole('admin', 'nurse'), (req, res) => {
  const { status, notes } = req.body;
  const db = global.db;

  db.prepare(`
    UPDATE appointments SET status = COALESCE(?, status), notes = COALESCE(?, notes) WHERE appointment_id = ?
  `).run(status, notes, req.params.id);

  logAudit(req.session.user.user_id, req.session.user.username, 'APPOINTMENT_UPDATED',
    `Appointment ${req.params.id} → ${status}`, req.ip);

  res.json({ success: true, message: 'Appointment updated.' });
});

// DELETE /api/appointments/:id — Cancel appointment
router.delete('/:id', requireAuth, requireRole('admin', 'nurse'), (req, res) => {
  const db = global.db;
  db.prepare("UPDATE appointments SET status = 'CANCELLED' WHERE appointment_id = ?").run(req.params.id);

  logAudit(req.session.user.user_id, req.session.user.username, 'APPOINTMENT_CANCELLED',
    `Appointment ${req.params.id}`, req.ip);

  res.json({ success: true, message: 'Appointment cancelled.' });
});

module.exports = router;
