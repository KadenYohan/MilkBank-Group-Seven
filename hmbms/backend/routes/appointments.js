// ============================================================
// MHMBS — Appointment Routes (Stage 8 - PostgreSQL)
// Scheduling calendar for health center appointments
// ============================================================

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole, logAudit } = require('../middleware');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

// GET /api/appointments — List appointments
router.get('/', requireAuth, async (req, res) => {
  let appointments;

  try {
    if (req.session.user.role === 'donor') {
      const donorRes = await db.query('SELECT donor_id FROM donors WHERE user_id = $1', [req.session.user.user_id]);
      const donor = donorRes.rows[0];
      if (!donor) return res.json([]);
      
      const appointmentsRes = await db.query(`
        SELECT a.*, d.first_name, d.last_name
        FROM appointments a
        LEFT JOIN donors d ON a.donor_id = d.donor_id
        WHERE a.donor_id = $1
        ORDER BY a.appointment_date DESC
      `, [donor.donor_id]);
      appointments = appointmentsRes.rows;
    } else {
      const appointmentsRes = await db.query(`
        SELECT a.*, d.first_name, d.last_name
        FROM appointments a
        LEFT JOIN donors d ON a.donor_id = d.donor_id
        ORDER BY a.appointment_date DESC
      `);
      appointments = appointmentsRes.rows;
    }

    res.json(appointments);
  } catch (err) {
    console.error('Error fetching appointments:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/appointments — Create appointment (Admin, Nurse)
router.post('/', requireAuth, requireRole('admin', 'nurse'), async (req, res) => {
  const { donor_id, program, appointment_date, appointment_time, location, notes } = req.body;

  if (!appointment_date) {
    return res.status(400).json({ error: 'Appointment date is required.' });
  }

  const appointment_id = 'APT-' + Date.now().toString(36).toUpperCase();

  try {
    await db.query(`
      INSERT INTO appointments (appointment_id, donor_id, program, appointment_date, appointment_time, location, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [appointment_id, donor_id || null, program || 'general', appointment_date,
      appointment_time || '', location || '', notes || '', req.session.user.user_id]);

    // Notify donor if assigned
    if (donor_id) {
      const donorRes = await db.query('SELECT user_id FROM donors WHERE donor_id = $1', [donor_id]);
      const donor = donorRes.rows[0];
      if (donor) {
        await db.query(`
          INSERT INTO notifications (notification_id, user_id, type, title, message)
          VALUES ($1, $2, 'APPOINTMENT', 'New Appointment Scheduled', $3)
        `, [uuidv4(), donor.user_id, `You have a new appointment on ${appointment_date} at ${appointment_time || 'TBD'}. Location: ${location || 'Health Center'}`]);
      }
    }

    await logAudit(req.session.user.user_id, req.session.user.username, 'APPOINTMENT_CREATED',
      `Appointment ${appointment_id} on ${appointment_date}`, req.ip);

    res.json({ success: true, appointment_id, message: 'Appointment created.' });
  } catch (err) {
    console.error('Error creating appointment:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/appointments/:id — Update appointment status
router.put('/:id', requireAuth, requireRole('admin', 'nurse'), async (req, res) => {
  const { status, notes } = req.body;

  try {
    await db.query(`
      UPDATE appointments 
      SET status = COALESCE($1, status), notes = COALESCE($2, notes) 
      WHERE appointment_id = $3
    `, [status || null, notes || null, req.params.id]);

    await logAudit(req.session.user.user_id, req.session.user.username, 'APPOINTMENT_UPDATED',
      `Appointment ${req.params.id} → ${status}`, req.ip);

    res.json({ success: true, message: 'Appointment updated.' });
  } catch (err) {
    console.error('Error updating appointment:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/appointments/:id — Cancel appointment
router.delete('/:id', requireAuth, requireRole('admin', 'nurse'), async (req, res) => {
  try {
    await db.query("UPDATE appointments SET status = 'CANCELLED' WHERE appointment_id = $1", [req.params.id]);

    await logAudit(req.session.user.user_id, req.session.user.username, 'APPOINTMENT_CANCELLED',
      `Appointment ${req.params.id}`, req.ip);

    res.json({ success: true, message: 'Appointment cancelled.' });
  } catch (err) {
    console.error('Error cancelling appointment:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
