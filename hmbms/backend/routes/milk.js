// ============================================================
// MHMBS — Milk Collection Routes (Stage 4 - PostgreSQL)
// Donation recording, QR code, storage logging
// ============================================================

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole, logAudit } = require('../middleware');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const db = require('../db');

// POST /api/milk/donate — Record a new milk donation
router.post('/donate', requireAuth, requireRole('nurse', 'admin'), async (req, res) => {
  const { donor_id, donation_date, volume_ml, expressed_date } = req.body;

  if (!donor_id || !donation_date || !volume_ml) {
    return res.status(400).json({ error: 'Donor ID, donation date, and volume are required.' });
  }

  if (isNaN(volume_ml) || Number(volume_ml) <= 0) {
    return res.status(400).json({ error: 'Volume must be a positive number.' });
  }

  try {
    // C-02: Require fully screened donor — APPROVED status AND all three test results must be NEGATIVE
    const donorRes = await db.query(`
      SELECT * FROM donors
      WHERE donor_id = $1
        AND screening_status = $2
        AND hiv_result = 'NEGATIVE'
        AND hep_b_result = 'NEGATIVE'
        AND syphilis_result = 'NEGATIVE'
    `, [donor_id, 'APPROVED']);
    const donor = donorRes.rows[0];
    if (!donor) return res.status(404).json({
      error: 'Eligible donor not found. The donor must be fully screened (HIV, Hepatitis B, and Syphilis: NEGATIVE) and have APPROVED status before a donation can be recorded.'
    });

    const donation_id = 'DON-' + Date.now().toString(36).toUpperCase();
    const labelData = JSON.stringify({
      donor_name: donor.first_name + ' ' + donor.last_name,
      date: donation_date,
      time: new Date().toTimeString().split(' ')[0],
      volume_ml: Number(volume_ml),
      donation_id
    });

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        INSERT INTO milk_donations (donation_id, donor_id, donation_date, expressed_date, volume_ml, recorded_by, label_data)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [donation_id, donor_id, donation_date, expressed_date || donation_date, Number(volume_ml), req.session.user.user_id, labelData]);

      // Log chain of custody — collection
      await client.query(`
        INSERT INTO chain_of_custody (reference_id, reference_type, action, performed_by, notes)
        VALUES ($1, 'DONATION', 'COLLECTED', $2, $3)
      `, [donation_id, req.session.user.user_id, `Volume: ${volume_ml}ml from donor ${donor_id}`]);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await logAudit(req.session.user.user_id, req.session.user.username, 'MILK_DONATION_RECORDED',
      `Donation ${donation_id}: ${volume_ml}ml from ${donor_id}`, req.ip);

    res.json({ success: true, donation_id, message: `Donation ${donation_id} recorded (${volume_ml} ml).` });
  } catch (err) {
    console.error('Error recording milk donation:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/milk/qr/:donation_id — Generate QR code
router.get('/qr/:donation_id', requireAuth, async (req, res) => {
  try {
    const donationRes = await db.query(`
      SELECT md.*, d.first_name, d.last_name
      FROM milk_donations md
      JOIN donors d ON md.donor_id = d.donor_id
      WHERE md.donation_id = $1
    `, [req.params.donation_id]);
    const donation = donationRes.rows[0];

    if (!donation) return res.status(404).json({ error: 'Donation not found.' });

    const qrData = JSON.stringify({
      id: donation.donation_id,
      donor: donation.first_name + ' ' + donation.last_name,
      date: donation.donation_date,
      volume: donation.volume_ml + 'ml',
      system: 'MHMBS-MHMB'
    });

    const qrDataUrl = await QRCode.toDataURL(qrData, { width: 300, margin: 2 });
    res.json({ qr: qrDataUrl, data: JSON.parse(qrData) });
  } catch (err) {
    console.error('Error generating QR code:', err);
    res.status(500).json({ error: 'Failed to generate QR code.' });
  }
});

// POST /api/milk/storage — Log storage event
router.post('/storage', requireAuth, requireRole('nurse', 'admin', 'medtech'), async (req, res) => {
  const { donation_id, freezer_location, storage_temp } = req.body;

  if (!donation_id) return res.status(400).json({ error: 'Donation ID is required.' });

  try {
    // C-03: Storage temperature safety check (DOH guidelines: must be ≤ -20°C)
    if (Number(storage_temp) > -20) {
      return res.status(400).json({
        error: `SAFETY VIOLATION: Storage temperature must be -20°C or colder as per DOH guidelines. Entered: ${storage_temp}°C is too warm. Milk must be stored frozen.`,
        safety_alert: true
      });
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        UPDATE milk_donations SET
          storage_status = 'STORED',
          freezer_location = $1,
          storage_temp = $2,
          storage_timestamp = CURRENT_TIMESTAMP
        WHERE donation_id = $3
      `, [freezer_location || 'Freezer A', Number(storage_temp) || -20, donation_id]);

      await client.query(`
        INSERT INTO chain_of_custody (reference_id, reference_type, action, performed_by, location, temperature, notes)
        VALUES ($1, 'DONATION', 'STORED', $2, $3, $4, $5)
      `, [donation_id, req.session.user.user_id, freezer_location || 'Freezer A', Number(storage_temp) || -20, `Stored at ${storage_temp}°C`]);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await logAudit(req.session.user.user_id, req.session.user.username, 'MILK_STORED',
      `Donation ${donation_id} stored at ${storage_temp || -20}°C in ${freezer_location || 'Freezer A'}`, req.ip);

    res.json({ success: true, message: 'Storage event logged.' });
  } catch (err) {
    console.error('Error logging storage event:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/milk/donations — List donations
router.get('/donations', requireAuth, async (req, res) => {
  let donations;

  try {
    if (req.session.user.role === 'donor') {
      const donorRes = await db.query('SELECT donor_id FROM donors WHERE user_id = $1', [req.session.user.user_id]);
      const donor = donorRes.rows[0];
      if (!donor) return res.json([]);
      
      const donationsRes = await db.query(`
        SELECT md.*, d.first_name, d.last_name
        FROM milk_donations md
        JOIN donors d ON md.donor_id = d.donor_id
        WHERE md.donor_id = $1
        ORDER BY md.donation_date DESC
      `, [donor.donor_id]);
      donations = donationsRes.rows;
    } else {
      const donationsRes = await db.query(`
        SELECT md.*, d.first_name, d.last_name
        FROM milk_donations md
        JOIN donors d ON md.donor_id = d.donor_id
        ORDER BY md.donation_date DESC
      `);
      donations = donationsRes.rows;
    }

    res.json(donations);
  } catch (err) {
    console.error('Error listing donations:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
