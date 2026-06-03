// ============================================================
// HMBMS — Database Schema & Initialization
// Uses better-sqlite3 for local development
// Schema mirrors MySQL structure for production deployment
// ============================================================

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'hmbms.db');

function initDatabase() {
  const db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // ── Users Table ──────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','medtech','nurse','donor','recipient')),
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','inactive','suspended')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── Audit Trail (Immutable — INSERT only) ────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_trail (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      username TEXT,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── Donors Table ─────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS donors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donor_id TEXT UNIQUE NOT NULL,
      user_id TEXT UNIQUE NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      birth_date DATE,
      contact_number TEXT,
      home_address TEXT,
      blood_type TEXT CHECK(blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-','')),
      hiv_result TEXT DEFAULT '' CHECK(hiv_result IN ('POSITIVE','NEGATIVE','')),
      hep_b_result TEXT DEFAULT '' CHECK(hep_b_result IN ('POSITIVE','NEGATIVE','')),
      syphilis_result TEXT DEFAULT '' CHECK(syphilis_result IN ('POSITIVE','NEGATIVE','')),
      physician_approval TEXT DEFAULT 'PENDING' CHECK(physician_approval IN ('APPROVED','EXCLUDED','PENDING')),
      screening_date DATE,
      screening_status TEXT DEFAULT 'PENDING' CHECK(screening_status IN ('PENDING','APPROVED','EXCLUDED')),
      questionnaire_completed INTEGER DEFAULT 0,
      enrollment_date DATE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );
  `);

  // ── Screening Records ────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS screening_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donor_id TEXT NOT NULL,
      screened_by TEXT NOT NULL,
      hiv_result TEXT NOT NULL CHECK(hiv_result IN ('POSITIVE','NEGATIVE')),
      hep_b_result TEXT NOT NULL CHECK(hep_b_result IN ('POSITIVE','NEGATIVE')),
      syphilis_result TEXT NOT NULL CHECK(syphilis_result IN ('POSITIVE','NEGATIVE')),
      physician_notes TEXT,
      screening_date DATE NOT NULL,
      result TEXT NOT NULL CHECK(result IN ('APPROVED','EXCLUDED')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (donor_id) REFERENCES donors(donor_id),
      FOREIGN KEY (screened_by) REFERENCES users(user_id)
    );
  `);

  // ── Milk Donations ──────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS milk_donations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donation_id TEXT UNIQUE NOT NULL,
      donor_id TEXT NOT NULL,
      donation_date DATE NOT NULL,
      expressed_date DATE,
      volume_ml REAL NOT NULL CHECK(volume_ml > 0),
      recorded_by TEXT NOT NULL,
      qr_code TEXT,
      label_data TEXT,
      storage_status TEXT DEFAULT 'RAW' CHECK(storage_status IN ('RAW','STORED','ASSIGNED_TO_BATCH','PASTEURIZED','DISPENSED','EXPIRED','QUARANTINED')),
      freezer_location TEXT,
      storage_temp REAL DEFAULT -20,
      storage_timestamp DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (donor_id) REFERENCES donors(donor_id),
      FOREIGN KEY (recorded_by) REFERENCES users(user_id)
    );
  `);

  // ── Pasteurization Batches ──────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS pasteurization_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT UNIQUE NOT NULL,
      start_time DATETIME,
      end_time DATETIME,
      temperature REAL,
      duration_minutes REAL,
      technician_id TEXT,
      technician_name TEXT,
      pre_test_result TEXT DEFAULT '' CHECK(pre_test_result IN ('PASS','FAIL','')),
      post_test_result TEXT DEFAULT '' CHECK(post_test_result IN ('PASS','FAIL','')),
      pre_bacterial_count TEXT,
      post_bacterial_count TEXT,
      batch_status TEXT DEFAULT 'PENDING' CHECK(batch_status IN ('PENDING','IN_PROGRESS','TESTING','PASS','FAIL','LOCKED','QUARANTINED','DISPENSED')),
      thaw_confirmed INTEGER DEFAULT 0,
      laminar_flow_confirmed INTEGER DEFAULT 0,
      storage_location TEXT,
      expiration_date DATE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (technician_id) REFERENCES users(user_id)
    );
  `);

  // ── Batch-Donation Link (many-to-many) ──────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS batch_donations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT NOT NULL,
      donation_id TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES pasteurization_batches(batch_id),
      FOREIGN KEY (donation_id) REFERENCES milk_donations(donation_id)
    );
  `);

  // ── Recipients Table ────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS recipients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_id TEXT UNIQUE NOT NULL,
      user_id TEXT UNIQUE NOT NULL,
      infant_name TEXT NOT NULL,
      guardian_name TEXT NOT NULL,
      hospital_name TEXT,
      doctor_name TEXT,
      diagnosis TEXT,
      birth_weight_grams REAL,
      priority_status TEXT DEFAULT 'NORMAL' CHECK(priority_status IN ('NICU','MEDICALLY_FRAGILE','NORMAL')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );
  `);

  // ── Milk Requests ───────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS milk_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT UNIQUE NOT NULL,
      recipient_id TEXT NOT NULL,
      tracking_code TEXT UNIQUE NOT NULL,
      requested_volume_ml REAL NOT NULL CHECK(requested_volume_ml > 0),
      prescription_file TEXT,
      request_status TEXT DEFAULT 'PENDING' CHECK(request_status IN ('PENDING','APPROVED','READY','DISPENSED','CANCELLED')),
      assigned_batch_id TEXT,
      dispensed_by TEXT,
      dispensed_at DATETIME,
      payment_confirmed INTEGER DEFAULT 0,
      payment_amount REAL DEFAULT 0,
      payment_confirmed_by TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (recipient_id) REFERENCES recipients(recipient_id),
      FOREIGN KEY (assigned_batch_id) REFERENCES pasteurization_batches(batch_id)
    );
  `);

  // ── Chain of Custody ────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS chain_of_custody (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_id TEXT NOT NULL,
      reference_type TEXT NOT NULL CHECK(reference_type IN ('DONATION','BATCH','REQUEST')),
      action TEXT NOT NULL,
      performed_by TEXT NOT NULL,
      location TEXT,
      temperature REAL,
      notes TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (performed_by) REFERENCES users(user_id)
    );
  `);

  // ── Batch Recalls ───────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS batch_recalls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recall_id TEXT UNIQUE NOT NULL,
      donor_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      initiated_by TEXT NOT NULL,
      affected_batches TEXT,
      status TEXT DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','RESOLVED')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (donor_id) REFERENCES donors(donor_id),
      FOREIGN KEY (initiated_by) REFERENCES users(user_id)
    );
  `);

  // ── Appointments / Scheduling ───────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id TEXT UNIQUE NOT NULL,
      donor_id TEXT,
      program TEXT CHECK(program IN ('supsup_todo','milky_way','moms_act','general')),
      appointment_date DATE NOT NULL,
      appointment_time TEXT,
      location TEXT,
      status TEXT DEFAULT 'SCHEDULED' CHECK(status IN ('SCHEDULED','COMPLETED','CANCELLED','NO_SHOW')),
      notes TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (donor_id) REFERENCES donors(donor_id),
      FOREIGN KEY (created_by) REFERENCES users(user_id)
    );
  `);

  // ── Notifications ───────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notification_id TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('MILK_READY','BATCH_RECALL','APPOINTMENT','ORDER_UPDATE','ALERT','SYSTEM')),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );
  `);

  // ── Seed Default Users ──────────────────────────────────
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
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

    const insertUser = db.prepare(`
      INSERT INTO users (user_id, username, password_hash, role, first_name, last_name, email, phone)
      VALUES (@user_id, @username, @password_hash, @role, @first_name, @last_name, @email, @phone)
    `);

    const insertDonor = db.prepare(`
      INSERT INTO donors (donor_id, user_id, first_name, last_name, contact_number, blood_type, screening_status, questionnaire_completed, enrollment_date)
      VALUES (@donor_id, @user_id, @first_name, @last_name, @contact_number, @blood_type, @screening_status, 1, DATE('now'))
    `);

    const insertRecipient = db.prepare(`
      INSERT INTO recipients (recipient_id, user_id, infant_name, guardian_name, hospital_name, doctor_name, diagnosis, birth_weight_grams, priority_status)
      VALUES (@recipient_id, @user_id, @infant_name, @guardian_name, @hospital_name, @doctor_name, @diagnosis, @birth_weight_grams, @priority_status)
    `);

    const transaction = db.transaction(() => {
      for (const user of seedUsers) {
        insertUser.run(user);

        // Create donor profile for donor user
        if (user.role === 'donor') {
          insertDonor.run({
            donor_id: 'DNR-' + Date.now().toString(36).toUpperCase(),
            user_id: user.user_id,
            first_name: user.first_name,
            last_name: user.last_name,
            contact_number: user.phone,
            blood_type: 'O+',
            screening_status: 'APPROVED'
          });
        }

        // Create recipient profile for recipient user
        if (user.role === 'recipient') {
          insertRecipient.run({
            recipient_id: 'RCP-' + Date.now().toString(36).toUpperCase(),
            user_id: user.user_id,
            infant_name: 'Baby Cruz',
            guardian_name: user.first_name + ' ' + user.last_name,
            hospital_name: 'Ospital ng Makati',
            doctor_name: 'Dr. Juan Dela Cruz',
            diagnosis: 'Premature birth - 32 weeks',
            birth_weight_grams: 1800,
            priority_status: 'NICU'
          });
        }
      }
    });

    transaction();
    console.log('✅ Default users seeded successfully');
  }

  return db;
}

module.exports = { initDatabase };
