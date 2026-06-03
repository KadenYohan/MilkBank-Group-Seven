// ============================================================
// HMBMS — Auth Routes (Stage 2)
// Login, Logout, Session Check
// ============================================================

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { logAudit, requireAuth } = require('../middleware');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const db = global.db;
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND status = ?').get(username, 'active');

  if (!user) {
    logAudit('unknown', username, 'LOGIN_FAILED', 'Invalid username', req.ip);
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const passwordMatch = bcrypt.compareSync(password, user.password_hash);
  if (!passwordMatch) {
    logAudit(user.user_id, username, 'LOGIN_FAILED', 'Invalid password', req.ip);
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  // Set session
  const sessionUser = {
    user_id: user.user_id,
    username: user.username,
    role: user.role,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email
  };
  req.session.user = sessionUser;

  logAudit(user.user_id, username, 'LOGIN_SUCCESS', `Role: ${user.role}`, req.ip);

  res.json({
    success: true,
    user: sessionUser,
    redirect: '/dashboard'
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  if (req.session.user) {
    logAudit(req.session.user.user_id, req.session.user.username, 'LOGOUT', '', req.ip);
  }
  req.session.destroy();
  res.json({ success: true, redirect: '/login.html' });
});

// GET /api/auth/session
router.get('/session', (req, res) => {
  if (req.session.user) {
    res.json({ authenticated: true, user: req.session.user });
  } else {
    res.json({ authenticated: false });
  }
});

// POST /api/auth/register (Donor self-registration)
router.post('/register', (req, res) => {
  const { username, password, first_name, last_name, email, phone, birth_date, blood_type, home_address } = req.body;

  if (!username || !password || !first_name || !last_name) {
    return res.status(400).json({ error: 'Required fields: username, password, first_name, last_name' });
  }

  const db = global.db;

  // Check if username exists
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'Username already exists.' });
  }

  const { v4: uuidv4 } = require('uuid');
  const user_id = uuidv4();
  const password_hash = bcrypt.hashSync(password, 10);
  const donor_id = 'DNR-' + Date.now().toString(36).toUpperCase();

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO users (user_id, username, password_hash, role, first_name, last_name, email, phone)
      VALUES (?, ?, ?, 'donor', ?, ?, ?, ?)
    `).run(user_id, username, password_hash, first_name, last_name, email || '', phone || '');

    db.prepare(`
      INSERT INTO donors (donor_id, user_id, first_name, last_name, birth_date, contact_number, home_address, blood_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(donor_id, user_id, first_name, last_name, birth_date || '', phone || '', home_address || '', blood_type || '');
  });

  transaction();

  logAudit(user_id, username, 'DONOR_REGISTERED', `Donor ID: ${donor_id}`, req.ip);

  res.json({ success: true, donor_id, message: 'Registration successful! You can now log in.' });
});

// GET /api/auth/users (Admin only — user management)
router.get('/users', requireAuth, (req, res) => {
  if (req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access only.' });
  }
  const db = global.db;
  const users = db.prepare('SELECT user_id, username, role, first_name, last_name, email, phone, status, created_at FROM users ORDER BY created_at DESC').all();
  res.json(users);
});

module.exports = router;
