// ============================================================
// HMBMS — Donor Routes (Stage 3)
// Donor registration, screening, enrollment
// ============================================================

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole, logAudit } = require('../middleware');
const { v4: uuidv4 } = require('uuid');

// GET /api/donors — List all donors (Admin, Nurse)
router.get('/', requireAuth, requireRole('admin', 'nurse'), (req, res) => {
  const db = global.db;
  const donors = db.prepare(`
    SELECT d.*, u.username, u.status as account_status
    FROM donors d
    JOIN users u ON d.user_id = u.user_id
    ORDER BY d.created_at DESC
  `).all();
  res.json(donors);
});

// GET /api/donors/:id — Get donor details
router.get('/:id', requireAuth, (req, res) => {
  const db = global.db;
  const donor = db.prepare('SELECT * FROM donors WHERE donor_id = ?').get(req.params.id);
  if (!donor) return res.status(404).json({ error: 'Donor not found.' });

  // Donors can only view their own info
  if (req.session.user.role === 'donor') {
    const ownDonor = db.prepare('SELECT donor_id FROM donors WHERE user_id = ?').get(req.session.user.user_id);
    if (!ownDonor || ownDonor.donor_id !== req.params.id) {
      return res.status(403).json({ error: 'You can only view your own profile.' });
    }
  }

  res.json(donor);
});

// GET /api/donors/my/profile — Get own donor profile
router.get('/my/profile', requireAuth, requireRole('donor'), (req, res) => {
  const db = global.db;
  const donor = db.prepare('SELECT * FROM donors WHERE user_id = ?').get(req.session.user.user_id);
  if (!donor) return res.status(404).json({ error: 'Donor profile not found.' });
  res.json(donor);
});

// POST /api/donors/questionnaire — Submit health questionnaire
router.post('/questionnaire', requireAuth, requireRole('donor'), (req, res) => {
  const { birth_date, contact_number, home_address, blood_type } = req.body;
  const db = global.db;

  const donor = db.prepare('SELECT * FROM donors WHERE user_id = ?').get(req.session.user.user_id);
  if (!donor) return res.status(404).json({ error: 'Donor profile not found.' });

  db.prepare(`
    UPDATE donors SET
      birth_date = ?,
      contact_number = ?,
      home_address = ?,
      blood_type = ?,
      questionnaire_completed = 1
    WHERE donor_id = ?
  `).run(birth_date, contact_number, home_address, blood_type, donor.donor_id);

  logAudit(req.session.user.user_id, req.session.user.username, 'QUESTIONNAIRE_SUBMITTED', `Donor: ${donor.donor_id}`, req.ip);

  res.json({ success: true, message: 'Health questionnaire submitted successfully.' });
});

// POST /api/donors/screening — Record screening results (Nurse/Admin)
router.post('/screening', requireAuth, requireRole('nurse', 'admin'), (req, res) => {
  const { donor_id, hiv_result, hep_b_result, syphilis_result, physician_notes, screening_date } = req.body;

  if (!donor_id || !hiv_result || !hep_b_result || !syphilis_result) {
    return res.status(400).json({ error: 'All test results are required.' });
  }

  const db = global.db;
  const donor = db.prepare('SELECT * FROM donors WHERE donor_id = ?').get(donor_id);
  if (!donor) return res.status(404).json({ error: 'Donor not found.' });

  // Auto-exclusion logic: POSITIVE for HIV or HepB = EXCLUDED
  let result = 'APPROVED';
  let physician_approval = 'APPROVED';
  let screening_status = 'APPROVED';

  if (hiv_result === 'POSITIVE' || hep_b_result === 'POSITIVE') {
    result = 'EXCLUDED';
    physician_approval = 'EXCLUDED';
    screening_status = 'EXCLUDED';
  }

  const transaction = db.transaction(() => {
    // Insert screening record
    db.prepare(`
      INSERT INTO screening_records (donor_id, screened_by, hiv_result, hep_b_result, syphilis_result, physician_notes, screening_date, result)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(donor_id, req.session.user.user_id, hiv_result, hep_b_result, syphilis_result, physician_notes || '', screening_date || new Date().toISOString().split('T')[0], result);

    // Update donor record
    db.prepare(`
      UPDATE donors SET
        hiv_result = ?,
        hep_b_result = ?,
        syphilis_result = ?,
        physician_approval = ?,
        screening_status = ?,
        screening_date = ?,
        enrollment_date = CASE WHEN ? = 'APPROVED' THEN DATE('now') ELSE NULL END
      WHERE donor_id = ?
    `).run(hiv_result, hep_b_result, syphilis_result, physician_approval, screening_status, screening_date || new Date().toISOString().split('T')[0], result, donor_id);
  });

  transaction();

  logAudit(
    req.session.user.user_id,
    req.session.user.username,
    'DONOR_SCREENING',
    `Donor ${donor_id}: HIV=${hiv_result}, HepB=${hep_b_result}, Syphilis=${syphilis_result} → ${result}`,
    req.ip
  );

  res.json({
    success: true,
    result,
    message: result === 'APPROVED'
      ? `Donor ${donor_id} approved and enrolled successfully.`
      : `Donor ${donor_id} excluded due to positive test results.`
  });
});

module.exports = router;
