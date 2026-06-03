// ============================================================
// HMBMS — Batch Recall Routes (Stage 8)
// Batch recall system for admin
// ============================================================

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole, logAudit } = require('../middleware');
const { v4: uuidv4 } = require('uuid');

// POST /api/recalls/execute — Execute batch recall
router.post('/execute', requireAuth, requireRole('admin'), (req, res) => {
  const { donor_id, reason, batch_ids } = req.body;

  if (!donor_id || !reason) {
    return res.status(400).json({ error: 'Donor ID and reason are required.' });
  }

  const db = global.db;
  const donor = db.prepare('SELECT * FROM donors WHERE donor_id = ?').get(donor_id);
  if (!donor) return res.status(404).json({ error: 'Donor not found.' });

  // Find all batches linked to this donor
  let affectedBatches;
  if (batch_ids && batch_ids.length > 0) {
    affectedBatches = batch_ids;
  } else {
    const donations = db.prepare('SELECT donation_id FROM milk_donations WHERE donor_id = ?').all(donor_id);
    const donationIds = donations.map(d => d.donation_id);
    if (donationIds.length === 0) {
      return res.status(404).json({ error: 'No donations found for this donor.' });
    }

    const placeholders = donationIds.map(() => '?').join(',');
    affectedBatches = db.prepare(`
      SELECT DISTINCT batch_id FROM batch_donations WHERE donation_id IN (${placeholders})
    `).all(...donationIds).map(b => b.batch_id);
  }

  if (affectedBatches.length === 0) {
    return res.status(404).json({ error: 'No batches found for this donor.' });
  }

  const recall_id = 'RCL-' + Date.now().toString(36).toUpperCase();

  const transaction = db.transaction(() => {
    // Create recall record
    db.prepare(`
      INSERT INTO batch_recalls (recall_id, donor_id, reason, initiated_by, affected_batches)
      VALUES (?, ?, ?, ?, ?)
    `).run(recall_id, donor_id, reason, req.session.user.user_id, JSON.stringify(affectedBatches));

    // Quarantine all affected batches
    for (const batchId of affectedBatches) {
      db.prepare("UPDATE pasteurization_batches SET batch_status = 'QUARANTINED', updated_at = DATETIME('now') WHERE batch_id = ?").run(batchId);

      // Update linked donations
      const donationIds = db.prepare('SELECT donation_id FROM batch_donations WHERE batch_id = ?').all(batchId);
      for (const d of donationIds) {
        db.prepare("UPDATE milk_donations SET storage_status = 'QUARANTINED' WHERE donation_id = ?").run(d.donation_id);
      }

      // Log chain of custody
      db.prepare(`
        INSERT INTO chain_of_custody (reference_id, reference_type, action, performed_by, notes)
        VALUES (?, 'BATCH', 'RECALLED', ?, ?)
      `).run(batchId, req.session.user.user_id, `Recall ${recall_id}: ${reason}`);
    }

    // Generate high-priority alerts for all medical staff
    const staff = db.prepare("SELECT user_id FROM users WHERE role IN ('admin', 'medtech', 'nurse')").all();
    for (const s of staff) {
      db.prepare(`
        INSERT INTO notifications (notification_id, user_id, type, title, message)
        VALUES (?, ?, 'BATCH_RECALL', '🚨 BATCH RECALL ALERT', ?)
      `).run(uuidv4(), s.user_id,
        `URGENT: Batch recall initiated for donor ${donor_id}. ${affectedBatches.length} batches quarantined. Physically remove from freezers immediately. Reason: ${reason}`);
    }
  });

  transaction();

  logAudit(req.session.user.user_id, req.session.user.username, 'BATCH_RECALL_EXECUTED',
    `Recall ${recall_id}: Donor ${donor_id}, ${affectedBatches.length} batches quarantined. Reason: ${reason}`, req.ip);

  res.json({
    success: true,
    recall_id,
    affected_batches: affectedBatches,
    message: `Batch recall executed. ${affectedBatches.length} batches quarantined.`
  });
});

// GET /api/recalls — List all recalls
router.get('/', requireAuth, requireRole('admin'), (req, res) => {
  const db = global.db;
  const recalls = db.prepare(`
    SELECT br.*, d.first_name, d.last_name, u.username as initiated_by_username
    FROM batch_recalls br
    JOIN donors d ON br.donor_id = d.donor_id
    JOIN users u ON br.initiated_by = u.user_id
    ORDER BY br.created_at DESC
  `).all();
  res.json(recalls);
});

module.exports = router;
