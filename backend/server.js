const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS so the frontend can connect
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// GET /test endpoint -> returns database time (SELECT NOW())
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

// Start Express server
app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 Backend Server running at http://localhost:${PORT}`);
  console.log(`🧪 Test Endpoint: http://localhost:${PORT}/test`);
  console.log(`==================================================\n`);
});

module.exports = app;
