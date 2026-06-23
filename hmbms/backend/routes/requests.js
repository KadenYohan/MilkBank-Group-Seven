// ============================================================
// HMBMS — Milk Request Routes (Stage 7 - PostgreSQL)
// Request submission, tracking, payment
// ============================================================

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole, logAudit } = require('../middleware');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const db = require('../db');
const { sendMilkReadySMS } = require('../utils/smsService');

// Multer config for prescription uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => cb(null, 'rx-' + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// POST /api/requests/submit — Submit milk request (Recipient)
router.post('/submit', requireAuth, requireRole('recipient'), upload.single('prescription'), async (req, res) => {
  const { requested_volume_ml } = req.body;

  if (!requested_volume_ml || isNaN(requested_volume_ml) || Number(requested_volume_ml) <= 0) {
    return res.status(400).json({ error: 'Valid requested volume is required.' });
  }

  try {
    const recipientRes = await db.query('SELECT * FROM recipients WHERE user_id = $1', [req.session.user.user_id]);
    const recipient = recipientRes.rows[0];
    if (!recipient) return res.status(404).json({ error: 'Recipient profile not found.' });

    const request_id = 'REQ-' + Date.now().toString(36).toUpperCase();
    const tracking_code = 'TRK-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        INSERT INTO milk_requests (request_id, recipient_id, tracking_code, requested_volume_ml, prescription_file, request_status)
        VALUES ($1, $2, $3, $4, $5, 'PENDING')
      `, [request_id, recipient.recipient_id, tracking_code,
        Number(requested_volume_ml), req.file ? req.file.filename : '']);

      // Notify admin
      const adminsRes = await client.query("SELECT user_id FROM users WHERE role = 'admin'");
      for (const admin of adminsRes.rows) {
        await client.query(`
          INSERT INTO notifications (notification_id, user_id, type, title, message)
          VALUES ($1, $2, 'ORDER_UPDATE', 'New Milk Request', $3)
        `, [uuidv4(), admin.user_id, `New milk request from ${recipient.guardian_name}: ${requested_volume_ml}ml. Tracking: ${tracking_code}`]);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await logAudit(req.session.user.user_id, req.session.user.username, 'MILK_REQUESTED',
      `Request ${request_id}: ${requested_volume_ml}ml, tracking: ${tracking_code}`, req.ip);

    res.json({
      success: true,
      request_id,
      tracking_code,
      message: `Request submitted. Your tracking code is: ${tracking_code}`
    });
  } catch (err) {
    console.error('Error submitting request:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/requests/track/:code — Track order by tracking code
router.get('/track/:code', async (req, res) => {
  try {
    const requestRes = await db.query(`
      SELECT mr.request_id, mr.tracking_code, mr.requested_volume_ml, mr.request_status,
             mr.created_at, mr.updated_at, mr.dispensed_at,
             r.infant_name, r.hospital_name, r.priority_status
      FROM milk_requests mr
      JOIN recipients r ON mr.recipient_id = r.recipient_id
      WHERE mr.tracking_code = $1
    `, [req.params.code]);
    const request = requestRes.rows[0];

    if (!request) return res.status(404).json({ error: 'Invalid tracking code. No request found with this code.' });

    // C-06: Tracking code expiry — invalidate for completed or cancelled requests (§3.8)
    if (request.request_status === 'DISPENSED' || request.request_status === 'CANCELLED') {
      return res.status(410).json({
        error: `This tracking code has expired. The milk request has been ${request.request_status.toLowerCase()}.`,
        expired: true,
        status: request.request_status
      });
    }

    res.json(request);
  } catch (err) {
    console.error('Error tracking request:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// GET /api/requests — List requests
router.get('/', requireAuth, async (req, res) => {
  let requests;

  try {
    if (req.session.user.role === 'recipient') {
      const recipientRes = await db.query('SELECT recipient_id FROM recipients WHERE user_id = $1', [req.session.user.user_id]);
      const recipient = recipientRes.rows[0];
      if (!recipient) return res.json([]);
      const requestsRes = await db.query(`
        SELECT mr.*, r.infant_name, r.guardian_name, r.hospital_name, r.priority_status
        FROM milk_requests mr
        JOIN recipients r ON mr.recipient_id = r.recipient_id
        WHERE mr.recipient_id = $1
        ORDER BY mr.created_at DESC
      `, [recipient.recipient_id]);
      requests = requestsRes.rows;
    } else {
      const requestsRes = await db.query(`
        SELECT mr.*, r.infant_name, r.guardian_name, r.hospital_name, r.priority_status
        FROM milk_requests mr
        JOIN recipients r ON mr.recipient_id = r.recipient_id
        ORDER BY
          CASE r.priority_status
            WHEN 'NICU' THEN 1
            WHEN 'MEDICALLY_FRAGILE' THEN 2
            ELSE 3
          END,
          mr.created_at ASC
      `);
      requests = requestsRes.rows;
    }

    res.json(requests);
  } catch (err) {
    console.error('Error listing requests:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/requests/:id/approve — Approve request (Admin, Nurse)
router.put('/:id/approve', requireAuth, requireRole('admin', 'nurse'), async (req, res) => {
  try {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("UPDATE milk_requests SET request_status = 'APPROVED', updated_at = CURRENT_TIMESTAMP WHERE request_id = $1", [req.params.id]);

      const requestRes = await client.query('SELECT * FROM milk_requests WHERE request_id = $1', [req.params.id]);
      const request = requestRes.rows[0];
      if (request) {
        const recipientRes = await client.query('SELECT user_id FROM recipients WHERE recipient_id = $1', [request.recipient_id]);
        const recipient = recipientRes.rows[0];
        if (recipient) {
          await client.query(`
            INSERT INTO notifications (notification_id, user_id, type, title, message)
            VALUES ($1, $2, 'ORDER_UPDATE', 'Request Approved', $3)
          `, [uuidv4(), recipient.user_id, `Your milk request (${request.tracking_code}) has been approved.`]);
        }
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await logAudit(req.session.user.user_id, req.session.user.username, 'REQUEST_APPROVED', `Request ${req.params.id}`, req.ip);
    res.json({ success: true, message: 'Request approved.' });
  } catch (err) {
    console.error('Error approving request:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/requests/:id/payment — Confirm payment (Admin, Nurse)
router.put('/:id/payment', requireAuth, requireRole('admin', 'nurse'), async (req, res) => {
  const { payment_amount } = req.body;

  try {
    await db.query(`
      UPDATE milk_requests SET
        payment_confirmed = 1,
        payment_amount = $1,
        payment_confirmed_by = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE request_id = $3
    `, [payment_amount || 0, req.session.user.user_id, req.params.id]);

    await logAudit(req.session.user.user_id, req.session.user.username, 'PAYMENT_CONFIRMED',
      `Request ${req.params.id}: ₱${payment_amount || 0}`, req.ip);
    res.json({ success: true, message: 'Payment confirmed.' });
  } catch (err) {
    console.error('Error confirming payment:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/requests/:id/ready — Mark as ready (Admin, Nurse)
router.put('/:id/ready', requireAuth, requireRole('admin', 'nurse'), async (req, res) => {
  try {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("UPDATE milk_requests SET request_status = 'READY', updated_at = CURRENT_TIMESTAMP WHERE request_id = $1", [req.params.id]);

      const requestRes = await client.query('SELECT * FROM milk_requests WHERE request_id = $1', [req.params.id]);
      const request = requestRes.rows[0];
      if (request) {
        const recipientRes = await client.query('SELECT user_id, infant_name FROM recipients WHERE recipient_id = $1', [request.recipient_id]);
        const recipient = recipientRes.rows[0];
        if (recipient) {
          await client.query(`
            INSERT INTO notifications (notification_id, user_id, type, title, message)
            VALUES ($1, $2, 'MILK_READY', 'Milk Ready for Pickup', $3)
          `, [uuidv4(), recipient.user_id, `Your milk request (${request.tracking_code}) is ready for pickup/dispensing.`]);

          // Trigger SMS Notification (SRS §4.6)
          const userRes = await client.query('SELECT phone FROM users WHERE user_id = $1', [recipient.user_id]);
          const user = userRes.rows[0];
          if (user && user.phone) {
            // Fired asynchronously so response is immediate (<60s requirement)
            sendMilkReadySMS(user.phone, request.tracking_code, recipient.infant_name)
              .catch(err => console.error('Failed to trigger SMS:', err));
          }
        }
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await logAudit(req.session.user.user_id, req.session.user.username, 'REQUEST_READY', `Request ${req.params.id}`, req.ip);
    res.json({ success: true, message: 'Request marked as ready.' });
  } catch (err) {
    console.error('Error marking request as ready:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/requests/:id/cancel — Cancel request
router.put('/:id/cancel', requireAuth, async (req, res) => {
  try {
    await db.query("UPDATE milk_requests SET request_status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE request_id = $1", [req.params.id]);
    await logAudit(req.session.user.user_id, req.session.user.username, 'REQUEST_CANCELLED', `Request ${req.params.id}`, req.ip);
    res.json({ success: true, message: 'Request cancelled.' });
  } catch (err) {
    console.error('Error cancelling request:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
