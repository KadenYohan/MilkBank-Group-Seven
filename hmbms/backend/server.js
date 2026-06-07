// ============================================================
// HMBMS — Main Server (Express - PostgreSQL)
// Human Milk Bank Management System
// ============================================================

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const cors = require('cors');
const db = require('./db');
const { initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Global reference for compatibility
global.db = db;

// ── Middleware ─────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session management
app.use(session({
  secret: process.env.SESSION_SECRET || 'hmbms-dev-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
}));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Import Routes ─────────────────────────────────────────
const authRoutes = require('./routes/auth');
const donorRoutes = require('./routes/donors');
const milkRoutes = require('./routes/milk');
const batchRoutes = require('./routes/batches');
const inventoryRoutes = require('./routes/inventory');
const recipientRoutes = require('./routes/recipients');
const requestRoutes = require('./routes/requests');
const recallRoutes = require('./routes/recalls');
const appointmentRoutes = require('./routes/appointments');
const reportRoutes = require('./routes/reports');
const auditRoutes = require('./routes/audit');
const notificationRoutes = require('./routes/notifications');

// ── API Routes ────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/donors', donorRoutes);
app.use('/api/milk', milkRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/recipients', recipientRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/recalls', recallRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/notifications', notificationRoutes);

// ── Dashboard page routes ─────────────────────────────────
app.get('/dashboard', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login.html');
  }
  res.sendFile(path.join(__dirname, '..', 'frontend', 'dashboard.html'));
});

// Catch-all for SPA routes
app.get('/dashboard/{*path}', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login.html');
  }
  res.sendFile(path.join(__dirname, '..', 'frontend', 'dashboard.html'));
});

// Test endpoint to return PostgreSQL database time
app.get('/test', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({
      success: true,
      message: 'Connection to PostgreSQL is successful!',
      time: result.rows[0].now
    });
  } catch (err) {
    console.error('Error executing query inside GET /test:', err);
    res.status(500).json({
      success: false,
      error: 'Database query failed',
      details: err.message
    });
  }
});

// ── Error handling ────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start Server ──────────────────────────────────────────
async function startServer() {
  try {
    console.log('Initializing PostgreSQL database schema...');
    await initDatabase();
    console.log('Database schema initialization completed.');

    app.listen(PORT, () => {
      console.log(`\n${'═'.repeat(56)}`);
      console.log(`  🍼 HMBMS — Human Milk Bank Management System`);
      console.log(`  🌐 Server running at http://localhost:${PORT}`);
      console.log(`  📂 Frontend: http://localhost:${PORT}/index.html`);
      console.log(`  🔐 Login:    http://localhost:${PORT}/login.html`);
      console.log(`  🧪 Test endpoint: http://localhost:${PORT}/test`);
      console.log(`${'═'.repeat(56)}\n`);
      console.log(`  Default Accounts:`);
      console.log(`  ─────────────────────────────────────────`);
      console.log(`  Admin:     admin / admin123`);
      console.log(`  MedTech:   medtech1 / medtech123`);
      console.log(`  Nurse:     nurse1 / nurse123`);
      console.log(`  Donor:     donor1 / donor123`);
      console.log(`  Recipient: recipient1 / recipient123`);
      console.log(`  ─────────────────────────────────────────\n`);
    });
  } catch (err) {
    console.error('Fatal: Failed to initialize database and start server:', err);
    process.exit(1);
  }
}

startServer();

module.exports = app;
