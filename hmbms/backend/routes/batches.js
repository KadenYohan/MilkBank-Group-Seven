// ============================================================
// HMBMS — Pasteurization Batch Routes (Stage 5)
// Batch management, lab tests, safety validation
// ============================================================

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole, logAudit } = require('../middleware');

// POST /api/batches/create — Create a new pasteurization batch
router.post('/create', requireAuth, requireRole('admin', 'medtech', 'nurse'), (req, res) => {
  const { donation_ids, thaw_confirmed, laminar_flow_confirmed } = req.body;

  if (!donation_ids || !Array.isArray(donation_ids) || donation_ids.length === 0) {
    return res.status(400).json({ error: 'At least one donation must be assigned to a batch.' });
  }

  const db = global.db;
  const batch_id = 'BTH-' + Date.now().toString(36).toUpperCase();

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO pasteurization_batches (batch_id, thaw_confirmed, laminar_flow_confirmed, batch_status)
      VALUES (?, ?, ?, 'PENDING')
    `).run(batch_id, thaw_confirmed ? 1 : 0, laminar_flow_confirmed ? 1 : 0);

    for (const donId of donation_ids) {
      db.prepare('INSERT INTO batch_donations (batch_id, donation_id) VALUES (?, ?)').run(batch_id, donId);
      db.prepare("UPDATE milk_donations SET storage_status = 'ASSIGNED_TO_BATCH' WHERE donation_id = ?").run(donId);
    }

    db.prepare(`
      INSERT INTO chain_of_custody (reference_id, reference_type, action, performed_by, notes)
      VALUES (?, 'BATCH', 'BATCH_CREATED', ?, ?)
    `).run(batch_id, req.session.user.user_id, `Batch created with ${donation_ids.length} donations`);
  });

  transaction();

  logAudit(req.session.user.user_id, req.session.user.username, 'BATCH_CREATED',
    `Batch ${batch_id} with ${donation_ids.length} donations`, req.ip);

  res.json({ success: true, batch_id, message: `Batch ${batch_id} created.` });
});

// POST /api/batches/pasteurize — Log pasteurization process
router.post('/pasteurize', requireAuth, requireRole('admin', 'medtech', 'nurse'), (req, res) => {
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

  const db = global.db;

  db.prepare(`
    UPDATE pasteurization_batches SET
      start_time = ?,
      end_time = ?,
      temperature = ?,
      duration_minutes = ?,
      technician_id = ?,
      technician_name = ?,
      batch_status = 'TESTING',
      updated_at = DATETIME('now')
    WHERE batch_id = ?
  `).run(start_time, end_time, Number(temperature), Number(duration_minutes),
    req.session.user.user_id, technician_name || req.session.user.first_name + ' ' + req.session.user.last_name, batch_id);

  db.prepare(`
    INSERT INTO chain_of_custody (reference_id, reference_type, action, performed_by, temperature, notes)
    VALUES (?, 'BATCH', 'PASTEURIZED', ?, ?, ?)
  `).run(batch_id, req.session.user.user_id, Number(temperature),
    `Pasteurized at ${temperature}°C for ${duration_minutes} min`);

  logAudit(req.session.user.user_id, req.session.user.username, 'BATCH_PASTEURIZED',
    `Batch ${batch_id}: ${temperature}°C for ${duration_minutes} min`, req.ip);

  res.json({ success: true, message: `Batch ${batch_id} pasteurization logged. Awaiting lab tests.` });
});

// POST /api/batches/labtest — Record lab test results
router.post('/labtest', requireAuth, requireRole('medtech'), (req, res) => {
  const { batch_id, pre_test_result, post_test_result, pre_bacterial_count, post_bacterial_count } = req.body;

  if (!batch_id || !pre_test_result || !post_test_result) {
    return res.status(400).json({ error: 'Both pre and post test results are required.' });
  }

  const db = global.db;
  const batch = db.prepare('SELECT * FROM pasteurization_batches WHERE batch_id = ?').get(batch_id);
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

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE pasteurization_batches SET
        pre_test_result = ?,
        post_test_result = ?,
        pre_bacterial_count = ?,
        post_bacterial_count = ?,
        batch_status = ?,
        expiration_date = ?,
        updated_at = DATETIME('now')
      WHERE batch_id = ?
    `).run(pre_test_result, post_test_result, pre_bacterial_count || '', post_bacterial_count || '', newStatus, expirationDate, batch_id);

    // Update linked donations
    const statusUpdate = newStatus === 'PASS' ? 'PASTEURIZED' : 'QUARANTINED';
    const donationIds = db.prepare('SELECT donation_id FROM batch_donations WHERE batch_id = ?').all(batch_id);
    for (const d of donationIds) {
      db.prepare('UPDATE milk_donations SET storage_status = ? WHERE donation_id = ?').run(statusUpdate, d.donation_id);
    }

    // If LOCKED, create notification for admin
    if (newStatus === 'LOCKED') {
      const { v4: uuidv4 } = require('uuid');
      const admins = db.prepare("SELECT user_id FROM users WHERE role = 'admin'").all();
      for (const admin of admins) {
        db.prepare(`
          INSERT INTO notifications (notification_id, user_id, type, title, message)
          VALUES (?, ?, 'ALERT', ?, ?)
        `).run(uuidv4(), admin.user_id, `Batch ${batch_id} FAILED Lab Test`,
          `Batch ${batch_id} has been locked due to failed lab results. Immediate attention required.`);
      }
    }

    db.prepare(`
      INSERT INTO chain_of_custody (reference_id, reference_type, action, performed_by, notes)
      VALUES (?, 'BATCH', 'LAB_TESTED', ?, ?)
    `).run(batch_id, req.session.user.user_id, `Pre: ${pre_test_result}, Post: ${post_test_result} → ${newStatus}`);
  });

  transaction();

  logAudit(req.session.user.user_id, req.session.user.username, 'LAB_TEST_RECORDED',
    `Batch ${batch_id}: Pre=${pre_test_result}, Post=${post_test_result} → ${newStatus}`, req.ip);

  res.json({
    success: true,
    batch_status: newStatus,
    expiration_date: expirationDate,
    message: newStatus === 'PASS'
      ? `Batch ${batch_id} PASSED — Ready for dispensing. Expires: ${expirationDate}`
      : `Batch ${batch_id} FAILED — Locked from dispensing immediately.`
  });
});

// POST /api/batches/storage — Log post-pasteurization storage
router.post('/storage', requireAuth, requireRole('nurse', 'admin', 'medtech'), (req, res) => {
  const { batch_id, storage_location } = req.body;
  if (!batch_id) return res.status(400).json({ error: 'Batch ID required.' });

  const db = global.db;
  db.prepare(`
    UPDATE pasteurization_batches SET storage_location = ?, updated_at = DATETIME('now') WHERE batch_id = ?
  `).run(storage_location || 'Freezer A', batch_id);

  db.prepare(`
    INSERT INTO chain_of_custody (reference_id, reference_type, action, performed_by, location, temperature, notes)
    VALUES (?, 'BATCH', 'POST_PASTEURIZATION_STORED', ?, ?, -20, 'Stored at -20°C post-pasteurization')
  `).run(batch_id, req.session.user.user_id, storage_location || 'Freezer A');

  logAudit(req.session.user.user_id, req.session.user.username, 'BATCH_STORED',
    `Batch ${batch_id} stored at ${storage_location || 'Freezer A'}`, req.ip);

  res.json({ success: true, message: 'Post-pasteurization storage logged.' });
});

// GET /api/batches — List all batches
router.get('/', requireAuth, (req, res) => {
  const db = global.db;
  const batches = db.prepare(`
    SELECT pb.*,
      (SELECT GROUP_CONCAT(bd.donation_id) FROM batch_donations bd WHERE bd.batch_id = pb.batch_id) as donation_ids,
      (SELECT SUM(md.volume_ml) FROM batch_donations bd JOIN milk_donations md ON bd.donation_id = md.donation_id WHERE bd.batch_id = pb.batch_id) as total_volume_ml
    FROM pasteurization_batches pb
    ORDER BY pb.created_at DESC
  `).all();
  res.json(batches);
});

// GET /api/batches/:id — Get batch details
router.get('/:id', requireAuth, (req, res) => {
  const db = global.db;
  const batch = db.prepare('SELECT * FROM pasteurization_batches WHERE batch_id = ?').get(req.params.id);
  if (!batch) return res.status(404).json({ error: 'Batch not found.' });

  const donations = db.prepare(`
    SELECT md.*, d.first_name, d.last_name
    FROM batch_donations bd
    JOIN milk_donations md ON bd.donation_id = md.donation_id
    JOIN donors d ON md.donor_id = d.donor_id
    WHERE bd.batch_id = ?
  `).all(req.params.id);

  const custody = db.prepare(`
    SELECT coc.*, u.first_name, u.last_name
    FROM chain_of_custody coc
    JOIN users u ON coc.performed_by = u.user_id
    WHERE coc.reference_id = ?
    ORDER BY coc.timestamp ASC
  `).all(req.params.id);

  res.json({ ...batch, donations, custody });
});

module.exports = router;
