// ============================================================
// HMBMS — Milk Collection Routes (Stage 4)
// Donation recording, QR code, storage logging
// ============================================================

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole, logAudit } = require('../middleware');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');

// POST /api/milk/donate — Record a new milk donation
router.post('/donate', requireAuth, requireRole('nurse', 'admin'), (req, res) => {
  const { donor_id, donation_date, volume_ml, expressed_date } = req.body;

  if (!donor_id || !donation_date || !volume_ml) {
    return res.status(400).json({ error: 'Donor ID, donation date, and volume are required.' });
  }

  if (isNaN(volume_ml) || Number(volume_ml) <= 0) {
    return res.status(400).json({ error: 'Volume must be a positive number.' });
  }

  const db = global.db;
  const donor = db.prepare('SELECT * FROM donors WHERE donor_id = ? AND screening_status = ?').get(donor_id, 'APPROVED');
  if (!donor) return res.status(404).json({ error: 'Approved donor not found.' });

  const donation_id = 'DON-' + Date.now().toString(36).toUpperCase();
  const labelData = JSON.stringify({
    donor_name: donor.first_name + ' ' + donor.last_name,
    date: donation_date,
    time: new Date().toTimeString().split(' ')[0],
    volume_ml: Number(volume_ml),
    donation_id
  });

  db.prepare(`
    INSERT INTO milk_donations (donation_id, donor_id, donation_date, expressed_date, volume_ml, recorded_by, label_data)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(donation_id, donor_id, donation_date, expressed_date || donation_date, Number(volume_ml), req.session.user.user_id, labelData);

  // Log chain of custody — collection
  db.prepare(`
    INSERT INTO chain_of_custody (reference_id, reference_type, action, performed_by, notes)
    VALUES (?, 'DONATION', 'COLLECTED', ?, ?)
  `).run(donation_id, req.session.user.user_id, `Volume: ${volume_ml}ml from donor ${donor_id}`);

  logAudit(req.session.user.user_id, req.session.user.username, 'MILK_DONATION_RECORDED',
    `Donation ${donation_id}: ${volume_ml}ml from ${donor_id}`, req.ip);

  res.json({ success: true, donation_id, message: `Donation ${donation_id} recorded (${volume_ml} ml).` });
});

// GET /api/milk/qr/:donation_id — Generate QR code
router.get('/qr/:donation_id', requireAuth, async (req, res) => {
  const db = global.db;
  const donation = db.prepare(`
    SELECT md.*, d.first_name, d.last_name
    FROM milk_donations md
    JOIN donors d ON md.donor_id = d.donor_id
    WHERE md.donation_id = ?
  `).get(req.params.donation_id);

  if (!donation) return res.status(404).json({ error: 'Donation not found.' });

  const qrData = JSON.stringify({
    id: donation.donation_id,
    donor: donation.first_name + ' ' + donation.last_name,
    date: donation.donation_date,
    volume: donation.volume_ml + 'ml',
    system: 'HMBMS-MHMB'
  });

  try {
    const qrDataUrl = await QRCode.toDataURL(qrData, { width: 300, margin: 2 });
    res.json({ qr: qrDataUrl, data: JSON.parse(qrData) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code.' });
  }
});

// POST /api/milk/storage — Log storage event
router.post('/storage', requireAuth, requireRole('nurse', 'admin', 'medtech'), (req, res) => {
  const { donation_id, milk_type, freezer_location, storage_temp } = req.body;

  if (!donation_id) return res.status(400).json({ error: 'Donation ID is required.' });

  const db = global.db;
  db.prepare(`
    UPDATE milk_donations SET
      storage_status = 'STORED',
      freezer_location = ?,
      storage_temp = ?,
      storage_timestamp = DATETIME('now')
    WHERE donation_id = ?
  `).run(freezer_location || 'Freezer A', storage_temp || -20, donation_id);

  db.prepare(`
    INSERT INTO chain_of_custody (reference_id, reference_type, action, performed_by, location, temperature, notes)
    VALUES (?, 'DONATION', 'STORED', ?, ?, ?, ?)
  `).run(donation_id, req.session.user.user_id, freezer_location || 'Freezer A', storage_temp || -20, `Stored at ${storage_temp || -20}°C`);

  logAudit(req.session.user.user_id, req.session.user.username, 'MILK_STORED',
    `Donation ${donation_id} stored at ${storage_temp || -20}°C in ${freezer_location || 'Freezer A'}`, req.ip);

  res.json({ success: true, message: 'Storage event logged.' });
});

// GET /api/milk/donations — List donations
router.get('/donations', requireAuth, (req, res) => {
  const db = global.db;
  let donations;

  if (req.session.user.role === 'donor') {
    const donor = db.prepare('SELECT donor_id FROM donors WHERE user_id = ?').get(req.session.user.user_id);
    if (!donor) return res.json([]);
    donations = db.prepare(`
      SELECT md.*, d.first_name, d.last_name
      FROM milk_donations md
      JOIN donors d ON md.donor_id = d.donor_id
      WHERE md.donor_id = ?
      ORDER BY md.donation_date DESC
    `).all(donor.donor_id);
  } else {
    donations = db.prepare(`
      SELECT md.*, d.first_name, d.last_name
      FROM milk_donations md
      JOIN donors d ON md.donor_id = d.donor_id
      ORDER BY md.donation_date DESC
    `).all();
  }

  res.json(donations);
});

module.exports = router;
