// ============================================================
// MHMBS — Auth Routes (Stage 2 - PostgreSQL)
// Login, Logout, Session Check
// ============================================================

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { logAudit, requireAuth } = require('../middleware');
const db = require('../db');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const userRes = await db.query('SELECT * FROM users WHERE username = $1 AND status = $2', [username, 'active']);
    const user = userRes.rows[0];

    if (!user) {
      await logAudit('unknown', username, 'LOGIN_FAILED', 'Invalid username', req.ip);
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const passwordMatch = bcrypt.compareSync(password, user.password_hash);
    if (!passwordMatch) {
      await logAudit(user.user_id, username, 'LOGIN_FAILED', 'Invalid password', req.ip);
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

    await logAudit(user.user_id, username, 'LOGIN_SUCCESS', `Role: ${user.role}`, req.ip);

    res.json({
      success: true,
      user: sessionUser,
      redirect: '/dashboard'
    });
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  try {
    if (req.session.user) {
      await logAudit(req.session.user.user_id, req.session.user.username, 'LOGOUT', '', req.ip);
    }
    req.session.destroy();
    res.json({ success: true, redirect: '/login.html' });
  } catch (err) {
    console.error('Error during logout:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/session
router.get('/session', (req, res) => {
  if (req.session.user) {
    res.json({ authenticated: true, user: req.session.user });
  } else {
    res.json({ authenticated: false });
  }
});

// POST /api/auth/register (Donor or Recipient self-registration)
router.post('/register', async (req, res) => {
  const { role, username, password, first_name, last_name, email, phone, birth_date, blood_type, home_address, infant_name } = req.body;

  if (!username || !password || !first_name || !last_name) {
    return res.status(400).json({ error: 'Required fields: username, password, first_name, last_name' });
  }

  const userRole = role === 'recipient' ? 'recipient' : 'donor'; // Default to donor if invalid

  try {
    // Check if username exists
    const existingRes = await db.query('SELECT id FROM users WHERE username = $1', [username]);
    const existing = existingRes.rows[0];
    if (existing) {
      return res.status(409).json({ error: 'Username already exists.' });
    }

    const { v4: uuidv4 } = require('uuid');
    const user_id = uuidv4();
    const password_hash = bcrypt.hashSync(password, 10);
    
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        INSERT INTO users (user_id, username, password_hash, role, first_name, last_name, email, phone)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [user_id, username, password_hash, userRole, first_name, last_name, email || '', phone || '']);

      if (userRole === 'donor') {
        const donor_id = 'DNR-' + Date.now().toString(36).toUpperCase();
        await client.query(`
          INSERT INTO donors (donor_id, user_id, first_name, last_name, birth_date, contact_number, home_address, blood_type)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [donor_id, user_id, first_name, last_name, birth_date || null, phone || '', home_address || '', blood_type || '']);
        await logAudit(user_id, username, 'DONOR_REGISTERED', `Donor ID: ${donor_id}`, req.ip);
        res.json({ success: true, user_id: donor_id, message: 'Donor registration successful! You can now log in.' });
      } else {
        const recipient_id = 'RCP-' + Date.now().toString(36).toUpperCase();
        await client.query(`
          INSERT INTO recipients (recipient_id, user_id, infant_name, guardian_name)
          VALUES ($1, $2, $3, $4)
        `, [recipient_id, user_id, infant_name || 'To Be Updated', `${first_name} ${last_name}`]);
        await logAudit(user_id, username, 'RECIPIENT_REGISTERED', `Recipient ID: ${recipient_id}`, req.ip);
        res.json({ success: true, user_id: recipient_id, message: 'Recipient registration successful! You can now log in.' });
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error during registration:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/users (Admin only — user management)
router.get('/users', requireAuth, async (req, res) => {
  if (req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access only.' });
  }
  try {
    const usersRes = await db.query('SELECT user_id, username, role, first_name, last_name, email, phone, status, created_at FROM users ORDER BY created_at DESC');
    res.json(usersRes.rows);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
