// ============================================================
// HMBMS — Report Routes (Stage 9 - PostgreSQL)
// Analytics dashboard data, report generation
// ============================================================

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware');
const db = require('../db');

// GET /api/reports/dashboard — Main dashboard stats
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const totalDonorsRes = await db.query("SELECT COUNT(*) as c FROM donors");
    const approvedDonorsRes = await db.query("SELECT COUNT(*) as c FROM donors WHERE screening_status='APPROVED'");
    const totalDonationsRes = await db.query("SELECT COUNT(*) as c FROM milk_donations");
    const totalVolumeRes = await db.query("SELECT COALESCE(SUM(volume_ml),0) as v FROM milk_donations");
    const totalBatchesRes = await db.query("SELECT COUNT(*) as c FROM pasteurization_batches");
    const readyBatchesRes = await db.query("SELECT COUNT(*) as c FROM pasteurization_batches WHERE batch_status='PASS'");
    const lockedBatchesRes = await db.query("SELECT COUNT(*) as c FROM pasteurization_batches WHERE batch_status='LOCKED'");
    const dispensedBatchesRes = await db.query("SELECT COUNT(*) as c FROM pasteurization_batches WHERE batch_status='DISPENSED'");
    const quarantinedBatchesRes = await db.query("SELECT COUNT(*) as c FROM pasteurization_batches WHERE batch_status='QUARANTINED'");
    const totalRequestsRes = await db.query("SELECT COUNT(*) as c FROM milk_requests");
    const pendingRequestsRes = await db.query("SELECT COUNT(*) as c FROM milk_requests WHERE request_status='PENDING'");
    const totalRecipientsRes = await db.query("SELECT COUNT(*) as c FROM recipients");
    const totalRecallsRes = await db.query("SELECT COUNT(*) as c FROM batch_recalls");
    const totalAppointmentsRes = await db.query("SELECT COUNT(*) as c FROM appointments WHERE status='SCHEDULED'");

    res.json({
      donors: { total: parseInt(totalDonorsRes.rows[0].c, 10), approved: parseInt(approvedDonorsRes.rows[0].c, 10) },
      donations: { total: parseInt(totalDonationsRes.rows[0].c, 10), total_volume_ml: Number(totalVolumeRes.rows[0].v) },
      batches: { 
        total: parseInt(totalBatchesRes.rows[0].c, 10), 
        ready: parseInt(readyBatchesRes.rows[0].c, 10), 
        locked: parseInt(lockedBatchesRes.rows[0].c, 10), 
        dispensed: parseInt(dispensedBatchesRes.rows[0].c, 10), 
        quarantined: parseInt(quarantinedBatchesRes.rows[0].c, 10) 
      },
      requests: { total: parseInt(totalRequestsRes.rows[0].c, 10), pending: parseInt(pendingRequestsRes.rows[0].c, 10) },
      recipients: { total: parseInt(totalRecipientsRes.rows[0].c, 10) },
      recalls: { total: parseInt(totalRecallsRes.rows[0].c, 10) },
      appointments: { scheduled: parseInt(totalAppointmentsRes.rows[0].c, 10) }
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/collections — Milk collection report
router.get('/collections', requireAuth, requireRole('admin'), async (req, res) => {
  const { period } = req.query; // week, month, year

  let dateFilter = '';
  if (period === 'week') {
    dateFilter = "AND md.donation_date >= CURRENT_DATE - INTERVAL '7 days'";
  } else if (period === 'month') {
    dateFilter = "AND md.donation_date >= CURRENT_DATE - INTERVAL '30 days'";
  } else if (period === 'year') {
    dateFilter = "AND md.donation_date >= CURRENT_DATE - INTERVAL '365 days'";
  }

  try {
    const collectionsRes = await db.query(`
      SELECT
        md.donation_date as date,
        COUNT(*) as donation_count,
        SUM(md.volume_ml) as total_volume_ml
      FROM milk_donations md
      WHERE 1=1 ${dateFilter}
      GROUP BY md.donation_date
      ORDER BY md.donation_date DESC
    `);

    const collections = collectionsRes.rows;
    const totalVolume = collections.reduce((s, c) => s + (Number(c.total_volume_ml) || 0), 0);
    const totalDonations = collections.reduce((s, c) => s + parseInt(c.donation_count, 10), 0);

    res.json({ collections, summary: { total_volume_ml: totalVolume, total_donations: totalDonations, period: period || 'all' } });
  } catch (err) {
    console.error('Error fetching collections report:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/dispensing — Dispensing report
router.get('/dispensing', requireAuth, requireRole('admin'), async (req, res) => {
  const { period } = req.query;

  let dateFilter = '';
  if (period === 'week') {
    dateFilter = "AND mr.dispensed_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'";
  } else if (period === 'month') {
    dateFilter = "AND mr.dispensed_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'";
  } else if (period === 'year') {
    dateFilter = "AND mr.dispensed_at >= CURRENT_TIMESTAMP - INTERVAL '365 days'";
  }

  try {
    const dispensedRes = await db.query(`
      SELECT
        mr.dispensed_at::date as date,
        COUNT(*) as dispense_count,
        SUM(mr.requested_volume_ml) as total_volume_ml
      FROM milk_requests mr
      WHERE mr.request_status = 'DISPENSED' ${dateFilter}
      GROUP BY mr.dispensed_at::date
      ORDER BY date DESC
    `);

    res.json({ dispensed: dispensedRes.rows, period: period || 'all' });
  } catch (err) {
    console.error('Error fetching dispensing report:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/batch-results — Batch pass/fail rates
router.get('/batch-results', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const resultsRes = await db.query(`
      SELECT
        batch_status,
        COUNT(*) as count
      FROM pasteurization_batches
      WHERE batch_status IN ('PASS', 'LOCKED', 'DISPENSED', 'QUARANTINED')
      GROUP BY batch_status
    `);
    res.json(resultsRes.rows);
  } catch (err) {
    console.error('Error fetching batch results report:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/donor-trends — Donor enrollment trends
router.get('/donor-trends', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const trendsRes = await db.query(`
      SELECT
        created_at::date as date,
        COUNT(*) as new_donors,
        SUM(CASE WHEN screening_status = 'APPROVED' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN screening_status = 'EXCLUDED' THEN 1 ELSE 0 END) as excluded
      FROM donors
      GROUP BY created_at::date
      ORDER BY date DESC
      LIMIT 30
    `);
    res.json(trendsRes.rows);
  } catch (err) {
    console.error('Error fetching donor trends report:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/recall-history — Recall events history
router.get('/recall-history', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const recallsRes = await db.query(`
      SELECT br.*, d.first_name, d.last_name, u.username as initiated_by_name
      FROM batch_recalls br
      JOIN donors d ON br.donor_id = d.donor_id
      JOIN users u ON br.initiated_by = u.user_id
      ORDER BY br.created_at DESC
    `);
    res.json(recallsRes.rows);
  } catch (err) {
    console.error('Error fetching recall history:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/chain-of-custody/:id — Chain of custody for batch
router.get('/chain-of-custody/:id', requireAuth, async (req, res) => {
  try {
    const custodyRes = await db.query(`
      SELECT coc.*, u.first_name, u.last_name, u.role
      FROM chain_of_custody coc
      JOIN users u ON coc.performed_by = u.user_id
      WHERE coc.reference_id = $1
      ORDER BY coc.timestamp ASC
    `, [req.params.id]);
    res.json(custodyRes.rows);
  } catch (err) {
    console.error('Error fetching chain of custody:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
