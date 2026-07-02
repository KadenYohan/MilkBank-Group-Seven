// ============================================================
// MHMBS — Database Schema & Initialization (PostgreSQL)
// Schema mirrors original structure for production deployment
// ============================================================

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

async function initDatabase() {
  // ── Users Table ──────────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) UNIQUE NOT NULL,
      username VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL CHECK(role IN ('admin','medtech','nurse','donor','recipient')),
      first_name VARCHAR(255) NOT NULL,
      last_name VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      phone VARCHAR(50),
      status VARCHAR(50) DEFAULT 'active' CHECK(status IN ('active','inactive','suspended')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── Audit Trail (Immutable — INSERT only) ────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS audit_trail (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      username VARCHAR(255),
      action VARCHAR(255) NOT NULL,
      details TEXT,
      ip_address VARCHAR(50),
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── Donors Table ─────────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS donors (
      id SERIAL PRIMARY KEY,
      donor_id VARCHAR(255) UNIQUE NOT NULL,
      user_id VARCHAR(255) UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      first_name VARCHAR(255) NOT NULL,
      last_name VARCHAR(255) NOT NULL,
      birth_date DATE,
      contact_number VARCHAR(50),
      home_address TEXT,
      blood_type VARCHAR(10) CHECK(blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-','')),
      hiv_result VARCHAR(50) DEFAULT '' CHECK(hiv_result IN ('POSITIVE','NEGATIVE','')),
      hep_b_result VARCHAR(50) DEFAULT '' CHECK(hep_b_result IN ('POSITIVE','NEGATIVE','')),
      syphilis_result VARCHAR(50) DEFAULT '' CHECK(syphilis_result IN ('POSITIVE','NEGATIVE','')),
      physician_approval VARCHAR(50) DEFAULT 'PENDING' CHECK(physician_approval IN ('APPROVED','EXCLUDED','PENDING')),
      screening_date DATE,
      screening_status VARCHAR(50) DEFAULT 'PENDING' CHECK(screening_status IN ('PENDING','APPROVED','EXCLUDED')),
      questionnaire_completed INTEGER DEFAULT 0,
      enrollment_date DATE,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // C-08: Add questionnaire_data JSONB column if it doesn't exist yet
  await db.query(`
    ALTER TABLE donors ADD COLUMN IF NOT EXISTS questionnaire_data JSONB DEFAULT NULL;
  `);

  // ── Screening Records ────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS screening_records (
      id SERIAL PRIMARY KEY,
      donor_id VARCHAR(255) NOT NULL REFERENCES donors(donor_id) ON DELETE CASCADE,
      screened_by VARCHAR(255) NOT NULL REFERENCES users(user_id),
      hiv_result VARCHAR(50) NOT NULL CHECK(hiv_result IN ('POSITIVE','NEGATIVE')),
      hep_b_result VARCHAR(50) NOT NULL CHECK(hep_b_result IN ('POSITIVE','NEGATIVE')),
      syphilis_result VARCHAR(50) NOT NULL CHECK(syphilis_result IN ('POSITIVE','NEGATIVE')),
      physician_notes TEXT,
      screening_date DATE NOT NULL,
      result VARCHAR(50) NOT NULL CHECK(result IN ('APPROVED','EXCLUDED')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── Milk Donations ──────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS milk_donations (
      id SERIAL PRIMARY KEY,
      donation_id VARCHAR(255) UNIQUE NOT NULL,
      donor_id VARCHAR(255) NOT NULL REFERENCES donors(donor_id) ON DELETE CASCADE,
      donation_date DATE NOT NULL,
      expressed_date DATE,
      volume_ml REAL NOT NULL CHECK(volume_ml > 0),
      recorded_by VARCHAR(255) NOT NULL REFERENCES users(user_id),
      qr_code TEXT,
      label_data TEXT,
      storage_status VARCHAR(50) DEFAULT 'RAW' CHECK(storage_status IN ('RAW','STORED','ASSIGNED_TO_BATCH','PASTEURIZED','DISPENSED','EXPIRED','QUARANTINED')),
      freezer_location VARCHAR(255),
      storage_temp REAL DEFAULT -20,
      storage_timestamp TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── Pasteurization Batches ──────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS pasteurization_batches (
      id SERIAL PRIMARY KEY,
      batch_id VARCHAR(255) UNIQUE NOT NULL,
      start_time TIMESTAMP,
      end_time TIMESTAMP,
      temperature REAL,
      duration_minutes REAL,
      technician_id VARCHAR(255) REFERENCES users(user_id),
      technician_name VARCHAR(255),
      pre_test_result VARCHAR(50) DEFAULT '' CHECK(pre_test_result IN ('PASS','FAIL','')),
      post_test_result VARCHAR(50) DEFAULT '' CHECK(post_test_result IN ('PASS','FAIL','')),
      pre_bacterial_count VARCHAR(255),
      post_bacterial_count VARCHAR(255),
      batch_status VARCHAR(50) DEFAULT 'PENDING' CHECK(batch_status IN ('PENDING','IN_PROGRESS','TESTING','PASS','FAIL','LOCKED','QUARANTINED','DISPENSED')),
      thaw_confirmed INTEGER DEFAULT 0,
      laminar_flow_confirmed INTEGER DEFAULT 0,
      storage_location VARCHAR(255),
      expiration_date DATE,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── Batch-Donation Link (many-to-many) ──────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS batch_donations (
      id SERIAL PRIMARY KEY,
      batch_id VARCHAR(255) NOT NULL REFERENCES pasteurization_batches(batch_id) ON DELETE CASCADE,
      donation_id VARCHAR(255) NOT NULL REFERENCES milk_donations(donation_id) ON DELETE CASCADE
    );
  `);

  // ── Recipients Table ────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS recipients (
      id SERIAL PRIMARY KEY,
      recipient_id VARCHAR(255) UNIQUE NOT NULL,
      user_id VARCHAR(255) UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      infant_name VARCHAR(255) NOT NULL,
      guardian_name VARCHAR(255) NOT NULL,
      hospital_name VARCHAR(255),
      doctor_name VARCHAR(255),
      diagnosis TEXT,
      birth_weight_grams REAL,
      priority_status VARCHAR(50) DEFAULT 'NORMAL' CHECK(priority_status IN ('NICU','MEDICALLY_FRAGILE','NORMAL')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── Milk Requests ───────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS milk_requests (
      id SERIAL PRIMARY KEY,
      request_id VARCHAR(255) UNIQUE NOT NULL,
      recipient_id VARCHAR(255) NOT NULL REFERENCES recipients(recipient_id) ON DELETE CASCADE,
      tracking_code VARCHAR(255) UNIQUE NOT NULL,
      requested_volume_ml REAL NOT NULL CHECK(requested_volume_ml > 0),
      prescription_file VARCHAR(255),
      request_status VARCHAR(50) DEFAULT 'PENDING' CHECK(request_status IN ('PENDING','APPROVED','READY','DISPENSED','CANCELLED')),
      assigned_batch_id VARCHAR(255) REFERENCES pasteurization_batches(batch_id),
      dispensed_by VARCHAR(255),
      dispensed_at TIMESTAMP,
      payment_confirmed INTEGER DEFAULT 0,
      payment_amount REAL DEFAULT 0,
      payment_confirmed_by VARCHAR(255),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── Chain of Custody ────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS chain_of_custody (
      id SERIAL PRIMARY KEY,
      reference_id VARCHAR(255) NOT NULL,
      reference_type VARCHAR(50) NOT NULL CHECK(reference_type IN ('DONATION','BATCH','REQUEST')),
      action VARCHAR(255) NOT NULL,
      performed_by VARCHAR(255) NOT NULL REFERENCES users(user_id),
      location VARCHAR(255),
      temperature REAL,
      notes TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── Batch Recalls ───────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS batch_recalls (
      id SERIAL PRIMARY KEY,
      recall_id VARCHAR(255) UNIQUE NOT NULL,
      donor_id VARCHAR(255) NOT NULL REFERENCES donors(donor_id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      initiated_by VARCHAR(255) NOT NULL REFERENCES users(user_id),
      affected_batches TEXT,
      status VARCHAR(50) DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','RESOLVED')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── Appointments / Scheduling ───────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS appointments (
      id SERIAL PRIMARY KEY,
      appointment_id VARCHAR(255) UNIQUE NOT NULL,
      donor_id VARCHAR(255) REFERENCES donors(donor_id) ON DELETE SET NULL,
      program VARCHAR(50) CHECK(program IN ('supsup_todo','milky_way','moms_act','general')),
      appointment_date DATE NOT NULL,
      appointment_time VARCHAR(50),
      location VARCHAR(255),
      status VARCHAR(50) DEFAULT 'SCHEDULED' CHECK(status IN ('SCHEDULED','COMPLETED','CANCELLED','NO_SHOW')),
      notes TEXT,
      created_by VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── Notifications ───────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      notification_id VARCHAR(255) UNIQUE NOT NULL,
      user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL CHECK(type IN ('MILK_READY','BATCH_RECALL','APPOINTMENT','ORDER_UPDATE','ALERT','SYSTEM')),
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── Distributions Table (H-12, SRS §6) ────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS distributions (
      id SERIAL PRIMARY KEY,
      distribution_id VARCHAR(255) UNIQUE NOT NULL,
      request_id VARCHAR(255) NOT NULL REFERENCES milk_requests(request_id),
      batch_id VARCHAR(255) NOT NULL REFERENCES pasteurization_batches(batch_id),
      recipient_id VARCHAR(255) NOT NULL REFERENCES recipients(recipient_id),
      dispensed_by VARCHAR(255) NOT NULL REFERENCES users(user_id),
      volume_ml REAL NOT NULL CHECK(volume_ml > 0),
      fee_amount REAL DEFAULT 0,
      dispensed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      notes TEXT
    );
  `);

  // ── Storage Inventory Table (H-13, SRS §6) ───────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS storage_inventory (
      id SERIAL PRIMARY KEY,
      batch_id VARCHAR(255) UNIQUE NOT NULL REFERENCES pasteurization_batches(batch_id) ON DELETE CASCADE,
      location VARCHAR(255) NOT NULL DEFAULT 'Freezer A',
      temperature REAL DEFAULT -20,
      stored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_checked TIMESTAMP,
      inventory_status VARCHAR(50) DEFAULT 'STORED' CHECK(inventory_status IN ('STORED','REMOVED','EXPIRED')),
      notes TEXT
    );
  `);

  // ── Seed Default Users ──────────────────────────────────────────────────────
  const userCountRes = await db.query('SELECT COUNT(*) as count FROM users');
  const count = parseInt(userCountRes.rows[0].count, 10);
  
  if (count === 0) {
    const salt = bcrypt.genSaltSync(10);

    const seedUsers = [
      {
        user_id: uuidv4(),
        username: 'admin',
        password_hash: bcrypt.hashSync('admin123', salt),
        role: 'admin',
        first_name: 'System',
        last_name: 'Administrator',
        email: 'admin@mhmb.gov.ph',
        phone: '09171234567'
      },
      {
        user_id: uuidv4(),
        username: 'medtech1',
        password_hash: bcrypt.hashSync('medtech123', salt),
        role: 'medtech',
        first_name: 'Maria',
        last_name: 'Santos',
        email: 'msantos@mhmb.gov.ph',
        phone: '09172345678'
      },
      {
        user_id: uuidv4(),
        username: 'nurse1',
        password_hash: bcrypt.hashSync('nurse123', salt),
        role: 'nurse',
        first_name: 'Ana',
        last_name: 'Reyes',
        email: 'areyes@mhmb.gov.ph',
        phone: '09173456789'
      },
      {
        user_id: uuidv4(),
        username: 'donor1',
        password_hash: bcrypt.hashSync('donor123', salt),
        role: 'donor',
        first_name: 'Rosa',
        last_name: 'Garcia',
        email: 'rgarcia@email.com',
        phone: '09174567890'
      },
      {
        user_id: uuidv4(),
        username: 'recipient1',
        password_hash: bcrypt.hashSync('recipient123', salt),
        role: 'recipient',
        first_name: 'Elena',
        last_name: 'Cruz',
        email: 'ecruz@email.com',
        phone: '09175678901'
      }
    ];

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      for (const user of seedUsers) {
        await client.query(`
          INSERT INTO users (user_id, username, password_hash, role, first_name, last_name, email, phone)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [user.user_id, user.username, user.password_hash, user.role, user.first_name, user.last_name, user.email, user.phone]);

        // Create donor profile for donor user
        if (user.role === 'donor') {
          const donor_id = 'DNR-' + Date.now().toString(36).toUpperCase();
          // C-02 FIX: Seed donor with proper NEGATIVE test results so the donate
          // endpoint (which requires hiv_result=NEGATIVE etc.) doesn't block them
          await client.query(`
            INSERT INTO donors (
              donor_id, user_id, first_name, last_name, contact_number, blood_type,
              hiv_result, hep_b_result, syphilis_result,
              physician_approval, screening_status,
              questionnaire_completed, screening_date, enrollment_date
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'NEGATIVE', 'NEGATIVE', 'NEGATIVE', 'APPROVED', 'APPROVED', 1, CURRENT_DATE, CURRENT_DATE)
          `, [donor_id, user.user_id, user.first_name, user.last_name, user.phone, 'O+']);
        }

        // Create recipient profile for recipient user
        if (user.role === 'recipient') {
          const recipient_id = 'RCP-' + Date.now().toString(36).toUpperCase();
          await client.query(`
            INSERT INTO recipients (recipient_id, user_id, infant_name, guardian_name, hospital_name, doctor_name, diagnosis, birth_weight_grams, priority_status)
            VALUES ($1, $2, 'Baby Cruz', $3, 'Ospital ng Makati', 'Dr. Juan Dela Cruz', 'Premature birth - 32 weeks', 1800, 'NICU')
          `, [recipient_id, user.user_id, user.first_name + ' ' + user.last_name]);
        }
      }

      await client.query('COMMIT');
      console.log('✅ Default users seeded successfully in PostgreSQL');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('❌ Error seeding default users in PostgreSQL:', e);
      throw e;
    } finally {
      client.release();
    }
  }
}

module.exports = { initDatabase };
