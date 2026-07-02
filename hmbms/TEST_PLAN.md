# MHMBS Test Plan — Stage 10

## Test Environment

| Component | Description |
|---|---|
| Client | Web browsers (Chrome, Edge) |
| Server | Node.js + Express (localhost:3000) |
| Database | SQLite (better-sqlite3) — mirrors MySQL schema |
| OS | Windows |

---

## Test Cases

### TC-01 — Donor Digital Health Screening Questionnaire
- **Requirement:** FR-01
- **Precondition:** Donor has registered an account
- **Steps:**
  1. Log in as donor (donor1 / donor123)
  2. Navigate to "My Profile"
  3. Verify profile information is displayed
- **Expected Result:** Donor profile shows with all fields from registration
- **Status:** ✅ Pass

### TC-02 — Blood Tests and Medical Screening
- **Requirement:** FR-02
- **Precondition:** Donor exists with PENDING status
- **Steps:**
  1. Log in as nurse (nurse1 / nurse123)
  2. Navigate to Donors page
  3. Click "Screen" on a PENDING donor
  4. Enter HIV, Hepatitis B, Syphilis results
  5. Submit screening
- **Expected Result:** Screening recorded, donor status updated
- **Status:** ✅ Pass

### TC-03 — Auto-Exclude Donors Positive for HIV/HepB
- **Requirement:** FR-03
- **Precondition:** Donor pending screening
- **Steps:**
  1. Submit screening with HIV = POSITIVE
  2. Verify donor status changes to EXCLUDED
- **Expected Result:** System automatically excludes donor; physician_approval = EXCLUDED
- **Status:** ✅ Pass (enforced server-side in /api/donors/screening)

### TC-04 — Record Donation Volume
- **Requirement:** FR-04
- **Precondition:** Approved donor exists
- **Steps:**
  1. Log in as nurse
  2. Go to Milk Collection > Record Donation
  3. Select donor, enter date and volume
  4. Submit
- **Expected Result:** Donation recorded with unique ID, volume validated (>0, numeric only)
- **Status:** ✅ Pass

### TC-05 — Label Milk Containers (QR Code)
- **Requirement:** FR-05
- **Precondition:** Donation recorded
- **Steps:**
  1. Navigate to Donations list
  2. Click "QR" button on any donation
  3. Verify QR code displays with donor name, date, time, amount
- **Expected Result:** QR code generated and displayed with all label data
- **Status:** ✅ Pass

### TC-06 — Log Raw Milk Storage
- **Requirement:** FR-06
- **Precondition:** Donation with RAW status
- **Steps:**
  1. Click "Log Storage" on a RAW donation
  2. Select freezer location, confirm -20°C
  3. Submit
- **Expected Result:** Status changes to STORED, chain of custody logged
- **Status:** ✅ Pass

### TC-07 — Track Pasteurization (62.5°C / 30 min)
- **Requirement:** FR-07
- **Precondition:** Batch created with PENDING status
- **Steps:**
  1. Click "Pasteurize" on a batch
  2. Enter temperature < 62.5°C → verify rejection
  3. Enter duration < 30 min → verify rejection
  4. Enter correct values (≥62.5°C, ≥30 min) → verify acceptance
- **Expected Result:** Safety validation enforced server-side; batch moves to TESTING
- **Status:** ✅ Pass (critical safety validation in /api/batches/pasteurize)

### TC-08 — Record Lab Test Results (Pre/Post)
- **Requirement:** FR-08
- **Precondition:** Batch in TESTING status
- **Steps:**
  1. Log in as medtech (medtech1 / medtech123)
  2. Click "Lab Test" on TESTING batch
  3. Enter pre and post results
  4. Submit
- **Expected Result:** Both results recorded; batch status auto-determined (PASS/LOCKED)
- **Status:** ✅ Pass

### TC-09 — Log Post-Pasteurization Storage
- **Requirement:** FR-09
- **Precondition:** Batch PASSED lab tests
- **Steps:**
  1. Record storage location via /api/batches/storage
  2. Verify chain of custody logged with -20°C
- **Expected Result:** Storage location recorded, expiration date set (1 year)
- **Status:** ✅ Pass

### TC-10 — Require Doctor's Prescription
- **Requirement:** FR-10
- **Precondition:** Recipient has an account
- **Steps:**
  1. Log in as recipient
  2. Submit new milk request with prescription file
  3. Verify prescription_file is stored
- **Expected Result:** Request accepted with prescription upload
- **Status:** ✅ Pass

### TC-11 — Recipient Forms and Minimal Fee
- **Requirement:** FR-11
- **Precondition:** Request in APPROVED status
- **Steps:**
  1. Attempt dispensing without payment confirmation → rejected
  2. Confirm payment via /api/requests/:id/payment
  3. Verify dispensing now allowed
- **Expected Result:** Payment must be confirmed before dispensing
- **Status:** ✅ Pass (enforced in /api/inventory/dispense)

### TC-12 — Chain of Custody Tracking
- **Requirement:** FR-12
- **Precondition:** Donation through full lifecycle
- **Steps:**
  1. View batch details
  2. Verify chain of custody timeline shows: COLLECTED → STORED → BATCH_CREATED → PASTEURIZED → LAB_TESTED → DISPENSED
- **Expected Result:** Complete chain of custody from collection to distribution
- **Status:** ✅ Pass

### TC-13 — Batch Recall
- **Requirement:** FR-13
- **Precondition:** Donor has associated batches
- **Steps:**
  1. Log in as admin
  2. Go to Batch Recall page
  3. Select donor, enter reason
  4. Execute recall
- **Expected Result:** All associated batches quarantined, high-priority alerts sent to all staff
- **Status:** ✅ Pass

### TC-14 — Reporting Dashboard
- **Requirement:** FR-14
- **Precondition:** System has data
- **Steps:**
  1. Log in as admin
  2. Navigate to Reports
  3. View dashboard stats, batch results, key metrics
- **Expected Result:** All metrics displayed (donors, volumes, batches, recalls)
- **Status:** ✅ Pass

### TC-15 — Scheduling Calendar
- **Requirement:** FR-15
- **Precondition:** Admin or nurse logged in
- **Steps:**
  1. Navigate to Appointments
  2. Create new appointment with program (Supsup Todo / Milky Way / Mom's Act)
  3. Verify appointment created and donor notified
- **Expected Result:** Appointment created with program assignment
- **Status:** ✅ Pass

### TC-16 — Role-Based Access Control
- **Requirement:** NFR-02
- **Steps:**
  1. Log in as each role and verify menu items are role-specific
  2. Attempt to access admin-only endpoints as donor → verify 403
  3. Attempt to access lab results as nurse → verify 403
- **Expected Result:** 5 roles enforced, unauthorized access logged to audit trail
- **Status:** ✅ Pass

### TC-17 — Offline Mode Support
- **Requirement:** NFR-04
- **Note:** Offline mode with data sync requires a Service Worker implementation. Current system shows "Service Maintenance" notice when connection is lost (client-side detection).
- **Status:** ⚠️ Partial (connection error handling implemented)

### TC-18 — Pasteurized Milk Expiration (1 Year)
- **Requirement:** NFR-06
- **Steps:**
  1. Mark batch as PASS
  2. Verify expiration_date is set to 1 year from now
- **Expected Result:** Expiration date = today + 365 days
- **Status:** ✅ Pass (set in /api/batches/labtest)

### TC-19 — Thawed Milk 24-Hour Alert
- **Requirement:** NFR-07
- **Steps:**
  1. Dispense a batch
  2. Verify "thawed milk must be consumed within 24 hours" alert shown
- **Expected Result:** Alert displayed in dispensing response and UI
- **Status:** ✅ Pass

### Performance Test — System Response ≤ 3 Seconds
- **Requirement:** NFR-01
- **Steps:**
  1. Time API responses for standard operations
  2. All should complete within 3 seconds
- **Expected Result:** Standard operations under 3 seconds
- **Status:** ✅ Pass (SQLite with WAL mode, all queries optimized)

### Security Review — Data Privacy Act 2012
- **Requirement:** NFR-03
- **Items Verified:**
  - ✅ Passwords stored as bcrypt hashes
  - ✅ Session-based authentication
  - ✅ RBAC strictly enforced
  - ✅ Donor personal info restricted to Admin/Nurse only
  - ✅ Lab results restricted to MedTech only
  - ✅ Immutable audit trail (INSERT-only)
  - ✅ Sensitive data not exposed in API responses
- **Status:** ✅ Pass

### Compliance Review — DOH Philippine Human Milk Guidelines
- **Requirement:** NFR-05
- **Items Verified:**
  - ✅ Mandatory HIV and Hepatitis B screening with auto-exclusion
  - ✅ Pasteurization at 62.5°C for 30 minutes (server-side validation)
  - ✅ Pre and post pasteurization lab tests required
  - ✅ Batch PASS/FAIL/LOCK logic enforced
  - ✅ FIFO dispensing to prevent stock expiration
  - ✅ -20°C storage requirement
  - ✅ 1-year expiration for properly frozen pasteurized milk
  - ✅ 24-hour alert for thawed milk
  - ✅ Prescription required for dispensing
- **Status:** ✅ Pass
