// ============================================================
// HMBMS — Donor Routes (Stage 3 - PostgreSQL)
// Donor registration, screening, enrollment
// ============================================================

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole, logAudit } = require('../middleware');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

// GET /api/donors — List all donors (Admin, Nurse)
router.get('/', requireAuth, requireRole('admin', 'nurse'), async (req, res) => {
  try {
    const donorsRes = await db.query(`
      SELECT d.*, u.username, u.status as account_status
      FROM donors d
      JOIN users u ON d.user_id = u.user_id
      ORDER BY d.created_at DESC
    `);
    res.json(donorsRes.rows);
  } catch (err) {
    console.error('Error listing donors:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/donors/:id — Get donor details
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const donorRes = await db.query('SELECT * FROM donors WHERE donor_id = $1', [req.params.id]);
    const donor = donorRes.rows[0];
    if (!donor) return res.status(404).json({ error: 'Donor not found.' });

    // Donors can only view their own info
    if (req.session.user.role === 'donor') {
      const ownDonorRes = await db.query('SELECT donor_id FROM donors WHERE user_id = $1', [req.session.user.user_id]);
      const ownDonor = ownDonorRes.rows[0];
      if (!ownDonor || ownDonor.donor_id !== req.params.id) {
        return res.status(403).json({ error: 'You can only view your own profile.' });
      }
    }

    res.json(donor);
  } catch (err) {
    console.error('Error fetching donor:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/donors/my/profile — Get own donor profile
router.get('/my/profile', requireAuth, requireRole('donor'), async (req, res) => {
  try {
    const donorRes = await db.query('SELECT * FROM donors WHERE user_id = $1', [req.session.user.user_id]);
    const donor = donorRes.rows[0];
    if (!donor) return res.status(404).json({ error: 'Donor profile not found.' });
    res.json(donor);
  } catch (err) {
    console.error('Error fetching donor profile:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/donors/questionnaire — Submit health questionnaire (C-08 expanded)
router.post('/questionnaire', requireAuth, requireRole('donor'), async (req, res) => {
  const {
    birth_date, contact_number, home_address, blood_type,
    // C-08: Extended health risk screening fields (§3.2, Use Case 5.1)
    currently_breastfeeding, medications, recent_surgery, smoking_status,
    alcohol_use, chronic_conditions, recent_transfusion, tattoo_or_piercing_recent
  } = req.body;

  try {
    const donorRes = await db.query('SELECT * FROM donors WHERE user_id = $1', [req.session.user.user_id]);
    const donor = donorRes.rows[0];
    if (!donor) return res.status(404).json({ error: 'Donor profile not found.' });

    // Collect all health risk answers into structured JSON
    const questionnaireData = {
      submitted_at: new Date().toISOString(),
      currently_breastfeeding: currently_breastfeeding === true || currently_breastfeeding === 'true',
      medications: medications || '',
      recent_surgery: recent_surgery === true || recent_surgery === 'true',
      smoking_status: smoking_status || 'never',
      alcohol_use: alcohol_use || 'none',
      chronic_conditions: chronic_conditions || '',
      recent_transfusion: recent_transfusion === true || recent_transfusion === 'true',
      tattoo_or_piercing_recent: tattoo_or_piercing_recent === true || tattoo_or_piercing_recent === 'true'
    };

    await db.query(`
      UPDATE donors SET
        birth_date = $1,
        contact_number = $2,
        home_address = $3,
        blood_type = $4,
        questionnaire_data = $5,
        questionnaire_completed = 1
      WHERE donor_id = $6
    `, [birth_date || null, contact_number, home_address, blood_type, JSON.stringify(questionnaireData), donor.donor_id]);

    await logAudit(req.session.user.user_id, req.session.user.username, 'QUESTIONNAIRE_SUBMITTED', `Donor: ${donor.donor_id}`, req.ip);

    res.json({ success: true, message: 'Health questionnaire submitted successfully.' });
  } catch (err) {
    console.error('Error submitting questionnaire:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// POST /api/donors/screening — Record screening results (Nurse/Admin)
router.post('/screening', requireAuth, requireRole('nurse', 'admin'), async (req, res) => {
  const { donor_id, hiv_result, hep_b_result, syphilis_result, physician_notes, screening_date } = req.body;

  if (!donor_id || !hiv_result || !hep_b_result || !syphilis_result) {
    return res.status(400).json({ error: 'All test results are required.' });
  }

  try {
    const donorRes = await db.query('SELECT * FROM donors WHERE donor_id = $1', [donor_id]);
    const donor = donorRes.rows[0];
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

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      // Insert screening record
      await client.query(`
        INSERT INTO screening_records (donor_id, screened_by, hiv_result, hep_b_result, syphilis_result, physician_notes, screening_date, result)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [donor_id, req.session.user.user_id, hiv_result, hep_b_result, syphilis_result, physician_notes || '', screening_date || new Date().toISOString().split('T')[0], result]);

      // Update donor record
      await client.query(`
        UPDATE donors SET
          hiv_result = $1,
          hep_b_result = $2,
          syphilis_result = $3,
          physician_approval = $4,
          screening_status = $5,
          screening_date = $6,
          enrollment_date = CASE WHEN $7 = 'APPROVED' THEN CURRENT_DATE ELSE NULL END
        WHERE donor_id = $8
      `, [hiv_result, hep_b_result, syphilis_result, physician_approval, screening_status, screening_date || new Date().toISOString().split('T')[0], result, donor_id]);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await logAudit(
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
  } catch (err) {
    console.error('Error during screening:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
