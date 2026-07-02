// ============================================================
// MHMBS — Inventory Routes (Stage 6 - PostgreSQL)
// Inventory dashboard, FIFO dispensing, prescription vault
// ============================================================

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole, logAudit } = require('../middleware');
const db = require('../db');

// GET /api/inventory — Full inventory dashboard
router.get('/', requireAuth, async (req, res) => {
  try {
    const batchesRes = await db.query(`
      SELECT pb.*,
        (SELECT SUM(md.volume_ml) FROM batch_donations bd JOIN milk_donations md ON bd.donation_id = md.donation_id WHERE bd.batch_id = pb.batch_id) as total_volume_ml,
        (SELECT COUNT(*) FROM batch_donations bd WHERE bd.batch_id = pb.batch_id) as donation_count
      FROM pasteurization_batches pb
      ORDER BY pb.created_at ASC
    `);
    const batches = batchesRes.rows;

    const summary = {
      total_batches: batches.length,
      raw: batches.filter(b => b.batch_status === 'PENDING' || b.batch_status === 'IN_PROGRESS').length,
      testing: batches.filter(b => b.batch_status === 'TESTING').length,
      ready: batches.filter(b => b.batch_status === 'PASS').length,
      locked: batches.filter(b => b.batch_status === 'LOCKED').length,
      dispensed: batches.filter(b => b.batch_status === 'DISPENSED').length,
      quarantined: batches.filter(b => b.batch_status === 'QUARANTINED').length,
      total_volume_ml: batches.reduce((sum, b) => sum + (Number(b.total_volume_ml) || 0), 0),
      ready_volume_ml: batches.filter(b => b.batch_status === 'PASS').reduce((sum, b) => sum + (Number(b.total_volume_ml) || 0), 0)
    };

    // Check for expired batches
    const today = new Date().toISOString().split('T')[0];
    const expiredBatches = batches.filter(b => b.expiration_date && new Date(b.expiration_date).toISOString().split('T')[0] < today && b.batch_status === 'PASS');

    res.json({ batches, summary, expired_batches: expiredBatches });
  } catch (err) {
    console.error('Error fetching inventory:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/inventory/fifo — Get oldest ready batch (FIFO)
router.get('/fifo', requireAuth, requireRole('admin', 'nurse', 'medtech'), async (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  try {
    const oldestReadyRes = await db.query(`
      SELECT pb.*,
        (SELECT SUM(md.volume_ml) FROM batch_donations bd JOIN milk_donations md ON bd.donation_id = md.donation_id WHERE bd.batch_id = pb.batch_id) as total_volume_ml
      FROM pasteurization_batches pb
      WHERE pb.batch_status = 'PASS'
        AND (pb.expiration_date IS NULL OR pb.expiration_date >= $1)
      ORDER BY pb.created_at ASC
      LIMIT 1
    `, [today]);
    const oldestReady = oldestReadyRes.rows[0];

    if (!oldestReady) {
      return res.json({ available: false, message: 'No ready milk batches available.' });
    }

    res.json({ available: true, batch: oldestReady, alert: '⚠️ Thawed milk must be consumed within 24 hours.' });
  } catch (err) {
    console.error('Error fetching FIFO batch:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/inventory/dispense — Dispense milk from a batch
router.post('/dispense', requireAuth, requireRole('admin', 'nurse'), async (req, res) => {
  const { batch_id, request_id } = req.body;

  if (!batch_id || !request_id) {
    return res.status(400).json({ error: 'Batch ID and Request ID are required.' });
  }

  try {
    const batchRes = await db.query('SELECT * FROM pasteurization_batches WHERE batch_id = $1 AND batch_status = $2', [batch_id, 'PASS']);
    const batch = batchRes.rows[0];
    if (!batch) return res.status(400).json({ error: 'Batch is not available for dispensing.' });

    const requestRes = await db.query('SELECT * FROM milk_requests WHERE request_id = $1', [request_id]);
    const request = requestRes.rows[0];
    if (!request) return res.status(404).json({ error: 'Request not found.' });

    // C-04: Prescription vault enforcement (TC-HMB-06, §3.8)
    if (!request.prescription_file || request.prescription_file.trim() === '') {
      return res.status(400).json({
        error: "Dispensing blocked: No doctor's prescription is on file for this request. The recipient must upload a prescription before milk can be dispensed."
      });
    }

    if (!request.payment_confirmed) {
      return res.status(400).json({ error: 'Payment must be confirmed before dispensing.' });
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      // Update batch status
      await client.query("UPDATE pasteurization_batches SET batch_status = 'DISPENSED', updated_at = CURRENT_TIMESTAMP WHERE batch_id = $1", [batch_id]);

      // C-01 FIX: Update donation statuses unconditionally (overrides any prior QUARANTINED state)
      const donationIdsRes = await client.query('SELECT donation_id FROM batch_donations WHERE batch_id = $1', [batch_id]);
      for (const d of donationIdsRes.rows) {
        await client.query("UPDATE milk_donations SET storage_status = 'DISPENSED' WHERE donation_id = $1", [d.donation_id]);
      }

      // Update request
      await client.query(`
        UPDATE milk_requests SET
          request_status = 'DISPENSED',
          assigned_batch_id = $1,
          dispensed_by = $2,
          dispensed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE request_id = $3
      `, [batch_id, req.session.user.user_id, request_id]);

      // Finalize chain of custody
      await client.query(`
        INSERT INTO chain_of_custody (reference_id, reference_type, action, performed_by, notes)
        VALUES ($1, 'BATCH', 'DISPENSED', $2, $3)
      `, [batch_id, req.session.user.user_id, `Dispensed for request ${request_id}`]);

      // H-12: Write distribution record for traceability (SRS §6)
      const { v4: uuidv4 } = require('uuid');
      const distId = 'DIST-' + Date.now().toString(36).toUpperCase();
      const requestFull = await client.query('SELECT * FROM milk_requests WHERE request_id = $1', [request_id]);
      const req_data = requestFull.rows[0];
      if (req_data) {
        await client.query(`
          INSERT INTO distributions (distribution_id, request_id, batch_id, recipient_id, dispensed_by, volume_ml, fee_amount)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [distId, request_id, batch_id, req_data.recipient_id, req.session.user.user_id,
            req_data.requested_volume_ml, req_data.payment_amount || 0]);
      }

      // H-13: Upsert storage_inventory record to REMOVED status
      await client.query(`
        INSERT INTO storage_inventory (batch_id, inventory_status)
        VALUES ($1, 'REMOVED')
        ON CONFLICT (batch_id) DO UPDATE SET inventory_status = 'REMOVED', last_checked = CURRENT_TIMESTAMP
      `, [batch_id]);

      // Notify recipient
      const recipientRes = await client.query('SELECT user_id FROM recipients WHERE recipient_id = $1', [request.recipient_id]);
      const recipient = recipientRes.rows[0];
      if (recipient) {
        await client.query(`
          INSERT INTO notifications (notification_id, user_id, type, title, message)
          VALUES ($1, $2, 'MILK_READY', 'Milk Dispensed', $3)
        `, [uuidv4(), recipient.user_id, `Your milk request (${request.tracking_code}) has been dispensed. Please collect it.`]);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await logAudit(req.session.user.user_id, req.session.user.username, 'MILK_DISPENSED',
      `Batch ${batch_id} dispensed for request ${request_id}`, req.ip);

    res.json({ success: true, message: `Batch ${batch_id} dispensed successfully.`, alert: '⚠️ Thawed milk must be consumed within 24 hours.' });
  } catch (err) {
    console.error('Error dispensing milk:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
