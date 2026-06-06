// ============================================================
// HMBMS — Batch Recall Routes (Stage 8 - PostgreSQL)
// Batch recall system for admin
// ============================================================

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole, logAudit } = require('../middleware');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

// POST /api/recalls/execute — Execute batch recall
router.post('/execute', requireAuth, requireRole('admin'), async (req, res) => {
  const { donor_id, reason, batch_ids } = req.body;

  if (!donor_id || !reason) {
    return res.status(400).json({ error: 'Donor ID and reason are required.' });
  }

  try {
    const donorRes = await db.query('SELECT * FROM donors WHERE donor_id = $1', [donor_id]);
    const donor = donorRes.rows[0];
    if (!donor) return res.status(404).json({ error: 'Donor not found.' });

    // Find all batches linked to this donor
    let affectedBatches;
    if (batch_ids && batch_ids.length > 0) {
      affectedBatches = batch_ids;
    } else {
      const donationsRes = await db.query('SELECT donation_id FROM milk_donations WHERE donor_id = $1', [donor_id]);
      const donationIds = donationsRes.rows.map(d => d.donation_id);
      if (donationIds.length === 0) {
        return res.status(404).json({ error: 'No donations found for this donor.' });
      }

      const affectedBatchesRes = await db.query(`
        SELECT DISTINCT batch_id FROM batch_donations WHERE donation_id = ANY($1::varchar[])
      `, [donationIds]);
      affectedBatches = affectedBatchesRes.rows.map(b => b.batch_id);
    }

    if (affectedBatches.length === 0) {
      return res.status(404).json({ error: 'No batches found for this donor.' });
    }

    const recall_id = 'RCL-' + Date.now().toString(36).toUpperCase();

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      // Create recall record
      await client.query(`
        INSERT INTO batch_recalls (recall_id, donor_id, reason, initiated_by, affected_batches)
        VALUES ($1, $2, $3, $4, $5)
      `, [recall_id, donor_id, reason, req.session.user.user_id, JSON.stringify(affectedBatches)]);

      // Quarantine all affected batches
      for (const batchId of affectedBatches) {
        await client.query("UPDATE pasteurization_batches SET batch_status = 'QUARANTINED', updated_at = CURRENT_TIMESTAMP WHERE batch_id = $1", [batchId]);

        // Update linked donations
        const donationIdsRes = await client.query('SELECT donation_id FROM batch_donations WHERE batch_id = $1', [batchId]);
        for (const d of donationIdsRes.rows) {
          await client.query("UPDATE milk_donations SET storage_status = 'QUARANTINED' WHERE donation_id = $1", [d.donation_id]);
        }

        // Log chain of custody
        await client.query(`
          INSERT INTO chain_of_custody (reference_id, reference_type, action, performed_by, notes)
          VALUES ($1, 'BATCH', 'RECALLED', $2, $3)
        `, [batchId, req.session.user.user_id, `Recall ${recall_id}: ${reason}`]);
      }

      // Generate high-priority alerts for all medical staff
      const staffRes = await client.query("SELECT user_id FROM users WHERE role IN ('admin', 'medtech', 'nurse')");
      for (const s of staffRes.rows) {
        await client.query(`
          INSERT INTO notifications (notification_id, user_id, type, title, message)
          VALUES ($1, $2, 'BATCH_RECALL', '🚨 BATCH RECALL ALERT', $3)
        `, [uuidv4(), s.user_id,
          `URGENT: Batch recall initiated for donor ${donor_id}. ${affectedBatches.length} batches quarantined. Physically remove from freezers immediately. Reason: ${reason}`]);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await logAudit(req.session.user.user_id, req.session.user.username, 'BATCH_RECALL_EXECUTED',
      `Recall ${recall_id}: Donor ${donor_id}, ${affectedBatches.length} batches quarantined. Reason: ${reason}`, req.ip);

    res.json({
      success: true,
      recall_id,
      affected_batches: affectedBatches,
      message: `Batch recall executed. ${affectedBatches.length} batches quarantined.`
    });
  } catch (err) {
    console.error('Error executing recall:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/recalls — List all recalls
router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const recallsRes = await db.query(`
      SELECT br.*, d.first_name, d.last_name, u.username as initiated_by_username
      FROM batch_recalls br
      JOIN donors d ON br.donor_id = d.donor_id
      JOIN users u ON br.initiated_by = u.user_id
      ORDER BY br.created_at DESC
    `);
    res.json(recallsRes.rows);
  } catch (err) {
    console.error('Error listing recalls:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
