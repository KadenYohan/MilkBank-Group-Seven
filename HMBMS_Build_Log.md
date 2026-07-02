# MHMBS Build Activity Log

---

## Human Milk Bank Management System (MHMBS)
## Complete Project Build Guide — Stage-by-Stage Prompting Guide

> **How to use this guide:** Each Stage is a self-contained prompt you send to your AI coding tool. Complete one stage fully before moving to the next. Each stage builds on the previous one.

---

## Project Overview

| Item | Details |
|---|---|
| **Project Title** | Human Milk Bank Management System (MHMBS) |
| **Client** | Makati Human Milk Bank (MHMB) |
| **Course** | CSS152P / Software Engineering 2 |
| **Version** | 1.1 |
| **Date** | May 11, 2026 |
| **Type** | Web-based + Mobile application |
| **Tech Stack** | PHP / Python / Java (backend), MySQL / PostgreSQL (database), iOS/Android (mobile) |

---

## System Summary

The MHMBS replaces manual logbook processes of the Makati Human Milk Bank. It manages the full lifecycle of donated human milk:

- Donor screening and enrollment
- Milk collection and QR code labeling
- Raw and pasteurized milk inventory tracking
- Pasteurization batch logging (62.5°C for 30 minutes)
- Lab test recording (pre and post pasteurization)
- Prescription-based dispensing with chain of custody
- Batch recall management
- Reporting dashboard (weekly, monthly, yearly)
- SMS/web-push notifications for milk availability

**Must comply with:** Data Privacy Act of 2012 and DOH Philippine Human Milk Banking Guidelines.

---

## User Roles

| Role | Responsibilities |
|---|---|
| **Administrator** | Manages donors, approves batches, oversees operations, generates reports, executes batch recalls |
| **Medical Technologist** | Records lab test results, ensures milk safety |
| **Nurse/Midwife** | Screens donors, assists with collection, labels containers |
| **Donor** | Registers, completes health forms, schedules donation |
| **Recipient/Beneficiary** | Submits prescription, requests milk, pays minimal fee, tracks order |

---

## Programs / Terminology

| Term | Definition |
|---|---|
| **Supsup Todo** | Community-based mobile human milk collection program |
| **Milky Way** | Hospital-based program for premature babies confined in hospitals |
| **Mom's Act** | Household-based pick-up program for pre-screened donors |
| **NICU** | Neonatal Intensive Care Unit — primary location for high-risk/premature beneficiaries |
| **Cold Chain** | Temperature maintenance during storage and transit using coolers or specialized freezers |
| **PHM Guidelines** | Philippine Human Milk Banking Manual of Operation from the DOH |

---

---

# STAGE 1 — Frontend: Public Homepage & Login Page

**Goal:** Build the public-facing homepage and the login page as static HTML/CSS pages. No backend needed yet — this is purely visual and structural. Must work in Chrome and Edge.

## 1.1 File Structure to Create

```
hmbms/
└── frontend/
    ├── index.html         # Public homepage
    ├── login.html         # Login page
    └── assets/
        ├── css/
        │   └── style.css  # Shared stylesheet
        └── img/           # Logo and image placeholders
```

## 1.2 Homepage — `index.html`

Build a clean, professional public-facing homepage for the **Makati Human Milk Bank (MHMB)**. The page must be beginner-friendly for mothers and community health workers with varying levels of digital literacy.

### Navbar / Header

- Display the system name: **Human Milk Bank Management System**
- Display the organization name: **Makati Human Milk Bank (MHMB)**
- Navigation links:
  - Home
  - About
  - How It Works
  - Programs
  - Contact
  - **Login** button (links to `login.html`) — styled as a prominent button

### Hero Section

- A welcoming headline, e.g.: *"Safe Donor Milk. Stronger Babies."*
- A short subtitle explaining the purpose: the MHMBS manages the collection, screening, processing, and distribution of donated human milk for premature and medically fragile infants in the NICU and community.
- Two call-to-action buttons:
  - **"Become a Donor"** — leads to donor registration (placeholder link for now)
  - **"Request Milk"** — leads to recipient request form (placeholder link for now)

### About Section

- Brief description of the Makati Human Milk Bank
- Mention compliance with **DOH Philippine Human Milk Banking Guidelines** and the **Data Privacy Act of 2012**
- Note that the system is designed to replace manual and paper-based processes

### How It Works Section

Show a simple 4-step visual flow (cards or numbered steps):

1. **Donor Screening** — Donors complete a health questionnaire and blood tests (HIV, Hepatitis B, Syphilis)
2. **Milk Collection** — Milk is collected, labeled with QR codes, and stored at -20°C
3. **Pasteurization & Testing** — Milk is pasteurized at 62.5°C for 30 minutes and lab-tested before and after
4. **Safe Dispensing** — Verified recipients with a doctor's prescription receive safe pasteurized milk

### Programs Section

Display the three collection programs as cards:

| Program | Description |
|---|---|
| **Supsup Todo** | Community-based mobile human milk collection program |
| **Milky Way** | Hospital-based program for premature babies confined in hospitals |
| **Mom's Act** | Household-based pick-up program for pre-screened donors |

### Contact / Footer Section

- Placeholder contact info (address, phone, email)
- Footer with: © Makati Human Milk Bank | Powered by MHMBS

## 1.3 Login Page — `login.html`

Build a clean, centered login form. This page is used by **all user types** — staff, donors, and recipients all log in here, and the system will route them based on role (routing logic comes in a later stage).

### Login Form Fields

- **Username** — text input, required
- **Password** — password input, required, characters hidden
- **Login** button — submits the form (no backend yet, button is non-functional as a placeholder)
- Small text link: *"Forgot password?"* (placeholder link)
- Small text: *"Are you a new donor? Register here"* (placeholder link)

### Role Context Note (display on the page)

Add a subtle informational note visible to users:

> *"Staff, Donors, and Recipients all use this login. Your dashboard will be shown based on your account type."*

### Role Types (for reference — no dropdown needed on the form)

The system supports these roles — login routing will be implemented in Stage 2:
- Administrator
- Medical Technologist
- Nurse / Midwife
- Donor
- Recipient / Beneficiary

## 1.4 Styling Requirements (`style.css`)

- Color palette: clean, medical/healthcare feel — whites, light blues, soft greens
- Font: legible, sans-serif (e.g., Inter, Roboto, or system fonts)
- The interface must be **beginner-friendly** for mothers and community health workers with varying levels of digital literacy
- Input forms must have **clear labels** and visible placeholder text
- The web portal must be **fully responsive** — must look good on desktop (Chrome, Edge) and on smartphones (for Barangay Health Workers logging data via mobile)
- Buttons must have clear hover states
- No clutter — keep the layout clean and spacious

## 1.5 Acceptance Checklist for Stage 1

Before moving to Stage 2, confirm:

- [ ] `index.html` loads correctly in Chrome and Edge
- [ ] All 4 homepage sections are present: Hero, About, How It Works, Programs
- [ ] Three program cards (Supsup Todo, Milky Way, Mom's Act) are displayed
- [ ] Navbar Login button navigates to `login.html`
- [ ] `login.html` has username + password fields and a Login button
- [ ] Both pages are fully responsive (test on mobile screen width)
- [ ] No broken links or missing assets

---

---

# STAGE 2 — Authentication & Role-Based Access Control (RBAC)

**Goal:** Build the login system and role-based permissions.

## 2.1 Login System

- Users (Staff, Donors, Recipients) log in using **username and password**
- Passwords stored as **encrypted hashes** (e.g., bcrypt)
- System assigns **access based on role** upon login

## 2.2 Role Permissions Matrix

| Feature | Admin | MedicalTechnologist | Nurse/Midwife | Donor | Recipient |
|---|---|---|---|---|---|
| View donor personal info | ✅ | ❌ | ✅ | Own only | ❌ |
| View lab results | ❌ | ✅ | ❌ | ❌ | ❌ |
| Approve batches | ✅ | ✅ | ❌ | ❌ | ❌ |
| Execute batch recalls | ✅ | ❌ | ❌ | ❌ | ❌ |
| Generate reports | ✅ | ❌ | ❌ | ❌ | ❌ |
| Donor screening | ❌ | ❌ | ✅ | ❌ | ❌ |
| Complete health questionnaire | ❌ | ❌ | ❌ | ✅ | ❌ |
| Submit prescription / request milk | ❌ | ❌ | ❌ | ❌ | ✅ |
| Track order via tracking code | ❌ | ❌ | ❌ | ❌ | ✅ |

## 2.3 Security Requirements

- **Role-Based Access Control (RBAC)** strictly enforced to protect donor anonymity
- Lab results restricted to **Medical Technologists** only
- Donor personal info restricted to **Admin** role only
- All sensitive medical records **encrypted**
- Data compliance with **Data Privacy Act of 2012**

## 2.4 Audit Trail (Immutable)

Every user action must be logged to AuditTrail with:
- `user_id` — who performed the action
- `timestamp` — when it happened
- `action` — description (e.g., "Batch 402 marked as PASS")

The audit log must be **immutable** — no record can be edited or deleted.

## 2.5 Data Backup

- System must perform **automated daily backup** of the entire database
- Ensures no donor or inventory records are lost

---

---

# STAGE 3 — Donor Screening & Enrollment Module

**Goal:** Build the full donor registration, health screening, and enrollment workflow.

## 3.1 Donor Self-Registration (Web Portal & Mobile App)

Donors access the portal and fill out a **digital health screening questionnaire**. Fields include:
- First name, last name, birth date
- Contact number, home address
- Blood type

## 3.2 Medical Intake (Staff Portal)

Medical staff enters clinical data into a **digital intake portal**:
- **Mandatory blood test results:**
  - HIV test result (POSITIVE / NEGATIVE)
  - Hepatitis B test result (POSITIVE / NEGATIVE)
  - Syphilis test result (POSITIVE / NEGATIVE)
- Physician approval status (APPROVED / EXCLUDED)
- Screening date

## 3.3 Automatic Eligibility Logic

The system **must automatically exclude** donors who test **POSITIVE** for:
- HIV
- Hepatitis B

> If results are NEGATIVE for HIV and Hepatitis B → system approves donor profile and enrolls them.

The system **cross-references** submitted medical data against **DOH Philippine Human Milk Guidelines**.

## 3.4 Enrollment & Donor ID Generation

Upon successful approval:
- System officially enrolls the donor
- Generates a **unique Donor ID** for future milk container labeling
- Donor is cleared to begin donating milk
- All medical data is logged and stored

## 3.5 Scheduling Calendar

- System supports a **scheduling calendar** for health center appointments
- Supports programs: **Supsup Todo** (community-based collection) and **Mom's Act** (household-based pickup)
- Scheduling for Barangay Health Workers

## 3.6 Input Validation

- All form fields must have **clear validation messages**
- Numeric fields (e.g., volume, temperature) must use **masked inputs** — prevent entry of letters or impossible values (e.g., negative volume)

## 3.7 Use Case: Complete Health Screening & Enrollment

**Actors:** Donor, Physician, Medical Staff

**Precondition:** A prospective donor accesses the digital intake portal.

**Flow:**
1. Donor accesses web portal and fills out the digital health screening questionnaire
2. System records data and **flags any immediate risk factors**
3. Donor visits the clinic; Physician conducts medical screening and draws blood for HIV and Hepatitis B testing
4. Medical Staff inputs blood test results into the system
5. System cross-references medical data against DOH Philippine Human Milk Guidelines
6. If results are NEGATIVE for HIV and Hepatitis B → System **approves** the donor profile
7. System officially enrolls the donor and generates a unique Donor ID

**Postcondition:** Donor is officially enrolled, cleared to donate, and medical data is logged.

---

---

# STAGE 4 — Milk Collection & QR Code Labeling Module

**Goal:** Record donation volumes and generate labeled containers with QR codes.

## 4.1 Donation Recording

Staff records each donation session:
- **Donor ID** (linked to enrolled donor)
- **Donation date**
- **Volume in ml** (masked input — no letters, no negative values)
- **Expressed date** (when the milk was expressed)

## 4.2 QR Code / Label Generation

Each milk container must be labeled with:
- **Donor name**
- **Date** of donation
- **Time** of donation
- **Amount (volume in ml)**
- **Unique QR code** for scanning and tracking

Labels must be printable via **label printer** hardware.
Containers must be scannable via **QR scanner** hardware.

## 4.3 Storage Logging

After collection, staff logs storage events via an interface with fields:
- **Milk Type:** Raw or Post-Pasteurized
- **Timestamp** of storage event
- **Manual verification** that storage temperature is **-20°C**
- **Freezer location**

## 4.4 Chain of Custody Initiation

From the moment of collection, the system begins **digital chain of custody tracking**.
Every movement of the milk — from collection point to distribution — must be logged.

## 4.5 Mobile Responsiveness (Critical)

- The web portal must be **fully responsive**
- Barangay Health Workers must be able to **log collection data via smartphones**
- Supports **offline mode** for remote areas — data syncs when connection is restored

---

---

# STAGE 5 — Milk Processing & Laboratory Module

**Goal:** Build the pasteurization logging, lab test recording, and batch safety system.

## 5.1 Raw Milk Handling (Pre-Pasteurization)

Before pasteurization, staff must:
- Select the **pooled batch ID** in the system
- Log that milk has been **thawed for under 24 hours**
- Confirm milk was **pooled under a laminar flow hood**

## 5.2 Pasteurization Logging Form

The system provides a form to document pasteurization. Fields include:
- **Batch ID**
- **Start time**
- **End time**
- **Temperature** — must be manually entered and confirmed at **62.5°C**
- **Duration** — must be manually confirmed at **30 minutes**
- **Technician name**

## 5.3 Threshold Validation (Critical Safety Rule)

The system **must prevent** a batch from being marked "Ready" if:
- Entered temperature is **below 62.5°C**, OR
- Duration is **less than 30 minutes**

This validation is **non-negotiable** and must be enforced server-side.

## 5.4 Lab Test Recording

The system must allow recording of **bacterial count results** (Pre and Post pasteurization):
- **Pre-pasteurization test results** (before processing)
- **Post-pasteurization test results** (after processing)

Bacterial count results (Pre and Post) **must be entered** before a batch status can be updated.

## 5.5 Batch Safety Status Logic

| Condition | System Action |
|---|---|
| Lab test = PASS + Temp ≥ 62.5°C + Duration ≥ 30 min | Batch marked as **"Ready for Dispensing"** |
| Lab test = FAIL | System **automatically "Locks"** the Batch ID — removed from dispensing inventory immediately |
| Donor health status changes post-donation | Admin can trigger **Batch Recall** → status changes to **"Quarantined"** |

## 5.6 Post-Pasteurization Storage

After a successful batch:
- Medical Staff physically moves batch to **-20°C freezer**
- Logs **post-pasteurization storage location** in the system
- System assigns a **one-year expiration date** (pasteurized milk lasts up to 1 year when properly frozen)

## 5.7 Batch Identification

- Each batch has a **unique Batch ID** for instant identification
- Staff can locate any specific milk batch instantly via Batch ID

## 5.8 Use Case: Track Pasteurization Process

**Actors:** Medical Staff, Laboratory Technician

**Precondition:** Donated raw milk has been logged, thawed for under 24 hours, and pooled under a laminar flow hood.

**Flow:**
1. Medical Staff selects the pooled batch ID in the system
2. Medical Staff places milk into pasteurizer and inputs the **start time** into the system log
3. System tracks the pasteurization cycle (Target: **62.5°C for 30 minutes**)
4. Upon cycle completion, Medical Staff logs the **end time** in the system
5. Laboratory Technician conducts post-pasteurization safety tests and uploads results into the system
6. System verifies that lab test results are **clear of contamination**
7. Medical Staff physically moves the batch to the **-20°C freezer** and logs the post-pasteurization storage location

**Postcondition:** Milk batch is marked as safe, successfully processed, assigned a **one-year expiration date**, and ready for dispensing.

---

---

# STAGE 6 — Inventory Management & FIFO Dispensing Module

**Goal:** Build the inventory tracking and smart dispensing system.

## 6.1 Inventory Dashboard

The system tracks and displays:
- All milk batches with current status (Raw, Ready, Locked, Dispensed, Expired, Quarantined)
- Milk type: Raw or Post-Pasteurized
- Storage location per batch
- Quantity in ml
- Expiration dates

## 6.2 FIFO (First-In-First-Out) Logic

- System **automatically suggests the oldest "Ready" milk** for dispensing
- This prevents stock expiration
- FIFO must be enforced in the dispensing workflow

## 6.3 Dispensing Controls (Pre-conditions for Dispensing)

Before any milk can be dispensed, the system **must require**:
1. A **doctor's prescription** (digital upload/submission)
2. Completion of **recipient forms**
3. **Minimal operational fee payment** — logged and confirmed by staff

## 6.4 Prescription Vault

- System stores a **digital copy (upload)** of the required doctor's prescription
- Linked to every dispensed milk record
- Staff reviews prescription in the system to verify authenticity

## 6.5 Recipient Priority Assessment

Staff assesses **priority status** of the recipient:
- **NICU** patients (Neonatal Intensive Care Unit)
- **Medically fragile** infants
- System **prioritizes high-risk infants** (premature or medically fragile) in the dispensing queue logic

## 6.6 Thawed Milk Safety Alert

- System must **alert users** that thawed milk must be **consumed within 24 hours** to maintain clinical safety

## 6.7 Chain of Custody Finalization

After dispensing:
- System automatically **updates inventory count**
- **Finalizes the chain of custody log** for that specific batch
- Packages milk in **cold-chain packaging**

## 6.8 Dispensing Use Case

**Actors:** Recipient, Medical Staff

**Precondition:** Pasteurized, safe milk is available in inventory, and the Recipient has arrived at the facility.

**Flow:**
1. Recipient submits a **digital doctor's prescription** and recipient forms to the system
2. Medical Staff reviews the prescription in the system to verify authenticity and assess Recipient's **priority status** (e.g., NICU, medically fragile)
3. System calculates the **minimal operational fee** based on the request
4. Recipient pays the fee; Medical Staff **logs payment confirmation**
5. Medical Staff selects the appropriate, **oldest compatible milk batch** (FIFO) and physically allocates it to the Recipient in **cold-chain packaging**
6. System automatically updates inventory count and finalizes chain of custody log for that specific batch

**Postcondition:** Safe donor milk is successfully dispensed to the verified recipient; facility inventory and chain of custody logs are updated.

---

---

# STAGE 7 — Recipient Services & Order Tracking Module

**Goal:** Build the beneficiary-facing portal with tracking and notifications.

## 7.1 Recipient Registration

Recipient profile includes:
- Infant name
- Guardian name
- Hospital name
- Doctor name
- Diagnosis
- Birth weight (in grams)

## 7.2 Milk Request Submission

Recipients submit:
- **Requested volume in ml**
- **Doctor's prescription** (digital upload)
- Recipient forms

## 7.3 Unique Tracking Code

- System generates a **unique tracking code** per request
- Recipient can track order progress via the **web portal** using this code
- Tracking code **expires** once milk has been marked as **"Dispensed"** or if the request is **cancelled**

## 7.4 Order Status Tracking

Recipients can track the progress of their order through statuses:
- Pending
- Approved
- Ready for Pickup / Dispensing
- Dispensed
- Cancelled

## 7.5 Notifications

- System triggers an **automated notification** (web-push or SMS message) once milk is **"Ready for Dispensing"**
- Notification must be sent **within 60 seconds** of the lab status update
- **SMS Gateway** integration required for SMS notifications
- Beneficiaries are alerted when milk becomes available

---

---

# STAGE 8 — Batch Recall & Administrative Module

**Goal:** Build the admin panel, batch recall system, and chain of custody management.

## 8.1 Batch Recall System

**Trigger:** Facility receives notification that a previously cleared active donor has had a negative change in health status (e.g., newly contracted infection).

**Flow:**
1. Administrator logs into the MHMBS Reporting dashboard and initiates the **"Batch Recall"** command
2. Administrator inputs the **affected Donor ID**
3. System traces the chain of custody and pulls up **all existing milk batches** associated with that donor
4. Administrator selects the affected batches and confirms the recall execution
5. System instantly changes the status of those batches to **"Quarantined"** — preventing dispensing
6. System automatically generates **high-priority alerts** to Medical Staff indicating which specific batches must be physically removed from storage freezers

**Postcondition:** All potentially unsafe milk batches are digitally locked, physically isolated, and the recall event is **permanently logged** for safety compliance.

## 8.2 Chain of Custody Tracking

- Full digital chain of custody from **collection point to distribution**
- Traceable per Batch ID and per Donor ID
- Immutable — every movement logged with timestamp and user ID

## 8.3 Appointment Scheduling

- Administrator can manage the **scheduling calendar** for health center appointments
- Supports **Supsup Todo** (community-based) and **Mom's Act** (household-based) programs

## 8.4 System Uptime & Offline Handling

- System uptime must be **at least 99%** (24/7 access to milk inventory data)
- If database connection is interrupted, system displays a **"Service Maintenance"** notice to users

---

---

# STAGE 9 — Reporting & Analytics Dashboard

**Goal:** Build the full reporting dashboard with analytics.

## 9.1 Reporting Dashboard

The dashboard tracks and displays:
- **Milk volumes collected** (by week, month, year)
- **Milk volumes dispensed** (by week, month, year)
- **Donor enrollment** trends
- **Batch pass/fail** rates
- **Recall events** history

## 9.2 Report Generation Features

Staff and Administrators can:
- Generate reports on a **weekly, monthly, and yearly** basis
- Track all chain of custody movements
- Export reports (PDF or printable format recommended)

## 9.3 Performance Requirement

- System response for standard operations must be **≤ 3 seconds**

## 9.4 Storage Efficiency

- Optimize **image/document uploads** (prescriptions, blood test results) so the database remains high-performing even after years of data entry

---

---

# STAGE 10 — Test Plan Implementation

**Goal:** Implement and document the full test plan.

## 10.1 Test Environment

| Component | Description |
|---|---|
| Client | Web browsers (Chrome, Edge) |
| Server | Application server (local/cloud) |
| Database | MySQL |
| OS | Windows / Linux |

## 10.2 Test Cases to Implement

| Test Case ID | Requirement | Description |
|---|---|---|
| TC-01 | FR-01 | Donor completes digital health screening questionnaire |
| TC-02 | FR-02 | Blood tests and medical screening for potential donors |
| TC-03 | FR-03 | System auto-excludes donors positive for HIV or Hepatitis B |
| TC-04 | FR-04 | Record donation volume per session |
| TC-05 | FR-05 | Label milk containers with donor name, date, time, and amount |
| TC-06 | FR-06 | Log raw milk storage in freezer before pasteurization |
| TC-07 | FR-07 | Track pasteurization at 62.5°C for 30 minutes |
| TC-08 | FR-08 | Record lab test results before and after pasteurization |
| TC-09 | FR-09 | Log post-pasteurization storage at -20°C |
| TC-10 | FR-10 | Require doctor's prescription for recipients to access milk |
| TC-11 | FR-11 | Require recipients to fill out forms and pay minimal fee |
| TC-12 | FR-12 | Digital chain of custody tracking from collection to distribution |
| TC-13 | FR-13 | Batch recall if donor health status changes after donation |
| TC-14 | FR-14 | Reporting dashboard tracking milk collected and dispensed |
| TC-15 | FR-15 | Scheduling calendar for health center appointments |
| TC-16 | NFR-02 | Role-based access control (Admin, MedTech, Nurse, Donor, Recipient) |
| TC-17 | NFR-04 | Offline mode support for remote areas |
| TC-18 | NFR-06 | Pasteurized milk expiration set to one year when properly frozen |
| TC-19 | NFR-07 | Thawed milk consumed within 24 hours alert |
| Perf Test | NFR-01 | System response ≤ 3 seconds for standard operations |
| Security Review | NFR-03 | Data privacy compliance (Data Privacy Act of 2012) |
| Compliance Review | NFR-05 | Follows DOH Philippine Human Milk Guidelines |

## 10.3 Test Case Format (for each TC above)

Each test case must document:
- **Test Case ID**
- **Test Description**
- **Precondition** (system state before test)
- **Test Steps** (numbered steps to execute)
- **Expected Result**
- **Status** (Pass / Fail / Pending)

---

---

# Requirements Traceability Matrix (RTM)

| Req ID | Requirement Description | Use Case | DFD Process | Database/Table | Test Case ID |
|---|---|---|---|---|---|
| FR-01 | Donor completes digital health screening questionnaire | UC-01 Submit Application | Screening & Verification | Donors | TC-01 |
| FR-02 | Blood tests and medical screening for potential donors | UC-01 Submit Application | Screening & Verification | ScreeningRecords | TC-02 |
| FR-03 | Exclude donors who test positive for HIV or Hepatitis B | UC-01 Submit Application | Screening & Verification | ScreeningRecords | TC-03 |
| FR-04 | Record donation volume per session | UC-02 Donate Milk | Raw Milk Storage | MilkDonations | TC-04 |
| FR-05 | Label milk containers with donor name, date, time, and amount | UC-02 Donate Milk | Raw Milk Storage | MilkDonations | TC-05 |
| FR-06 | Log raw milk storage in freezer before pasteurization | UC-03 Store Raw Milk | Raw Milk Storage | StorageInventory | TC-06 |
| FR-07 | Track pasteurization at 62.5°C for 30 minutes | UC-04 Process Pasteurization | Pasteurization & Labeling | PasteurizationBatches | TC-07 |
| FR-08 | Record lab test results before and after pasteurization | UC-04 Process Pasteurization | Testing | PasteurizationBatches | TC-08 |
| FR-09 | Log post-pasteurization storage at -20°C | UC-05 Store Processed Milk | Pasteurization & Labeling | StorageInventory | TC-09 |
| FR-10 | Require doctor's prescription for recipients to access milk | UC-06 Request Milk | Inventory | Requests | TC-10 |
| FR-11 | Require recipients to fill out forms and pay minimal fee | UC-06 Request Milk | Inventory | Recipients | TC-11 |
| FR-12 | Digital chain of custody tracking from collection to distribution | UC-07 Track Milk | Inventory | Distribution | TC-12 |
| FR-13 | Batch recall if donor health status changes after donation | UC-08 Recall Batch | Inventory | MilkDonations | TC-13 |
| FR-14 | Reporting dashboard tracking milk collected and dispensed | UC-09 Generate Reports | Central Database | All Tables | TC-14 |
| FR-15 | Scheduling calendar for health center appointments | UC-10 Schedule Appointment | Screening & Verification | Donors | TC-15 |
| NFR-01 | System response ≤ 3 seconds for standard operations | — | — | — | Performance Test |
| NFR-02 | Role-based access control (Admin, MedTech, Nurse, Donor, Recipient) | All Use Cases | Central Database | Users | TC-16 |
| NFR-03 | Data privacy compliance (Data Privacy Act of 2012) | — | — | All Tables | Security Review |
| NFR-04 | Offline mode support for remote areas | UC-01, UC-02, UC-03 | All Processes | Local_Sync | TC-17 |
| NFR-05 | Must follow DOH Philippine Human Milk Guidelines | — | — | All Tables | Compliance Review |
| NFR-06 | Pasteurized milk lasts up to one year when properly frozen | UC-05 Store Processed Milk | Pasteurization & Labeling | StorageInventory | TC-18 |
| NFR-07 | Thawed milk must be consumed within 24 hours | UC-06 Request Milk | Inventory | Distribution | TC-19 |

---

---

# Milestone Summary (Quick Reference)

| Stage | Module | Key Deliverable |
|---|---|---|
| **Stage 1** | Frontend: Homepage & Login | Public homepage (Hero, About, How It Works, Programs), login page, responsive CSS |
| **Stage 2** | Authentication & RBAC | Login system, 5 roles enforced, audit trail active, daily backup |
| **Stage 3** | Donor Screening & Enrollment | Digital questionnaire, medical intake, auto-exclusion logic, Donor ID generation, scheduling |
| **Stage 4** | Milk Collection & QR Labeling | Donation volume recording, QR/label generation, -20°C storage logging, chain of custody started |
| **Stage 5** | Milk Processing & Lab | Pasteurization form, 62.5°C/30min validation, lab results (pre/post), batch PASS/FAIL/LOCK logic |
| **Stage 6** | Inventory & FIFO Dispensing | Inventory dashboard, FIFO logic, prescription vault, priority queue, chain of custody finalized |
| **Stage 7** | Recipient Services & Tracking | Recipient profile, request submission, tracking code, notifications (web-push/SMS within 60 seconds) |
| **Stage 8** | Batch Recall & Admin | Batch recall workflow, quarantine status, high-priority alerts, appointment scheduling |
| **Stage 9** | Reporting & Analytics | Dashboard (weekly/monthly/yearly), report export, ≤3s performance requirement |
| **Stage 10** | Test Plan | All 22 test cases (TC-01 to TC-19 + Performance, Security, Compliance reviews) implemented and documented |

---

*Document based on: Software Requirements Specification (SRS) v1.1 — Human Milk Bank Management System — Makati Human Milk Bank (MHMB) — May 11, 2026*

---

---

# Build Activity Log

## Stage 1 — Completed

**Date:** 2026-05-26  
**Performed by:** Antigravity AI (Claude Sonnet 4.6 Thinking)  
**Session ID:** 5bb99346-daf6-43e3-a757-1922e97ebeae

---

### What Was Done

#### 1. Workspace & Directory Setup
- Confirmed empty GitHub workspace at `c:\Users\Arnulfo (Yohan)\Documents\GitHub\MilkBank-Group-Seven\`
- Created the full Stage 1 file structure:
  ```
  hmbms/
  └── frontend/
      ├── index.html
      ├── login.html
      └── assets/
          ├── css/
          │   └── style.css
          └── img/
              └── hero_banner.png
  ```

#### 2. Hero Image Generation
- Used AI image generation to create a custom hero banner (`hero_banner.png`) — a soft, warm NICU/mother-newborn medical scene with healthcare blue-green tones.
- Copied the generated image to `hmbms/frontend/assets/img/hero_banner.png`.

#### 3. `style.css` — Shared Stylesheet Built
- Implemented a comprehensive CSS file (~600+ lines) with:
  - CSS custom properties (design tokens) for the full color palette:
    - `--clr-primary`: Deep medical blue `#1a6fa8`
    - `--clr-accent`: Healthcare green `#2aab6f`
    - White / off-white backgrounds
  - Google Fonts: **Inter** (300, 400, 500, 600, 700, 800)
  - Full responsive layout using CSS Grid and Flexbox
  - Component styles: Navbar, Hero, About, Steps, Programs, Contact/Footer, Login page
  - Responsive breakpoints: tablet (≤900px) and mobile (≤600px)
  - Micro-animations: `fadeInUp`, `float`, `pulse`, scroll-reveal (`reveal` / `visible` classes)
  - Hover states on all interactive elements (buttons, cards, nav links)
  - Login-specific styles: split-panel layout, form inputs with icons, password toggle, role list

#### 4. `index.html` — Public Homepage Built
All required sections implemented:

- **Navbar** — Fixed, blur-backdrop, scrolled shadow effect, hamburger menu for mobile
  - Brand: MHMBS + Makati Human Milk Bank
  - Links: Home, About, How It Works, Programs, Contact
  - Login button linking to `login.html`
  - Mobile hamburger with animated open/close state

- **Hero Section** — Full-viewport with gradient overlay + AI-generated background image
  - Headline: *"Safe Donor Milk. Stronger Babies."*
  - Subtitle explaining the MHMBS purpose
  - CTA buttons: **Become a Donor** (green) + **Request Milk** (outline white)
  - Three stat chips: 5 User Roles, 3 Collection Programs, −20°C Cold Chain
  - Live Milk Lifecycle Tracker card (Step 1–4 visual with DONE/ACTIVE/PENDING statuses)
  - Floating compliance badges: "DOH Compliant" + "Cold Chain Tracked"

- **About Section** — Grid layout with text + stat cards
  - Description of MHMB, DOH compliance, Data Privacy Act 2012
  - Compliance badges: DOH PHM Guidelines, Data Privacy Act 2012, QR Code Tracking, Paperless Processes
  - Stat cards: 5 Roles, 3 Programs, 10 Planned Modules

- **How It Works Section** — 4-step numbered cards with connecting line
  - Step 1: Donor Screening (HIV, Hep B, Syphilis)
  - Step 2: Milk Collection (QR labels, −20°C)
  - Step 3: Pasteurization & Testing (62.5°C, 30 min)
  - Step 4: Safe Dispensing (FIFO, prescription-based)

- **Programs Section** — 3 program cards with color-coded top borders
  - Supsup Todo (Community-Based)
  - Milky Way (Hospital-Based)
  - Mom's Act (Household-Based)

- **Contact / Footer** — Dark blue gradient footer
  - Placeholder: address, phone, email
  - Quick links column
  - Footer bar: © 2026 Makati Human Milk Bank | Powered by MHMBS
  - Compliance tags: DOH, Data Privacy Act, SE2 v1.1

- **JavaScript** — Navbar scroll shadow, mobile hamburger toggle, active nav link via IntersectionObserver, scroll-reveal animation via IntersectionObserver

#### 5. `login.html` — Login Page Built
- Two-panel layout: left branding panel + right form panel
- **Left panel (branding):**
  - MHMBS logo + org name
  - Headline: "Secure Access for Milk Bank Staff, Donors & Recipients"
  - Role context note about single login for all user types
  - Visual role list with color-coded dots (Admin, MedTech, Nurse, Donor, Recipient)
- **Right panel (form):**
  - Role information note: *"Staff, Donors, and Recipients all use this login. Your dashboard will be shown based on your account type."*
  - Username input with icon + required validation
  - Password input with icon + **show/hide password toggle button**
  - Forgot password link
  - Login button (non-functional placeholder — alerts user that backend is Stage 2)
  - "Are you a new donor? Register here" link
- **Login navbar:** Transparent with back-to-homepage link
- **Login footer:** Privacy Policy, DOH compliance note
- **JavaScript:** Password visibility toggle, basic client-side validation feedback (empty field highlight + error border), non-functional submit with loading state

---

### Stage 1 Acceptance Checklist — Self-Review

| Check | Status |
|---|---|
| `index.html` loads correctly in Chrome and Edge | ✅ Ready |
| All 4 homepage sections present (Hero, About, How It Works, Programs) | ✅ Done |
| Three program cards (Supsup Todo, Milky Way, Mom's Act) displayed | ✅ Done |
| Navbar Login button navigates to `login.html` | ✅ Done |
| `login.html` has username + password fields and a Login button | ✅ Done |
| Both pages are fully responsive (mobile screen width) | ✅ Done |
| No broken links or missing assets | ✅ Done |
| Beginner-friendly layout (large labels, clear placeholders, spacious) | ✅ Done |
| Buttons have hover states | ✅ Done |
| Password characters hidden by default | ✅ Done |
| Forgot password link present | ✅ Done |
| Donor registration link present | ✅ Done |
| Role note displayed on login page | ✅ Done |

---

### Files Created

| File | Path |
|---|---|
| `style.css` | `hmbms/frontend/assets/css/style.css` |
| `index.html` | `hmbms/frontend/index.html` |
| `login.html` | `hmbms/frontend/login.html` |
| `hero_banner.png` | `hmbms/frontend/assets/img/hero_banner.png` |

---

## Stage 1.5 to Stage 10 (Backend & Role Dashboards) — Completed

**Date:** 2026-06-07  
**Performed by:** Antigravity AI

---

### What Was Done

#### 1. Mock Role Dashboards (Frontend)
- Created 5 unique role-based HTML dashboards:
  - `dashboard-admin.html`: Batch recalls, inventory, audit logs
  - `dashboard-medtech.html`: Pasteurization logging, lab results, batch status
  - `dashboard-nurse.html`: Donor screening queue, collection log, schedules
  - `dashboard-donor.html`: Donor profile, donation history, appointments
  - `dashboard-recipient.html`: Order tracking, recipient profile, order history
- Updated `style.css` with a comprehensive dashboard design system (sidebars, navbars, KPI cards, tables, status chips).
- Fixed `login.html` routing: Login now actually validates credentials and redirects to the appropriate role dashboard based on the logged-in user. Included an inline error message handling.

#### 2. PostgreSQL Backend Integration (Stages 2-10)
- Merged the full Node.js/Express backend that was completed previously on GitHub, which handles authentication, donors, batches, inventory, recalls, reports, and more.
- Confirmed PostgreSQL migration in `hmbms/backend/db.js` and `hmbms/backend/database.js` with Render support.
- Updated database seeding script to correctly populate default users.

#### 3. Render Deployment Fixes
- Updated `render.yaml` to automatically provision a free-tier PostgreSQL database (`hmbms-db`) and linked the `DATABASE_URL` to the web service automatically.
- Added `SESSION_SECRET` generation to `render.yaml` and implemented it in `server.js` for secure production sessions.
- Fixed a JS `errorMsg` variable bug in `login.html` that crashed the login form on failure.

#### 4. Documentation & Credentials Sync
- Synced the test accounts table in `login.html` to reflect the actual PostgreSQL seed accounts:
  - `admin` / `admin123`
  - `medtech1` / `medtech123`
  - `nurse1` / `nurse123`
  - `donor1` / `donor123`
  - `recipient1` / `recipient123`
- Updated the `README.md` with instructions on how to access the live Render server and the correct credentials.

---

### Files Created/Modified

| File | Path |
|---|---|
| `dashboard-admin.html` | `hmbms/frontend/dashboard-admin.html` |
| `dashboard-medtech.html` | `hmbms/frontend/dashboard-medtech.html` |
| `dashboard-nurse.html` | `hmbms/frontend/dashboard-nurse.html` |
| `dashboard-donor.html` | `hmbms/frontend/dashboard-donor.html` |
| `dashboard-recipient.html` | `hmbms/frontend/dashboard-recipient.html` |
| `login.html` | `hmbms/frontend/login.html` |
| `style.css` | `hmbms/frontend/assets/css/style.css` |
| `README.md` | `README.md` |
| `render.yaml` | `render.yaml` |
| `server.js` | `hmbms/backend/server.js` |

---

**Next:** Final Polish & Handoff
