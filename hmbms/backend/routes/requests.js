// ============================================================
// HMBMS — Milk Request Routes (Stage 7)
// Request submission, tracking, payment
// ============================================================

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole, logAudit } = require('../middleware');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');

// Multer config for prescription uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => cb(null, 'rx-' + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// POST /api/requests/submit — Submit milk request (Recipient)
router.post('/submit', requireAuth, requireRole('recipient'), upload.single('prescription'), (req, res) => {
  const { requested_volume_ml } = req.body;

  if (!requested_volume_ml || isNaN(requested_volume_ml) || Number(requested_volume_ml) <= 0) {
    return res.status(400).json({ error: 'Valid requested volume is required.' });
  }

  const db = global.db;
  const recipient = db.prepare('SELECT * FROM recipients WHERE user_id = ?').get(req.session.user.user_id);
  if (!recipient) return res.status(404).json({ error: 'Recipient profile not found.' });

  const request_id = 'REQ-' + Date.now().toString(36).toUpperCase();
  const tracking_code = 'TRK-' + Math.random().toString(36).substring(2, 8).toUpperCase();

  db.prepare(`
    INSERT INTO milk_requests (request_id, recipient_id, tracking_code, requested_volume_ml, prescription_file, request_status)
    VALUES (?, ?, ?, ?, ?, 'PENDING')
  `).run(request_id, recipient.recipient_id, tracking_code,
    Number(requested_volume_ml), req.file ? req.file.filename : '');

  logAudit(req.session.user.user_id, req.session.user.username, 'MILK_REQUESTED',
    `Request ${request_id}: ${requested_volume_ml}ml, tracking: ${tracking_code}`, req.ip);

  // Notify admin
  const admins = db.prepare("SELECT user_id FROM users WHERE role = 'admin'").all();
  for (const admin of admins) {
    db.prepare(`
      INSERT INTO notifications (notification_id, user_id, type, title, message)
      VALUES (?, ?, 'ORDER_UPDATE', 'New Milk Request', ?)
    `).run(uuidv4(), admin.user_id, `New milk request from ${recipient.guardian_name}: ${requested_volume_ml}ml. Tracking: ${tracking_code}`);
  }

  res.json({
    success: true,
    request_id,
    tracking_code,
    message: `Request submitted. Your tracking code is: ${tracking_code}`
  });
});

// GET /api/requests/track/:code — Track order by tracking code
router.get('/track/:code', (req, res) => {
  const db = global.db;
  const request = db.prepare(`
    SELECT mr.request_id, mr.tracking_code, mr.requested_volume_ml, mr.request_status,
           mr.created_at, mr.updated_at, mr.dispensed_at,
           r.infant_name, r.hospital_name, r.priority_status
    FROM milk_requests mr
    JOIN recipients r ON mr.recipient_id = r.recipient_id
    WHERE mr.tracking_code = ?
  `).get(req.params.code);

  if (!request) return res.status(404).json({ error: 'Invalid tracking code.' });

  res.json(request);
});

// GET /api/requests — List requests
router.get('/', requireAuth, (req, res) => {
  const db = global.db;
  let requests;

  if (req.session.user.role === 'recipient') {
    const recipient = db.prepare('SELECT recipient_id FROM recipients WHERE user_id = ?').get(req.session.user.user_id);
    if (!recipient) return res.json([]);
    requests = db.prepare(`
      SELECT mr.*, r.infant_name, r.guardian_name, r.hospital_name, r.priority_status
      FROM milk_requests mr
      JOIN recipients r ON mr.recipient_id = r.recipient_id
      WHERE mr.recipient_id = ?
      ORDER BY mr.created_at DESC
    `).all(recipient.recipient_id);
  } else {
    requests = db.prepare(`
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
    `).all();
  }

  res.json(requests);
});

// PUT /api/requests/:id/approve — Approve request (Admin, Nurse)
router.put('/:id/approve', requireAuth, requireRole('admin', 'nurse'), (req, res) => {
  const db = global.db;
  db.prepare("UPDATE milk_requests SET request_status = 'APPROVED', updated_at = DATETIME('now') WHERE request_id = ?").run(req.params.id);

  const request = db.prepare('SELECT * FROM milk_requests WHERE request_id = ?').get(req.params.id);
  if (request) {
    const recipient = db.prepare('SELECT user_id FROM recipients WHERE recipient_id = ?').get(request.recipient_id);
    if (recipient) {
      db.prepare(`
        INSERT INTO notifications (notification_id, user_id, type, title, message)
        VALUES (?, ?, 'ORDER_UPDATE', 'Request Approved', ?)
      `).run(uuidv4(), recipient.user_id, `Your milk request (${request.tracking_code}) has been approved.`);
    }
  }

  logAudit(req.session.user.user_id, req.session.user.username, 'REQUEST_APPROVED', `Request ${req.params.id}`, req.ip);
  res.json({ success: true, message: 'Request approved.' });
});

// PUT /api/requests/:id/payment — Confirm payment (Admin, Nurse)
router.put('/:id/payment', requireAuth, requireRole('admin', 'nurse'), (req, res) => {
  const { payment_amount } = req.body;
  const db = global.db;

  db.prepare(`
    UPDATE milk_requests SET
      payment_confirmed = 1,
      payment_amount = ?,
      payment_confirmed_by = ?,
      updated_at = DATETIME('now')
    WHERE request_id = ?
  `).run(payment_amount || 0, req.session.user.user_id, req.params.id);

  logAudit(req.session.user.user_id, req.session.user.username, 'PAYMENT_CONFIRMED',
    `Request ${req.params.id}: ₱${payment_amount || 0}`, req.ip);
  res.json({ success: true, message: 'Payment confirmed.' });
});

// PUT /api/requests/:id/ready — Mark as ready (Admin, Nurse)
router.put('/:id/ready', requireAuth, requireRole('admin', 'nurse'), (req, res) => {
  const db = global.db;
  db.prepare("UPDATE milk_requests SET request_status = 'READY', updated_at = DATETIME('now') WHERE request_id = ?").run(req.params.id);

  const request = db.prepare('SELECT * FROM milk_requests WHERE request_id = ?').get(req.params.id);
  if (request) {
    const recipient = db.prepare('SELECT user_id FROM recipients WHERE recipient_id = ?').get(request.recipient_id);
    if (recipient) {
      db.prepare(`
        INSERT INTO notifications (notification_id, user_id, type, title, message)
        VALUES (?, ?, 'MILK_READY', 'Milk Ready for Pickup', ?)
      `).run(uuidv4(), recipient.user_id, `Your milk request (${request.tracking_code}) is ready for pickup/dispensing.`);
    }
  }

  logAudit(req.session.user.user_id, req.session.user.username, 'REQUEST_READY', `Request ${req.params.id}`, req.ip);
  res.json({ success: true, message: 'Request marked as ready.' });
});

// PUT /api/requests/:id/cancel — Cancel request
router.put('/:id/cancel', requireAuth, (req, res) => {
  const db = global.db;
  db.prepare("UPDATE milk_requests SET request_status = 'CANCELLED', updated_at = DATETIME('now') WHERE request_id = ?").run(req.params.id);
  logAudit(req.session.user.user_id, req.session.user.username, 'REQUEST_CANCELLED', `Request ${req.params.id}`, req.ip);
  res.json({ success: true, message: 'Request cancelled.' });
});

module.exports = router;
