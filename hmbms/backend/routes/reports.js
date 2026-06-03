// ============================================================
// HMBMS — Report Routes (Stage 9)
// Analytics dashboard data, report generation
// ============================================================

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware');

// GET /api/reports/dashboard — Main dashboard stats
router.get('/dashboard', requireAuth, (req, res) => {
  const db = global.db;

  const totalDonors = db.prepare("SELECT COUNT(*) as c FROM donors").get().c;
  const approvedDonors = db.prepare("SELECT COUNT(*) as c FROM donors WHERE screening_status='APPROVED'").get().c;
  const totalDonations = db.prepare("SELECT COUNT(*) as c FROM milk_donations").get().c;
  const totalVolume = db.prepare("SELECT COALESCE(SUM(volume_ml),0) as v FROM milk_donations").get().v;
  const totalBatches = db.prepare("SELECT COUNT(*) as c FROM pasteurization_batches").get().c;
  const readyBatches = db.prepare("SELECT COUNT(*) as c FROM pasteurization_batches WHERE batch_status='PASS'").get().c;
  const lockedBatches = db.prepare("SELECT COUNT(*) as c FROM pasteurization_batches WHERE batch_status='LOCKED'").get().c;
  const dispensedBatches = db.prepare("SELECT COUNT(*) as c FROM pasteurization_batches WHERE batch_status='DISPENSED'").get().c;
  const quarantinedBatches = db.prepare("SELECT COUNT(*) as c FROM pasteurization_batches WHERE batch_status='QUARANTINED'").get().c;
  const totalRequests = db.prepare("SELECT COUNT(*) as c FROM milk_requests").get().c;
  const pendingRequests = db.prepare("SELECT COUNT(*) as c FROM milk_requests WHERE request_status='PENDING'").get().c;
  const totalRecipients = db.prepare("SELECT COUNT(*) as c FROM recipients").get().c;
  const totalRecalls = db.prepare("SELECT COUNT(*) as c FROM batch_recalls").get().c;
  const totalAppointments = db.prepare("SELECT COUNT(*) as c FROM appointments WHERE status='SCHEDULED'").get().c;

  res.json({
    donors: { total: totalDonors, approved: approvedDonors },
    donations: { total: totalDonations, total_volume_ml: totalVolume },
    batches: { total: totalBatches, ready: readyBatches, locked: lockedBatches, dispensed: dispensedBatches, quarantined: quarantinedBatches },
    requests: { total: totalRequests, pending: pendingRequests },
    recipients: { total: totalRecipients },
    recalls: { total: totalRecalls },
    appointments: { scheduled: totalAppointments }
  });
});

// GET /api/reports/collections — Milk collection report
router.get('/collections', requireAuth, requireRole('admin'), (req, res) => {
  const db = global.db;
  const { period } = req.query; // week, month, year

  let dateFilter = '';
  if (period === 'week') {
    dateFilter = "AND md.donation_date >= DATE('now', '-7 days')";
  } else if (period === 'month') {
    dateFilter = "AND md.donation_date >= DATE('now', '-30 days')";
  } else if (period === 'year') {
    dateFilter = "AND md.donation_date >= DATE('now', '-365 days')";
  }

  const collections = db.prepare(`
    SELECT
      md.donation_date as date,
      COUNT(*) as donation_count,
      SUM(md.volume_ml) as total_volume_ml
    FROM milk_donations md
    WHERE 1=1 ${dateFilter}
    GROUP BY md.donation_date
    ORDER BY md.donation_date DESC
  `).all();

  const totalVolume = collections.reduce((s, c) => s + (c.total_volume_ml || 0), 0);
  const totalDonations = collections.reduce((s, c) => s + c.donation_count, 0);

  res.json({ collections, summary: { total_volume_ml: totalVolume, total_donations: totalDonations, period: period || 'all' } });
});

// GET /api/reports/dispensing — Dispensing report
router.get('/dispensing', requireAuth, requireRole('admin'), (req, res) => {
  const db = global.db;
  const { period } = req.query;

  let dateFilter = '';
  if (period === 'week') {
    dateFilter = "AND mr.dispensed_at >= DATETIME('now', '-7 days')";
  } else if (period === 'month') {
    dateFilter = "AND mr.dispensed_at >= DATETIME('now', '-30 days')";
  } else if (period === 'year') {
    dateFilter = "AND mr.dispensed_at >= DATETIME('now', '-365 days')";
  }

  const dispensed = db.prepare(`
    SELECT
      DATE(mr.dispensed_at) as date,
      COUNT(*) as dispense_count,
      SUM(mr.requested_volume_ml) as total_volume_ml
    FROM milk_requests mr
    WHERE mr.request_status = 'DISPENSED' ${dateFilter}
    GROUP BY DATE(mr.dispensed_at)
    ORDER BY date DESC
  `).all();

  res.json({ dispensed, period: period || 'all' });
});

// GET /api/reports/batch-results — Batch pass/fail rates
router.get('/batch-results', requireAuth, requireRole('admin'), (req, res) => {
  const db = global.db;

  const results = db.prepare(`
    SELECT
      batch_status,
      COUNT(*) as count
    FROM pasteurization_batches
    WHERE batch_status IN ('PASS', 'LOCKED', 'DISPENSED', 'QUARANTINED')
    GROUP BY batch_status
  `).all();

  res.json(results);
});

// GET /api/reports/donor-trends — Donor enrollment trends
router.get('/donor-trends', requireAuth, requireRole('admin'), (req, res) => {
  const db = global.db;

  const trends = db.prepare(`
    SELECT
      DATE(created_at) as date,
      COUNT(*) as new_donors,
      SUM(CASE WHEN screening_status = 'APPROVED' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN screening_status = 'EXCLUDED' THEN 1 ELSE 0 END) as excluded
    FROM donors
    GROUP BY DATE(created_at)
    ORDER BY date DESC
    LIMIT 30
  `).all();

  res.json(trends);
});

// GET /api/reports/recall-history — Recall events history
router.get('/recall-history', requireAuth, requireRole('admin'), (req, res) => {
  const db = global.db;

  const recalls = db.prepare(`
    SELECT br.*, d.first_name, d.last_name, u.username as initiated_by_name
    FROM batch_recalls br
    JOIN donors d ON br.donor_id = d.donor_id
    JOIN users u ON br.initiated_by = u.user_id
    ORDER BY br.created_at DESC
  `).all();

  res.json(recalls);
});

// GET /api/reports/chain-of-custody/:id — Chain of custody for batch
router.get('/chain-of-custody/:id', requireAuth, (req, res) => {
  const db = global.db;

  const custody = db.prepare(`
    SELECT coc.*, u.first_name, u.last_name, u.role
    FROM chain_of_custody coc
    JOIN users u ON coc.performed_by = u.user_id
    WHERE coc.reference_id = ?
    ORDER BY coc.timestamp ASC
  `).all(req.params.id);

  res.json(custody);
});

module.exports = router;
