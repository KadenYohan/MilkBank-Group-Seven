// ============================================================
// HMBMS — Inventory Routes (Stage 6)
// Inventory dashboard, FIFO dispensing, prescription vault
// ============================================================

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole, logAudit } = require('../middleware');

// GET /api/inventory — Full inventory dashboard
router.get('/', requireAuth, (req, res) => {
  const db = global.db;

  const batches = db.prepare(`
    SELECT pb.*,
      (SELECT SUM(md.volume_ml) FROM batch_donations bd JOIN milk_donations md ON bd.donation_id = md.donation_id WHERE bd.batch_id = pb.batch_id) as total_volume_ml,
      (SELECT COUNT(*) FROM batch_donations bd WHERE bd.batch_id = pb.batch_id) as donation_count
    FROM pasteurization_batches pb
    ORDER BY pb.created_at ASC
  `).all();

  const summary = {
    total_batches: batches.length,
    raw: batches.filter(b => b.batch_status === 'PENDING' || b.batch_status === 'IN_PROGRESS').length,
    testing: batches.filter(b => b.batch_status === 'TESTING').length,
    ready: batches.filter(b => b.batch_status === 'PASS').length,
    locked: batches.filter(b => b.batch_status === 'LOCKED').length,
    dispensed: batches.filter(b => b.batch_status === 'DISPENSED').length,
    quarantined: batches.filter(b => b.batch_status === 'QUARANTINED').length,
    total_volume_ml: batches.reduce((sum, b) => sum + (b.total_volume_ml || 0), 0),
    ready_volume_ml: batches.filter(b => b.batch_status === 'PASS').reduce((sum, b) => sum + (b.total_volume_ml || 0), 0)
  };

  // Check for expired batches
  const today = new Date().toISOString().split('T')[0];
  const expiredBatches = batches.filter(b => b.expiration_date && b.expiration_date < today && b.batch_status === 'PASS');

  res.json({ batches, summary, expired_batches: expiredBatches });
});

// GET /api/inventory/fifo — Get oldest ready batch (FIFO)
router.get('/fifo', requireAuth, requireRole('admin', 'nurse', 'medtech'), (req, res) => {
  const db = global.db;
  const today = new Date().toISOString().split('T')[0];

  const oldestReady = db.prepare(`
    SELECT pb.*,
      (SELECT SUM(md.volume_ml) FROM batch_donations bd JOIN milk_donations md ON bd.donation_id = md.donation_id WHERE bd.batch_id = pb.batch_id) as total_volume_ml
    FROM pasteurization_batches pb
    WHERE pb.batch_status = 'PASS'
      AND (pb.expiration_date IS NULL OR pb.expiration_date >= ?)
    ORDER BY pb.created_at ASC
    LIMIT 1
  `).get(today);

  if (!oldestReady) {
    return res.json({ available: false, message: 'No ready milk batches available.' });
  }

  res.json({ available: true, batch: oldestReady, alert: '⚠️ Thawed milk must be consumed within 24 hours.' });
});

// POST /api/inventory/dispense — Dispense milk from a batch
router.post('/dispense', requireAuth, requireRole('admin', 'nurse'), (req, res) => {
  const { batch_id, request_id } = req.body;

  if (!batch_id || !request_id) {
    return res.status(400).json({ error: 'Batch ID and Request ID are required.' });
  }

  const db = global.db;
  const batch = db.prepare('SELECT * FROM pasteurization_batches WHERE batch_id = ? AND batch_status = ?').get(batch_id, 'PASS');
  if (!batch) return res.status(400).json({ error: 'Batch is not available for dispensing.' });

  const request = db.prepare('SELECT * FROM milk_requests WHERE request_id = ?').get(request_id);
  if (!request) return res.status(404).json({ error: 'Request not found.' });

  if (!request.payment_confirmed) {
    return res.status(400).json({ error: 'Payment must be confirmed before dispensing.' });
  }

  const transaction = db.transaction(() => {
    // Update batch status
    db.prepare("UPDATE pasteurization_batches SET batch_status = 'DISPENSED', updated_at = DATETIME('now') WHERE batch_id = ?").run(batch_id);

    // Update donations
    const donationIds = db.prepare('SELECT donation_id FROM batch_donations WHERE batch_id = ?').all(batch_id);
    for (const d of donationIds) {
      db.prepare("UPDATE milk_donations SET storage_status = 'DISPENSED' WHERE donation_id = ?").run(d.donation_id);
    }

    // Update request
    db.prepare(`
      UPDATE milk_requests SET
        request_status = 'DISPENSED',
        assigned_batch_id = ?,
        dispensed_by = ?,
        dispensed_at = DATETIME('now'),
        updated_at = DATETIME('now')
      WHERE request_id = ?
    `).run(batch_id, req.session.user.user_id, request_id);

    // Finalize chain of custody
    db.prepare(`
      INSERT INTO chain_of_custody (reference_id, reference_type, action, performed_by, notes)
      VALUES (?, 'BATCH', 'DISPENSED', ?, ?)
    `).run(batch_id, req.session.user.user_id, `Dispensed for request ${request_id}`);

    // Notify recipient
    const { v4: uuidv4 } = require('uuid');
    const recipient = db.prepare('SELECT user_id FROM recipients WHERE recipient_id = ?').get(request.recipient_id);
    if (recipient) {
      db.prepare(`
        INSERT INTO notifications (notification_id, user_id, type, title, message)
        VALUES (?, ?, 'MILK_READY', 'Milk Dispensed', ?)
      `).run(uuidv4(), recipient.user_id, `Your milk request (${request.tracking_code}) has been dispensed. Please collect it.`);
    }
  });

  transaction();

  logAudit(req.session.user.user_id, req.session.user.username, 'MILK_DISPENSED',
    `Batch ${batch_id} dispensed for request ${request_id}`, req.ip);

  res.json({ success: true, message: `Batch ${batch_id} dispensed successfully.`, alert: '⚠️ Thawed milk must be consumed within 24 hours.' });
});

module.exports = router;
