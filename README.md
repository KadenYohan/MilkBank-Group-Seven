# Human Milk Bank Management System (HMBMS)

The HMBMS is a web-based application designed to automate the manual logbook processes of the **Makati Human Milk Bank (MHMB)**. The system manages the entire lifecycle of donated human milk — from donor screening and collection, to pasteurization logging, laboratory testing, and prescription-based dispensing.

## 🌐 Live Application Link
Access the live deployment here:  
👉 **[Makati Human Milk Bank Portal](https://hmbms-server.onrender.com/index.html)**

---

## 🧪 Test Accounts for Verification
For testing and evaluating the system's role-based access control (RBAC), please use the following mock credentials. These correspond to the 5 primary user roles in the system:

| User Role | Username | Password | Dashboard Page |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `Admin@2026` | `dashboard-admin.html` — Batch recalls, audit log, inventory, reports |
| **Medical Technologist** | `medtech` | `MedTech@2026` | `dashboard-medtech.html` — Pasteurization log, lab results, batch status |
| **Nurse / Midwife** | `nurse` | `Nurse@2026` | `dashboard-nurse.html` — Donor screening queue, collection log, schedule |
| **Donor** | `donor` | `Donor@2026` | `dashboard-donor.html` — My profile, donation history, appointments |
| **Recipient / Beneficiary** | `recipient` | `Recipient@2026` | `dashboard-recipient.html` — My orders, order tracker, request form |

> **Note:** These are Stage 1 mock credentials — no backend or database is connected yet. Authentication and real data will be wired in Stage 2 (Backend + RBAC).

---

## 📂 Project Structure
```
hmbms/
└── frontend/
    ├── index.html         # Public homepage (Makati Human Milk Bank)
    ├── login.html         # Integrated login page (supports all 5 roles)
    └── assets/
        ├── css/
        │   └── style.css  # Shared styling (fonts, grid layouts, animations)
        └── img/
            └── hero_banner.png  # AI-generated header illustration
```

## 🚀 Running Locally
If you want to run the project files on your local machine:
1. Clone the repository.
2. Open the project folder in VS Code.
3. Open `hmbms/frontend/index.html`.
4. Right-click and choose **"Open with Live Server"** (using the *Live Server* extension by Ritwick Dey).
