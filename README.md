# Human Milk Bank Management System (HMBMS)

The HMBMS is a web-based application designed to automate the manual logbook processes of the **Makati Human Milk Bank (MHMB)**. The system manages the entire lifecycle of donated human milk — from donor screening and collection, to pasteurization logging, laboratory testing, and prescription-based dispensing.

## 🌐 Live Application Link
Access the live deployment here:  
👉 **[Makati Human Milk Bank Portal](https://hmbms-server.onrender.com/index.html)**

---

## 🧪 Test Accounts for the Live Server
Use these credentials at **https://hmbms-server.onrender.com/login.html**. They match the accounts auto-seeded by the PostgreSQL database on first boot:

| User Role | Username | Password | After Login |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `admin123` | Full system: recalls, audit log, inventory, reports |
| **Medical Technologist** | `medtech1` | `medtech123` | Pasteurization log, lab results, batch status |
| **Nurse / Midwife** | `nurse1` | `nurse123` | Donor screening queue, collection log, schedule |
| **Donor** | `donor1` | `donor123` | My profile, donation history, appointments |
| **Recipient / Beneficiary** | `recipient1` | `recipient123` | My orders, order tracker, request form |

> **Live URL:** https://hmbms-server.onrender.com/login.html  
> **⚠ Note:** The Render free tier may take 30–60 seconds to wake up from idle. The `DATABASE_URL` environment variable must be configured in the Render dashboard for the PostgreSQL database to connect (see setup guide below).

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
