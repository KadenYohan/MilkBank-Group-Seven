// ============================================================
// MHMBS — Pasteurization Batch Routes (Stage 5 - PostgreSQL)
// Batch management, lab tests, safety validation
// ============================================================

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole, logAudit } = require('../middleware');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

// POST /api/batches/create — Create a new pasteurization batch
router.post('/create', requireAuth, requireRole('admin', 'medtech', 'nurse'), async (req, res) => {
  const { donation_ids, thaw_confirmed, laminar_flow_confirmed } = req.body;

  if (!donation_ids || !Array.isArray(donation_ids) || donation_ids.length === 0) {
    return res.status(400).json({ error: 'At least one donation must be assigned to a batch.' });
  }

  const batch_id = 'BTH-' + Date.now().toString(36).toUpperCase();

  try {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        INSERT INTO pasteurization_batches (batch_id, thaw_confirmed, laminar_flow_confirmed, batch_status)
        VALUES ($1, $2, $3, 'PENDING')
      `, [batch_id, thaw_confirmed ? 1 : 0, laminar_flow_confirmed ? 1 : 0]);

      for (const donId of donation_ids) {
        await client.query('INSERT INTO batch_donations (batch_id, donation_id) VALUES ($1, $2)', [batch_id, donId]);
        await client.query("UPDATE milk_donations SET storage_status = 'ASSIGNED_TO_BATCH' WHERE donation_id = $1", [donId]);
      }

      await client.query(`
        INSERT INTO chain_of_custody (reference_id, reference_type, action, performed_by, notes)
        VALUES ($1, 'BATCH', 'BATCH_CREATED', $2, $3)
      `, [batch_id, req.session.user.user_id, `Batch created with ${donation_ids.length} donations`]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await logAudit(req.session.user.user_id, req.session.user.username, 'BATCH_CREATED',
      `Batch ${batch_id} with ${donation_ids.length} donations`, req.ip);

    res.json({ success: true, batch_id, message: `Batch ${batch_id} created.` });
  } catch (err) {
    console.error('Error creating batch:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/batches/pasteurize — Log pasteurization process
router.post('/pasteurize', requireAuth, requireRole('admin', 'medtech', 'nurse'), async (req, res) => {
  const { batch_id, start_time, end_time, temperature, duration_minutes, technician_name } = req.body;

  if (!batch_id || !start_time || !end_time || temperature === undefined || duration_minutes === undefined) {
    return res.status(400).json({ error: 'All pasteurization fields are required.' });
  }

  // Critical safety validation — 62.5°C for 30 minutes
  if (Number(temperature) < 62.5) {
    return res.status(400).json({
      error: 'SAFETY VIOLATION: Temperature must be at least 62.5°C.',
      safety_alert: true
    });
  }

  if (Number(duration_minutes) < 30) {
    return res.status(400).json({
      error: 'SAFETY VIOLATION: Duration must be at least 30 minutes.',
      safety_alert: true
    });
  }

  try {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        UPDATE pasteurization_batches SET
          start_time = $1,
          end_time = $2,
          temperature = $3,
          duration_minutes = $4,
          technician_id = $5,
          technician_name = $6,
          batch_status = 'TESTING',
          updated_at = CURRENT_TIMESTAMP
        WHERE batch_id = $7
      `, [start_time, end_time, Number(temperature), Number(duration_minutes),
        req.session.user.user_id, technician_name || req.session.user.first_name + ' ' + req.session.user.last_name, batch_id]);

      await client.query(`
        INSERT INTO chain_of_custody (reference_id, reference_type, action, performed_by, temperature, notes)
        VALUES ($1, 'BATCH', 'PASTEURIZED', $2, $3, $4)
      `, [batch_id, req.session.user.user_id, Number(temperature),
        `Pasteurized at ${temperature}°C for ${duration_minutes} min`]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await logAudit(req.session.user.user_id, req.session.user.username, 'BATCH_PASTEURIZED',
      `Batch ${batch_id}: ${temperature}°C for ${duration_minutes} min`, req.ip);

    res.json({ success: true, message: `Batch ${batch_id} pasteurization logged. Awaiting lab tests.` });
  } catch (err) {
    console.error('Error logging pasteurization:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/batches/labtest — Record lab test results
router.post('/labtest', requireAuth, requireRole('medtech'), async (req, res) => {
  const { batch_id, pre_test_result, post_test_result, pre_bacterial_count, post_bacterial_count } = req.body;

  if (!batch_id || !pre_test_result || !post_test_result) {
    return res.status(400).json({ error: 'Both pre and post test results are required.' });
  }

  // C-05: Bacterial count is mandatory per §3.7 (DOH PHM Guidelines)
  if (!pre_bacterial_count || !post_bacterial_count ||
      String(pre_bacterial_count).trim() === '' || String(post_bacterial_count).trim() === '') {
    return res.status(400).json({
      error: 'Both pre-pasteurization and post-pasteurization bacterial count values are required before updating batch status (e.g., \'<10 CFU/ml\' or \'0 CFU/ml\').'
    });
  }

  try {
    const batchRes = await db.query('SELECT * FROM pasteurization_batches WHERE batch_id = $1', [batch_id]);
    const batch = batchRes.rows[0];
    if (!batch) return res.status(404).json({ error: 'Batch not found.' });

    // Determine batch status based on lab results and pasteurization data
    let newStatus = 'PASS';

    if (pre_test_result === 'FAIL' || post_test_result === 'FAIL') {
      newStatus = 'LOCKED';
    } else if (batch.temperature < 62.5 || batch.duration_minutes < 30) {
      newStatus = 'LOCKED';
    }

    // Calculate expiration date (1 year from now for passing batches)
    const expirationDate = newStatus === 'PASS'
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : null;

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        UPDATE pasteurization_batches SET
          pre_test_result = $1,
          post_test_result = $2,
          pre_bacterial_count = $3,
          post_bacterial_count = $4,
          batch_status = $5,
          expiration_date = $6,
          updated_at = CURRENT_TIMESTAMP
        WHERE batch_id = $7
      `, [pre_test_result, post_test_result, String(pre_bacterial_count).trim(), String(post_bacterial_count).trim(), newStatus, expirationDate, batch_id]);

      // C-01 FIX: Update linked donation statuses unconditionally (overrides any prior QUARANTINED state)
      // PASS → PASTEURIZED, LOCKED → QUARANTINED
      const statusUpdate = newStatus === 'PASS' ? 'PASTEURIZED' : 'QUARANTINED';
      const donationIdsRes = await client.query('SELECT donation_id FROM batch_donations WHERE batch_id = $1', [batch_id]);
      for (const d of donationIdsRes.rows) {
        // No WHERE condition on current status — always override to the correct post-lab status
        await client.query('UPDATE milk_donations SET storage_status = $1 WHERE donation_id = $2', [statusUpdate, d.donation_id]);
      }

      // If LOCKED, create notification for admin
      if (newStatus === 'LOCKED') {
        const adminsRes = await client.query("SELECT user_id FROM users WHERE role = 'admin'");
        for (const admin of adminsRes.rows) {
          await client.query(`
            INSERT INTO notifications (notification_id, user_id, type, title, message)
            VALUES ($1, $2, 'ALERT', $3, $4)
          `, [uuidv4(), admin.user_id, `Batch ${batch_id} FAILED Lab Test`,
            `Batch ${batch_id} has been locked due to failed lab results. Immediate attention required.`]);
        }
      }

      await client.query(`
        INSERT INTO chain_of_custody (reference_id, reference_type, action, performed_by, notes)
        VALUES ($1, 'BATCH', 'LAB_TESTED', $2, $3)
      `, [batch_id, req.session.user.user_id, `Pre: ${pre_test_result}, Post: ${post_test_result} → ${newStatus}`]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await logAudit(req.session.user.user_id, req.session.user.username, 'LAB_TEST_RECORDED',
      `Batch ${batch_id}: Pre=${pre_test_result}, Post=${post_test_result} → ${newStatus}`, req.ip);

    res.json({
      success: true,
      batch_status: newStatus,
      expiration_date: expirationDate,
      message: newStatus === 'PASS'
        ? `Batch ${batch_id} PASSED — Ready for dispensing. Expires: ${expirationDate}`
        : `Batch ${batch_id} FAILED — Locked from dispensing immediately.`
    });
  } catch (err) {
    console.error('Error during lab test recording:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/batches/storage — Log post-pasteurization storage
router.post('/storage', requireAuth, requireRole('nurse', 'admin', 'medtech'), async (req, res) => {
  const { batch_id, storage_location } = req.body;
  if (!batch_id) return res.status(400).json({ error: 'Batch ID required.' });

  try {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        UPDATE pasteurization_batches SET storage_location = $1, updated_at = CURRENT_TIMESTAMP WHERE batch_id = $2
      `, [storage_location || 'Freezer A', batch_id]);

      await client.query(`
        INSERT INTO chain_of_custody (reference_id, reference_type, action, performed_by, location, temperature, notes)
        VALUES ($1, 'BATCH', 'POST_PASTEURIZATION_STORED', $2, $3, -20, 'Stored at -20°C post-pasteurization')
      `, [batch_id, req.session.user.user_id, storage_location || 'Freezer A']);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await logAudit(req.session.user.user_id, req.session.user.username, 'BATCH_STORED',
      `Batch ${batch_id} stored at ${storage_location || 'Freezer A'}`, req.ip);

    res.json({ success: true, message: 'Post-pasteurization storage logged.' });
  } catch (err) {
    console.error('Error logging post-pasteurization storage:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/batches — List all batches
router.get('/', requireAuth, async (req, res) => {
  try {
    const batchesRes = await db.query(`
      SELECT pb.*,
        (SELECT string_agg(bd.donation_id, ',') FROM batch_donations bd WHERE bd.batch_id = pb.batch_id) as donation_ids,
        (SELECT SUM(md.volume_ml) FROM batch_donations bd JOIN milk_donations md ON bd.donation_id = md.donation_id WHERE bd.batch_id = pb.batch_id) as total_volume_ml
      FROM pasteurization_batches pb
      ORDER BY pb.created_at DESC
    `);
    res.json(batchesRes.rows);
  } catch (err) {
    console.error('Error listing batches:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/batches/:id — Get batch details
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const batchRes = await db.query('SELECT * FROM pasteurization_batches WHERE batch_id = $1', [req.params.id]);
    const batch = batchRes.rows[0];
    if (!batch) return res.status(404).json({ error: 'Batch not found.' });

    const donationsRes = await db.query(`
      SELECT md.*, d.first_name, d.last_name
      FROM batch_donations bd
      JOIN milk_donations md ON bd.donation_id = md.donation_id
      JOIN donors d ON md.donor_id = d.donor_id
      WHERE bd.batch_id = $1
    `, [req.params.id]);

    const custodyRes = await db.query(`
      SELECT coc.*, u.first_name, u.last_name
      FROM chain_of_custody coc
      JOIN users u ON coc.performed_by = u.user_id
      WHERE coc.reference_id = $1
      ORDER BY coc.timestamp ASC
    `, [req.params.id]);

    res.json({ ...batch, donations: donationsRes.rows, custody: custodyRes.rows });
  } catch (err) {
    console.error('Error getting batch details:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
