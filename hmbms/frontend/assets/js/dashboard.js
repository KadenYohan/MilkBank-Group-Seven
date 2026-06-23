// ============================================================
// HMBMS — Dashboard JavaScript
// Single-Page Application logic for all 5 role dashboards
// ============================================================

// H-09: Offline / connection status detection
(function() {
  function updateOnlineStatus() {
    let banner = document.getElementById('offline-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'offline-banner';
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;padding:8px 20px;background:#dc2626;color:#fff;text-align:center;font-size:0.82rem;font-weight:600;display:none;';
      banner.textContent = 'You are offline. Some features may not be available. Please check your internet connection.';
      document.body.prepend(banner);
    }
    banner.style.display = navigator.onLine ? 'none' : 'block';
  }
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  document.addEventListener('DOMContentLoaded', updateOnlineStatus);
})();

const API = {
  get: (url) => fetch(url).then(r => r.json()),
  post: (url, data) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  put: (url, data) => fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  del: (url) => fetch(url, { method: 'DELETE' }).then(r => r.json()),
  upload: (url, formData) => fetch(url, { method: 'POST', body: formData }).then(r => r.json())
};

let currentUser = null;
let currentPage = 'overview';

// ── Icons ─────────────────────────────────────────────────
const ICONS = {
  dashboard: '<svg viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>',
  donors: '<svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>',
  milk: '<svg viewBox="0 0 24 24"><path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z"/></svg>',
  batch: '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>',
  inventory: '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1 0-2 .9-2 2v3.01c0 .72.43 1.34 1 1.69V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.57-.35 1-.97 1-1.69V4c0-1.1-1-2-2-2zm-5 12H9v-2h6v2zm5-7H4V4h16v3z"/></svg>',
  recipients: '<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
  requests: '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>',
  recall: '<svg viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
  calendar: '<svg viewBox="0 0 24 24"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/></svg>',
  reports: '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>',
  audit: '<svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>',
  screening: '<svg viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>',
  labtest: '<svg viewBox="0 0 24 24"><path d="M7 2v2h1v14c0 2.21 1.79 4 4 4s4-1.79 4-4V4h1V2H7zm8 16c0 1.1-.9 2-2 2s-2-.9-2-2v-2h4v2zm0-4H9V4h6v10z"/></svg>',
  track: '<svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>',
  profile: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>',
  qr: '<svg viewBox="0 0 24 24"><path d="M3 11h8V3H3v8zm2-6h4v4H5V5zM3 21h8v-8H3v8zm2-6h4v4H5v-4zM13 3v8h8V3h-8zm6 6h-4V5h4v4zM13 13h2v2h-2zM15 15h2v2h-2zM13 17h2v2h-2zM17 13h2v2h-2zM19 15h2v2h-2zM17 17h2v2h-2zM15 19h2v2h-2zM19 19h2v2h-2z"/></svg>'
};

// ── Navigation configs per role ──────────────────────────
const NAV_CONFIG = {
  admin: [
    { group: 'Dashboard', items: [
      { id: 'overview', label: 'Overview', icon: 'dashboard' }
    ]},
    { group: 'Management', items: [
      { id: 'donors', label: 'Donors', icon: 'donors' },
      { id: 'donations', label: 'Milk Collection', icon: 'milk' },
      { id: 'batches', label: 'Batches', icon: 'batch' },
      { id: 'inventory', label: 'Inventory', icon: 'inventory' },
      { id: 'requests', label: 'Requests', icon: 'requests' },
      { id: 'recipients', label: 'Recipients', icon: 'recipients' },
    ]},
    { group: 'Admin Tools', items: [
      { id: 'recall', label: 'Batch Recall', icon: 'recall' },
      { id: 'appointments', label: 'Appointments', icon: 'calendar' },
      { id: 'reports', label: 'Reports', icon: 'reports' },
      { id: 'audit', label: 'Audit Trail', icon: 'audit' },
    ]}
  ],
  medtech: [
    { group: 'Dashboard', items: [
      { id: 'overview', label: 'Overview', icon: 'dashboard' }
    ]},
    { group: 'Lab Work', items: [
      { id: 'batches', label: 'Batches & Lab Tests', icon: 'labtest' },
      { id: 'inventory', label: 'Inventory', icon: 'inventory' },
    ]}
  ],
  nurse: [
    { group: 'Dashboard', items: [
      { id: 'overview', label: 'Overview', icon: 'dashboard' }
    ]},
    { group: 'Patient Care', items: [
      { id: 'donors', label: 'Donor Screening', icon: 'screening' },
      { id: 'donations', label: 'Milk Collection', icon: 'milk' },
      { id: 'batches', label: 'Batches', icon: 'batch' },
      { id: 'requests', label: 'Requests', icon: 'requests' },
      { id: 'appointments', label: 'Appointments', icon: 'calendar' },
    ]}
  ],
  donor: [
    { group: 'My Dashboard', items: [
      { id: 'overview', label: 'Overview', icon: 'dashboard' },
      { id: 'profile', label: 'My Profile', icon: 'profile' },
      { id: 'donations', label: 'My Donations', icon: 'milk' },
      { id: 'appointments', label: 'My Appointments', icon: 'calendar' },
    ]}
  ],
  recipient: [
    { group: 'My Dashboard', items: [
      { id: 'overview', label: 'Overview', icon: 'dashboard' },
      { id: 'profile', label: 'My Profile', icon: 'profile' },
      { id: 'requests', label: 'My Requests', icon: 'requests' },
      { id: 'track', label: 'Track Order', icon: 'track' },
    ]}
  ]
};

// ── Role Labels ──────────────────────────────────────────
const ROLE_LABELS = {
  admin: 'Administrator',
  medtech: 'Medical Technologist',
  nurse: 'Nurse / Midwife',
  donor: 'Donor',
  recipient: 'Recipient / Beneficiary'
};

// ── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const session = await API.get('/api/auth/session');
  if (!session.authenticated) {
    window.location.href = '/login.html';
    return;
  }

  currentUser = session.user;
  initUI();
  buildSidebar();
  loadPage('overview');
  loadNotifications();

  // Poll notifications every 30 seconds
  setInterval(loadNotifications, 30000);
});

function initUI() {
  // User info
  const initials = (currentUser.first_name[0] + currentUser.last_name[0]).toUpperCase();
  document.getElementById('user-avatar').textContent = initials;
  document.getElementById('topbar-avatar').textContent = initials;
  document.getElementById('user-fullname').textContent = currentUser.first_name + ' ' + currentUser.last_name;
  document.getElementById('user-role-label').textContent = ROLE_LABELS[currentUser.role] || currentUser.role;
  document.getElementById('topbar-username').textContent = currentUser.first_name;

  // Logout
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await API.post('/api/auth/logout');
    window.location.href = '/login.html';
  });

  // Sidebar toggle (mobile)
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
  });
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  });

  // Notifications toggle
  const notifBtn = document.getElementById('notif-btn');
  const notifPanel = document.getElementById('notif-panel');
  notifBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    notifPanel.style.display = notifPanel.style.display === 'none' ? 'block' : 'none';
  });
  document.addEventListener('click', () => { notifPanel.style.display = 'none'; });
  notifPanel.addEventListener('click', (e) => e.stopPropagation());

  document.getElementById('mark-all-read').addEventListener('click', async () => {
    await API.put('/api/notifications/read-all');
    loadNotifications();
  });

  // Modal close
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
}

// ── Sidebar Builder ──────────────────────────────────────
function buildSidebar() {
  const nav = document.getElementById('sidebar-nav');
  const config = NAV_CONFIG[currentUser.role] || NAV_CONFIG.donor;

  nav.innerHTML = config.map(group => `
    <div class="sidebar-nav-group">
      <div class="sidebar-nav-label">${group.group}</div>
      ${group.items.map(item => `
        <button class="sidebar-nav-item ${item.id === 'overview' ? 'active' : ''}"
                data-page="${item.id}" id="nav-${item.id}">
          ${ICONS[item.icon] || ICONS.dashboard}
          <span>${item.label}</span>
        </button>
      `).join('')}
    </div>
  `).join('');

  // Nav click handlers
  nav.querySelectorAll('.sidebar-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      nav.querySelectorAll('.sidebar-nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadPage(btn.dataset.page);

      // Close mobile sidebar
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebar-overlay').classList.remove('show');
    });
  });
}

// ── Page Router ──────────────────────────────────────────
async function loadPage(page) {
  currentPage = page;
  const content = document.getElementById('dash-content');
  content.innerHTML = '<div class="dash-loading"><div class="loading-spinner"></div><p>Loading...</p></div>';

  try {
    switch (page) {
      case 'overview': await renderOverview(content); break;
      case 'donors': await renderDonors(content); break;
      case 'donations': await renderDonations(content); break;
      case 'batches': await renderBatches(content); break;
      case 'inventory': await renderInventory(content); break;
      case 'requests': await renderRequests(content); break;
      case 'recipients': await renderRecipients(content); break;
      case 'recall': await renderRecall(content); break;
      case 'appointments': await renderAppointments(content); break;
      case 'reports': await renderReports(content); break;
      case 'audit': await renderAudit(content); break;
      case 'profile': await renderProfile(content); break;
      case 'track': await renderTrackOrder(content); break;
      default: content.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🚧</div><h3>Coming Soon</h3><p>This module is under development.</p></div>';
    }
  } catch (err) {
    console.error(err);
    content.innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><h3>Error Loading Page</h3><p>${err.message}</p></div>`;
  }

  updatePageTitle(page);
}

function updatePageTitle(page) {
  const titles = {
    overview: ['Dashboard', `Welcome back, ${currentUser.first_name}`],
    donors: ['Donors', 'Manage donor screening and enrollment'],
    donations: ['Milk Collection', 'Record donations and generate labels'],
    batches: ['Pasteurization Batches', 'Manage batches and lab tests'],
    inventory: ['Inventory', 'Track milk stock and dispensing'],
    requests: ['Milk Requests', 'Manage recipient requests'],
    recipients: ['Recipients', 'Manage beneficiary profiles'],
    recall: ['Batch Recall', 'Execute batch recalls for safety compliance'],
    appointments: ['Appointments', 'Scheduling calendar for programs'],
    reports: ['Reports & Analytics', 'View dashboards and generate reports'],
    audit: ['Audit Trail', 'Immutable system activity log'],
    profile: ['My Profile', 'View and update your information'],
    track: ['Track Order', 'Track your milk request status']
  };
  const [title, subtitle] = titles[page] || ['Dashboard', ''];
  document.getElementById('page-title').textContent = title;
  document.getElementById('page-subtitle').textContent = subtitle;
}

// ── Notifications ────────────────────────────────────────
async function loadNotifications() {
  try {
    const data = await API.get('/api/notifications');
    const badge = document.getElementById('notif-badge');
    const mobileBadge = document.getElementById('mobile-notif-badge');

    if (data.unread > 0) {
      badge.textContent = data.unread;
      badge.style.display = '';
      mobileBadge.textContent = data.unread;
      mobileBadge.style.display = '';
    } else {
      badge.style.display = 'none';
      mobileBadge.style.display = 'none';
    }

    const list = document.getElementById('notif-list');
    if (data.notifications.length === 0) {
      list.innerHTML = '<p class="notif-empty">No notifications</p>';
    } else {
      list.innerHTML = data.notifications.slice(0, 20).map(n => `
        <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="markNotifRead('${n.notification_id}')">
          <div class="notif-item-title">${escHtml(n.title)}</div>
          <div class="notif-item-msg">${escHtml(n.message)}</div>
          <div class="notif-item-time">${formatDate(n.created_at)}</div>
        </div>
      `).join('');
    }
  } catch (e) { /* silent */ }
}

async function markNotifRead(id) {
  await API.put(`/api/notifications/${id}/read`);
  loadNotifications();
}

// ── OVERVIEW PAGE ────────────────────────────────────────
async function renderOverview(el) {
  const stats = await API.get('/api/reports/dashboard');
  const role = currentUser.role;

  let html = '<div class="stats-grid">';

  if (role === 'admin' || role === 'nurse' || role === 'medtech') {
    html += statCard('blue', ICONS.donors, stats.donors.total, 'Total Donors');
    html += statCard('green', ICONS.milk, stats.donations.total, 'Total Donations');
    html += statCard('teal', ICONS.inventory, stats.batches.ready, 'Ready Batches');
    html += statCard('orange', ICONS.requests, stats.requests.pending, 'Pending Requests');
    if (role === 'admin') {
      html += statCard('red', ICONS.recall, stats.recalls.total, 'Recall Events');
      html += statCard('purple', ICONS.calendar, stats.appointments.scheduled, 'Scheduled Appts');
    }
  } else if (role === 'donor') {
    const donations = await API.get('/api/milk/donations');
    html += statCard('green', ICONS.milk, donations.length, 'My Donations');
    html += statCard('blue', ICONS.donors, '—', 'Donor Status');
    const appts = await API.get('/api/appointments');
    html += statCard('purple', ICONS.calendar, appts.filter(a => a.status === 'SCHEDULED').length, 'Upcoming Appts');
  } else if (role === 'recipient') {
    const requests = await API.get('/api/requests');
    html += statCard('blue', ICONS.requests, requests.length, 'My Requests');
    html += statCard('green', ICONS.track, requests.filter(r => r.request_status === 'READY').length, 'Ready for Pickup');
    html += statCard('orange', ICONS.requests, requests.filter(r => r.request_status === 'PENDING').length, 'Pending');
  }

  html += '</div>';

  // Quick actions
  if (role === 'admin' || role === 'nurse') {
    html += '<h3 class="dash-section-title">Quick Actions</h3><div class="quick-actions">';
    html += quickAction('green', ICONS.milk, 'Record Donation', 'Log a new milk donation', () => loadPage('donations'));
    html += quickAction('blue', ICONS.screening, 'Screen Donor', 'Process donor screening', () => loadPage('donors'));
    html += quickAction('teal', ICONS.batch, 'Create Batch', 'Start new pasteurization batch', () => loadPage('batches'));
    html += quickAction('orange', ICONS.requests, 'View Requests', 'Review milk requests', () => loadPage('requests'));
    html += '</div>';
  } else if (role === 'recipient') {
    html += '<h3 class="dash-section-title">Quick Actions</h3><div class="quick-actions">';
    html += quickAction('blue', ICONS.requests, 'Submit Request', 'Request donor milk', () => loadPage('requests'));
    html += quickAction('green', ICONS.track, 'Track Order', 'Check your order status', () => loadPage('track'));
    html += '</div>';
  }

  // Recent activity for admins
  if (role === 'admin') {
    const audit = await API.get('/api/audit?limit=10');
    html += `<div class="dash-card"><div class="dash-card-header"><span class="dash-card-title">Recent Activity</span></div>
    <div class="dash-card-body no-pad"><table class="dash-table"><thead><tr><th>User</th><th>Action</th><th>Details</th><th>Time</th></tr></thead><tbody>
    ${audit.logs.map(l => `<tr><td>${escHtml(l.username || l.user_id)}</td><td><span class="badge ${l.action.includes('FAIL') || l.action.includes('RECALL') ? 'fail' : 'active'}">${l.action}</span></td><td>${escHtml((l.details || '').substring(0, 80))}</td><td>${formatDate(l.timestamp)}</td></tr>`).join('')}
    </tbody></table></div></div>`;
  }

  el.innerHTML = html;
  attachQuickActions();
}

// ── DONORS PAGE ──────────────────────────────────────────
async function renderDonors(el) {
  const donors = await API.get('/api/donors');

  el.innerHTML = `
    <div class="action-bar" style="margin-bottom:16px;">
      <span>${donors.length} donors registered</span>
    </div>
    <div class="dash-card">
      <div class="dash-card-header">
        <span class="dash-card-title">All Donors</span>
      </div>
      <div class="dash-card-body no-pad">
        <table class="dash-table">
          <thead><tr><th>Donor ID</th><th>Name</th><th>Blood Type</th><th>Status</th><th>Screening</th><th>Actions</th></tr></thead>
          <tbody>
          ${donors.length === 0 ? '<tr><td colspan="6" class="empty-state">No donors found</td></tr>' :
            donors.map(d => `<tr>
              <td><strong>${d.donor_id}</strong></td>
              <td>${escHtml(d.first_name)} ${escHtml(d.last_name)}</td>
              <td>${d.blood_type || '—'}</td>
              <td><span class="badge ${d.screening_status.toLowerCase()}">${d.screening_status}</span></td>
              <td>${d.screening_date || 'Not screened'}</td>
              <td><div class="btn-group">
                ${d.screening_status === 'PENDING' ? `<button class="btn-dash btn-dash-primary btn-dash-sm" onclick="openScreeningModal('${d.donor_id}','${escHtml(d.first_name)} ${escHtml(d.last_name)}')">Screen</button>` : ''}
                <button class="btn-dash btn-dash-outline btn-dash-sm" onclick="viewDonorDetails('${d.donor_id}')">View</button>
              </div></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ── DONATIONS PAGE ───────────────────────────────────────
async function renderDonations(el) {
  const donations = await API.get('/api/milk/donations');
  const isStaff = ['admin', 'nurse'].includes(currentUser.role);

  let html = '';
  if (isStaff) {
    html += `<div class="action-bar" style="margin-bottom:16px;">
      <span>${donations.length} donations recorded</span>
      <button class="btn-dash btn-dash-accent" onclick="openDonationModal()">+ Record Donation</button>
    </div>`;
  }

  // C-03: Temp column in donations table
  html += `<div class="dash-card">
    <div class="dash-card-header"><span class="dash-card-title">${isStaff ? 'All Donations' : 'My Donations'}</span></div>
    <div class="dash-card-body no-pad">
      <table class="dash-table">
        <thead><tr><th>ID</th><th>Donor</th><th>Date</th><th>Volume</th><th>Status</th><th>Temp (°C)</th><th>Actions</th></tr></thead>
        <tbody>
        ${donations.length === 0 ? '<tr><td colspan="7" class="empty-state">No donations yet</td></tr>' :
          donations.map(d => {
            const tempVal = d.storage_temp !== null && d.storage_temp !== undefined ? d.storage_temp : null;
            const tempBad = tempVal !== null && Number(tempVal) > -20;
            const tempCell = tempVal !== null
              ? `<span style="color:${tempBad ? 'var(--clr-error)' : 'inherit'};font-weight:${tempBad ? '700' : 'normal'}">${tempBad ? '&#9888; ' : ''}${tempVal}°C</span>`
              : '—';
            return `<tr>
            <td><strong>${d.donation_id}</strong></td>
            <td>${escHtml(d.first_name)} ${escHtml(d.last_name)}</td>
            <td>${d.donation_date}</td>
            <td>${d.volume_ml} ml</td>
            <td><span class="badge ${d.storage_status.toLowerCase()}">${d.storage_status}</span></td>
            <td>${tempCell}</td>
            <td><div class="btn-group">
              <button class="btn-dash btn-dash-outline btn-dash-sm" onclick="viewQR('${d.donation_id}')">QR</button>
              ${isStaff && d.storage_status === 'RAW' ? `<button class="btn-dash btn-dash-primary btn-dash-sm" onclick="logStorage('${d.donation_id}')">Log Storage</button>` : ''}
            </div></td>
          </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;

  el.innerHTML = html;
}

// ── BATCHES PAGE ─────────────────────────────────────────
async function renderBatches(el) {
  const batches = await API.get('/api/batches');
  const isLabTech = currentUser.role === 'medtech';

  let html = `<div class="action-bar" style="margin-bottom:16px;">
    <span>${batches.length} batches</span>
    ${!isLabTech ? '<button class="btn-dash btn-dash-accent" onclick="openCreateBatchModal()">+ New Batch</button>' : ''}
  </div>`;

  // BUG-07: Show bacterial count values alongside PASS/FAIL labels
  html += `<div class="dash-card">
    <div class="dash-card-header"><span class="dash-card-title">Pasteurization Batches</span></div>
    <div class="dash-card-body no-pad">
      <table class="dash-table">
        <thead><tr><th>Batch ID</th><th>Status</th><th>Temp</th><th>Duration</th><th>Lab Pre</th><th>Pre Count</th><th>Lab Post</th><th>Post Count</th><th>Volume</th><th>Actions</th></tr></thead>
        <tbody>
        ${batches.length === 0 ? '<tr><td colspan="10" class="empty-state">No batches</td></tr>' :
          batches.map(b => `<tr>
            <td><strong>${b.batch_id}</strong></td>
            <td><span class="badge ${b.batch_status.toLowerCase()}">${b.batch_status}</span></td>
            <td>${b.temperature ? b.temperature + '°C' : '—'}</td>
            <td>${b.duration_minutes ? b.duration_minutes + ' min' : '—'}</td>
            <td>${b.pre_test_result ? `<span class="badge ${b.pre_test_result.toLowerCase()}">${b.pre_test_result}</span>` : '—'}</td>
            <td style="font-size:0.78rem;color:var(--clr-text-muted)">${b.pre_bacterial_count || '—'}</td>
            <td>${b.post_test_result ? `<span class="badge ${b.post_test_result.toLowerCase()}">${b.post_test_result}</span>` : '—'}</td>
            <td style="font-size:0.78rem;color:var(--clr-text-muted)">${b.post_bacterial_count || '—'}</td>
            <td>${b.total_volume_ml ? b.total_volume_ml + ' ml' : '—'}</td>
            <td><div class="btn-group">
              ${b.batch_status === 'PENDING' ? `<button class="btn-dash btn-dash-primary btn-dash-sm" onclick="openPasteurizeModal('${b.batch_id}')">Pasteurize</button>` : ''}
              ${b.batch_status === 'TESTING' && isLabTech ? `<button class="btn-dash btn-dash-accent btn-dash-sm" onclick="openLabTestModal('${b.batch_id}')">Lab Test</button>` : ''}
              <button class="btn-dash btn-dash-outline btn-dash-sm" onclick="viewBatchDetails('${b.batch_id}')">Details</button>
            </div></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;

  el.innerHTML = html;
}

// ── INVENTORY PAGE ───────────────────────────────────────
async function renderInventory(el) {
  const data = await API.get('/api/inventory');

  el.innerHTML = `
    <div class="stats-grid">
      ${statCard('green', ICONS.inventory, data.summary.ready, 'Ready Batches')}
      ${statCard('blue', ICONS.milk, Math.round(data.summary.ready_volume_ml) + ' ml', 'Ready Volume')}
      ${statCard('orange', ICONS.batch, data.summary.testing, 'In Testing')}
      ${statCard('red', ICONS.recall, data.summary.quarantined, 'Quarantined')}
    </div>
    <div class="dash-card">
      <div class="dash-card-header"><span class="dash-card-title">Inventory (All Batches)</span></div>
      <div class="dash-card-body no-pad">
        <table class="dash-table">
          <thead><tr><th>Batch</th><th>Status</th><th>Volume</th><th>Expiry</th><th>Storage</th></tr></thead>
          <tbody>
          ${data.batches.map(b => `<tr>
            <td><strong>${b.batch_id}</strong></td>
            <td><span class="badge ${b.batch_status.toLowerCase()}">${b.batch_status}</span></td>
            <td>${b.total_volume_ml ? b.total_volume_ml + ' ml' : '—'}</td>
            <td>${b.expiration_date || '—'}</td>
            <td>${b.storage_location || '—'}</td>
          </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
    ${data.expired_batches.length > 0 ? `<div class="dash-card" style="border-color: var(--clr-error);">
      <div class="dash-card-header"><span class="dash-card-title" style="color:var(--clr-error);">⚠️ Expired Batches</span></div>
      <div class="dash-card-body"><p>There are ${data.expired_batches.length} expired batches that need to be removed from inventory.</p></div>
    </div>` : ''}`;
}

// ── REQUESTS PAGE ────────────────────────────────────────
async function renderRequests(el) {
  const requests = await API.get('/api/requests');
  const isStaff = ['admin', 'nurse'].includes(currentUser.role);
  const isRecipient = currentUser.role === 'recipient';

  let html = `<div class="action-bar" style="margin-bottom:16px;">
    <span>${requests.length} requests</span>
    ${isRecipient ? '<button class="btn-dash btn-dash-accent" onclick="openNewRequestModal()">+ New Request</button>' : ''}
  </div>`;

  html += `<div class="dash-card">
    <div class="dash-card-header"><span class="dash-card-title">${isRecipient ? 'My Requests' : 'All Requests'}</span></div>
    <div class="dash-card-body no-pad">
      <table class="dash-table">
        <thead><tr><th>ID</th><th>Tracking</th>${isStaff ? '<th>Patient</th><th>Priority</th>' : ''}<th>Volume</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
        ${requests.length === 0 ? `<tr><td colspan="${isStaff ? 7 : 5}" class="empty-state">No requests</td></tr>` :
          requests.map(r => `<tr>
            <td><strong>${r.request_id}</strong></td>
            <td><code>${r.tracking_code}</code></td>
            ${isStaff ? `<td>${escHtml(r.infant_name || '')}</td><td><span class="badge ${(r.priority_status || 'normal').toLowerCase()}">${r.priority_status || 'NORMAL'}</span></td>` : ''}
            <td>${r.requested_volume_ml} ml</td>
            <td><span class="badge ${r.request_status.toLowerCase()}">${r.request_status}</span></td>
            <td><div class="btn-group">
              ${isStaff && r.request_status === 'PENDING' ? `<button class="btn-dash btn-dash-primary btn-dash-sm" onclick="approveRequest('${r.request_id}')">Approve</button>` : ''}
              ${isStaff && r.request_status === 'APPROVED' && !r.payment_confirmed ? `<button class="btn-dash btn-dash-accent btn-dash-sm" onclick="confirmPayment('${r.request_id}')">Confirm Pay</button>` : ''}
              ${isStaff && r.request_status === 'APPROVED' && r.payment_confirmed ? `<button class="btn-dash btn-dash-accent btn-dash-sm" onclick="markReady('${r.request_id}')">Mark Ready</button>` : ''}
              ${isStaff && r.request_status === 'READY' ? `<button class="btn-dash btn-dash-primary btn-dash-sm" onclick="openDispenseModal('${r.request_id}')">Dispense</button>` : ''}
              ${r.request_status === 'PENDING' ? `<button class="btn-dash btn-dash-danger btn-dash-sm" onclick="cancelRequest('${r.request_id}')">Cancel</button>` : ''}
            </div></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;

  el.innerHTML = html;
}

// ── RECIPIENTS PAGE ──────────────────────────────────────
async function renderRecipients(el) {
  const recipients = await API.get('/api/recipients');

  el.innerHTML = `
    <div class="dash-card">
      <div class="dash-card-header"><span class="dash-card-title">All Recipients</span></div>
      <div class="dash-card-body no-pad">
        <table class="dash-table">
          <thead><tr><th>ID</th><th>Infant</th><th>Guardian</th><th>Hospital</th><th>Priority</th></tr></thead>
          <tbody>
          ${recipients.map(r => `<tr>
            <td>${r.recipient_id}</td>
            <td>${escHtml(r.infant_name)}</td>
            <td>${escHtml(r.guardian_name)}</td>
            <td>${escHtml(r.hospital_name || '—')}</td>
            <td><span class="badge ${(r.priority_status || 'normal').toLowerCase()}">${r.priority_status}</span></td>
          </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ── RECALL PAGE ──────────────────────────────────────────
async function renderRecall(el) {
  const recalls = await API.get('/api/recalls');
  const donors = await API.get('/api/donors');

  el.innerHTML = `
    <div class="dash-card" style="border-color: var(--clr-error); margin-bottom:20px;">
      <div class="dash-card-header"><span class="dash-card-title" style="color:var(--clr-error);">🚨 Execute Batch Recall</span></div>
      <div class="dash-card-body">
        <p style="font-size:0.85rem;color:var(--clr-text-muted);margin-bottom:16px;">Use this when a previously cleared donor has a negative change in health status. All associated batches will be quarantined immediately.</p>
        <div class="dash-form">
          <div class="form-group">
            <label>Affected Donor</label>
            <select id="recall-donor" class="dash-select">
              <option value="">Select donor...</option>
              ${donors.map(d => `<option value="${d.donor_id}">${d.donor_id} — ${d.first_name} ${d.last_name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Reason for Recall</label>
            <textarea id="recall-reason" class="dash-textarea" placeholder="Describe the reason (e.g., newly contracted infection)..."></textarea>
          </div>
          <button class="btn-dash btn-dash-danger" onclick="executeRecall()">⚠️ Execute Recall</button>
        </div>
      </div>
    </div>
    <div class="dash-card">
      <div class="dash-card-header"><span class="dash-card-title">Recall History</span></div>
      <div class="dash-card-body no-pad">
        <table class="dash-table">
          <thead><tr><th>Recall ID</th><th>Donor</th><th>Reason</th><th>Batches</th><th>Date</th></tr></thead>
          <tbody>
          ${recalls.length === 0 ? '<tr><td colspan="5" class="empty-state">No recalls</td></tr>' :
            recalls.map(r => `<tr>
              <td><strong>${r.recall_id}</strong></td>
              <td>${escHtml(r.first_name)} ${escHtml(r.last_name)}</td>
              <td>${escHtml((r.reason || '').substring(0, 60))}</td>
              <td>${r.affected_batches ? JSON.parse(r.affected_batches).length : 0}</td>
              <td>${formatDate(r.created_at)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ── APPOINTMENTS PAGE ──────────────────────────────────────────────────────
// H-10: Calendar view toggle
let apptViewMode = 'list';
async function renderAppointments(el) {
  const appts = await API.get('/api/appointments');
  const isStaff = ['admin', 'nurse'].includes(currentUser.role);

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  let html = `<div class="action-bar" style="margin-bottom:16px;">
    <span>${appts.length} appointment${appts.length !== 1 ? 's' : ''}</span>
    <div class="btn-group">
      <button class="btn-dash ${apptViewMode === 'list' ? 'btn-dash-primary' : 'btn-dash-outline'}" onclick="setApptView('list')">List</button>
      <button class="btn-dash ${apptViewMode === 'calendar' ? 'btn-dash-primary' : 'btn-dash-outline'}" onclick="setApptView('calendar')">Calendar</button>
      ${isStaff ? '<button class="btn-dash btn-dash-accent" onclick="openAppointmentModal()">+ New Appointment</button>' : ''}
    </div>
  </div>`;

  if (apptViewMode === 'calendar') {
    // Build calendar grid
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Group appointments by date
    const apptByDate = {};
    appts.forEach(a => {
      const d = a.appointment_date ? a.appointment_date.substring(0, 10) : null;
      if (d) { if (!apptByDate[d]) apptByDate[d] = []; apptByDate[d].push(a); }
    });

    let calCells = '';
    for (let i = 0; i < firstDay; i++) calCells += '<div class="cal-cell cal-empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dayAppts = apptByDate[dateStr] || [];
      const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
      calCells += `<div class="cal-cell ${isToday ? 'cal-today' : ''}">
        <div class="cal-day-num">${d}</div>
        ${dayAppts.map(a => `<div class="cal-event cal-event-${a.status.toLowerCase()}" title="${a.first_name ? a.first_name + ' ' + a.last_name : 'General'} \u2014 ${a.program || ''} @ ${a.appointment_time || 'TBD'}">
          ${a.first_name ? a.first_name : 'Appt'}
        </div>`).join('')}
      </div>`;
    }

    html += `<div class="dash-card">
      <div class="dash-card-header">
        <span class="dash-card-title">${monthNames[month]} ${year}</span>
      </div>
      <div class="cal-grid-wrap">
        <div class="cal-header">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div>${d}</div>`).join('')}</div>
        <div class="cal-grid">${calCells}</div>
      </div>
      <div style="padding:12px 20px;display:flex;gap:10px;flex-wrap:wrap;border-top:1px solid var(--clr-border);">
        <span style="display:flex;align-items:center;gap:5px;font-size:0.75rem;"><span style="width:10px;height:10px;border-radius:3px;background:#d1fae5;display:inline-block;"></span>Scheduled</span>
        <span style="display:flex;align-items:center;gap:5px;font-size:0.75rem;"><span style="width:10px;height:10px;border-radius:3px;background:#e3f0fb;display:inline-block;"></span>Completed</span>
        <span style="display:flex;align-items:center;gap:5px;font-size:0.75rem;"><span style="width:10px;height:10px;border-radius:3px;background:#fde8e8;display:inline-block;"></span>Cancelled</span>
      </div>
    </div>`;
  } else {
    html += `<div class="dash-card">
    <div class="dash-card-header"><span class="dash-card-title">Appointments</span></div>
    <div class="dash-card-body no-pad">
      <table class="dash-table">
        <thead><tr><th>ID</th><th>Donor</th><th>Program</th><th>Date</th><th>Time</th><th>Status</th>${isStaff ? '<th>Actions</th>' : ''}</tr></thead>
        <tbody>
        ${appts.length === 0 ? `<tr><td colspan="${isStaff ? 7 : 6}" class="empty-state">No appointments</td></tr>` :
          appts.map(a => `<tr>
            <td>${a.appointment_id}</td>
            <td>${a.first_name ? escHtml(a.first_name + ' ' + a.last_name) : '—'}</td>
            <td>${(a.program || '').replace(/_/g, ' ')}</td>
            <td>${a.appointment_date}</td>
            <td>${a.appointment_time || '—'}</td>
            <td><span class="badge ${a.status.toLowerCase()}">${a.status}</span></td>
            ${isStaff ? `<td><div class="btn-group">
              ${a.status === 'SCHEDULED' ? `<button class="btn-dash btn-dash-primary btn-dash-sm" onclick="updateAppt('${a.appointment_id}', 'COMPLETED')">Complete</button>
              <button class="btn-dash btn-dash-danger btn-dash-sm" onclick="updateAppt('${a.appointment_id}', 'CANCELLED')">Cancel</button>` : ''}
            </div></td>` : ''}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
  }

  el.innerHTML = html;
}

window.setApptView = function(mode) {
  apptViewMode = mode;
  loadPage('appointments');
};

// ── REPORTS PAGE ────────────────────────────────────────────────────────────────
// H-05: Period filter, H-06: Formatted print, L-07: Chart.js charts
let reportPeriod = 'all';
async function renderReports(el) {
  const stats = await API.get('/api/reports/dashboard');
  const batchResults = await API.get('/api/reports/batch-results');
  const collections = await API.get(`/api/reports/collections?period=${reportPeriod}`);
  const trends = await API.get('/api/reports/donor-trends');

  el.innerHTML = `
    <!-- H-05: Period filter -->
    <div class="action-bar" style="margin-bottom:16px;">
      <span class="dash-section-title">Analytics &amp; Reports</span>
      <div class="btn-group">
        <button class="btn-dash ${reportPeriod === 'all' ? 'btn-dash-primary' : 'btn-dash-outline'}" onclick="setReportPeriod('all')">All Time</button>
        <button class="btn-dash ${reportPeriod === 'year' ? 'btn-dash-primary' : 'btn-dash-outline'}" onclick="setReportPeriod('year')">Year</button>
        <button class="btn-dash ${reportPeriod === 'month' ? 'btn-dash-primary' : 'btn-dash-outline'}" onclick="setReportPeriod('month')">Month</button>
        <button class="btn-dash ${reportPeriod === 'week' ? 'btn-dash-primary' : 'btn-dash-outline'}" onclick="setReportPeriod('week')">Week</button>
      </div>
    </div>

    <div class="stats-grid">
      ${statCard('blue', ICONS.donors, stats.donors.total, 'Total Donors')}
      ${statCard('green', ICONS.milk, (Number(stats.donations.total_volume_ml) || 0).toFixed(1) + ' ml', 'Total Volume Collected')}
      ${statCard('teal', ICONS.inventory, stats.batches.dispensed, 'Batches Dispensed')}
      ${statCard('red', ICONS.recall, stats.recalls.total, 'Recall Events')}
    </div>

    <!-- L-07: Chart.js charts -->
    <div class="dash-grid-2" style="margin-bottom:20px;">
      <div class="dash-card">
        <div class="dash-card-header"><span class="dash-card-title">Batch Status Breakdown</span></div>
        <div class="dash-card-body" style="display:flex;align-items:center;justify-content:center;">
          <canvas id="chart-batch" width="260" height="260" style="max-width:260px;"></canvas>
        </div>
      </div>
      <div class="dash-card">
        <div class="dash-card-header"><span class="dash-card-title">Milk Collected (Last 7 Days)</span></div>
        <div class="dash-card-body">
          <canvas id="chart-collections" height="200"></canvas>
        </div>
      </div>
    </div>

    <div class="dash-grid-2">
      <div class="dash-card">
        <div class="dash-card-header"><span class="dash-card-title">Batch Results Summary</span></div>
        <div class="dash-card-body">
          ${batchResults.length === 0 ? '<p class="empty-state">No batch data yet</p>' :
            batchResults.map(r => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--clr-bg);">
              <span class="badge ${r.batch_status.toLowerCase()}">${r.batch_status}</span>
              <strong>${r.count}</strong>
            </div>`).join('')}
        </div>
      </div>
      <div class="dash-card">
        <div class="dash-card-header"><span class="dash-card-title">Key Metrics</span></div>
        <div class="dash-card-body">
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--clr-bg);"><span>Approved Donors</span><strong>${stats.donors.approved}</strong></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--clr-bg);"><span>Active Requests</span><strong>${stats.requests.pending}</strong></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--clr-bg);"><span>Total Recipients</span><strong>${stats.recipients.total}</strong></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;"><span>Scheduled Appointments</span><strong>${stats.appointments.scheduled}</strong></div>
        </div>
      </div>
    </div>

    <!-- H-06: Print / Export -->
    <div class="dash-card">
      <div class="dash-card-header">
        <span class="dash-card-title">Generate Report</span>
      </div>
      <div class="dash-card-body">
        <p style="font-size:0.82rem;color:var(--clr-text-muted);margin-bottom:12px;">Export a formatted summary report. The printed report will include all statistics, batch breakdown, and collection data for the selected period.</p>
        <div class="btn-group">
          <button class="btn-dash btn-dash-primary" onclick="printFormattedReport()">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="#fff"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
            Print Report
          </button>
        </div>
      </div>
    </div>`;

  // Render Chart.js charts after DOM update
  setTimeout(() => renderReportCharts(batchResults, collections), 50);
}

// ── AUDIT PAGE ───────────────────────────────────────────
async function renderAudit(el) {
  const data = await API.get('/api/audit?limit=50');

  el.innerHTML = `
    <div class="dash-card">
      <div class="dash-card-header">
        <span class="dash-card-title">System Audit Trail (${data.total} total events)</span>
        <span style="font-size:0.72rem;color:var(--clr-text-muted);">Immutable — No records can be modified or deleted</span>
      </div>
      <div class="dash-card-body no-pad">
        <table class="dash-table">
          <thead><tr><th>User</th><th>Action</th><th>Details</th><th>IP</th><th>Timestamp</th></tr></thead>
          <tbody>
          ${data.logs.map(l => `<tr>
            <td>${escHtml(l.username || l.user_id)}</td>
            <td><span class="badge ${l.action.includes('FAIL') || l.action.includes('RECALL') || l.action.includes('UNAUTHORIZED') ? 'fail' : 'active'}">${l.action}</span></td>
            <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(l.details || '')}</td>
            <td>${l.ip_address || '—'}</td>
            <td>${formatDate(l.timestamp)}</td>
          </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ── PROFILE PAGE ─────────────────────────────────────────
async function renderProfile(el) {
  if (currentUser.role === 'donor') {
    const profile = await API.get('/api/donors/my/profile');
    const q = profile.questionnaire_data ? (typeof profile.questionnaire_data === 'string' ? JSON.parse(profile.questionnaire_data) : profile.questionnaire_data) : null;
    // C-08: Full donor health questionnaire form
    el.innerHTML = `
      <div class="dash-card" style="margin-bottom:20px;">
        <div class="dash-card-header"><span class="dash-card-title">My Donor Profile</span></div>
        <div class="dash-card-body">
          <div class="dash-grid-2">
            <div><label class="form-label-dash">Donor ID</label><p><strong>${profile.donor_id}</strong></p></div>
            <div><label class="form-label-dash">Status</label><p><span class="badge ${profile.screening_status.toLowerCase()}">${profile.screening_status}</span></p></div>
            <div><label class="form-label-dash">Name</label><p>${escHtml(profile.first_name)} ${escHtml(profile.last_name)}</p></div>
            <div><label class="form-label-dash">Blood Type</label><p>${profile.blood_type || 'Not set'}</p></div>
            <div><label class="form-label-dash">Contact</label><p>${profile.contact_number || 'Not set'}</p></div>
            <div><label class="form-label-dash">Enrollment</label><p>${profile.enrollment_date || 'Pending'}</p></div>
          </div>
        </div>
      </div>
      <div class="dash-card">
        <div class="dash-card-header">
          <span class="dash-card-title">Health Screening Questionnaire</span>
          <span style="font-size:0.75rem;color:var(--clr-text-muted);">Required before your first donation (§3.2, DOH PHM)</span>
        </div>
        <div class="dash-card-body">
          ${!profile.questionnaire_completed || !q ? '<div style="background:var(--clr-warning-bg,#fff3cd);border:1px solid var(--clr-warning,#d35400);padding:10px 14px;border-radius:6px;margin-bottom:16px;font-size:0.85rem;"><strong>Action Required:</strong> Please complete the health questionnaire below before your first milk donation.</div>' : ''}
          <div class="form-group">
            <label>Date of Birth *</label>
            <input type="date" id="q-dob" class="dash-input" value="${profile.birth_date ? profile.birth_date.split('T')[0] : ''}" />
          </div>
          <div class="form-group">
            <label>Contact Number *</label>
            <input type="tel" id="q-contact" class="dash-input" value="${escHtml(profile.contact_number || '')}" placeholder="e.g., 09171234567" />
          </div>
          <div class="form-group">
            <label>Home Address *</label>
            <input type="text" id="q-address" class="dash-input" value="${escHtml(profile.home_address || '')}" placeholder="Street, City, Province" />
          </div>
          <div class="form-group">
            <label>Blood Type *</label>
            <select id="q-blood" class="dash-select">
              ${['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(t => `<option value="${t}" ${profile.blood_type === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
          <hr style="margin:16px 0;border-color:var(--clr-border);" />
          <p style="font-weight:600;margin-bottom:12px;font-size:0.9rem;">Clinical Health Risk Questions</p>
          <div class="form-group" style="display:flex;align-items:center;gap:12px;">
            <input type="checkbox" id="q-breastfeed" ${q && q.currently_breastfeeding ? 'checked' : ''} />
            <label for="q-breastfeed" style="margin:0;">I am currently breastfeeding an infant</label>
          </div>
          <div class="form-group" style="display:flex;align-items:center;gap:12px;">
            <input type="checkbox" id="q-surgery" ${q && q.recent_surgery ? 'checked' : ''} />
            <label for="q-surgery" style="margin:0;">I have had surgery in the past 6 months</label>
          </div>
          <div class="form-group" style="display:flex;align-items:center;gap:12px;">
            <input type="checkbox" id="q-transfusion" ${q && q.recent_transfusion ? 'checked' : ''} />
            <label for="q-transfusion" style="margin:0;">I have received a blood transfusion in the past 12 months</label>
          </div>
          <div class="form-group" style="display:flex;align-items:center;gap:12px;">
            <input type="checkbox" id="q-tattoo" ${q && q.tattoo_or_piercing_recent ? 'checked' : ''} />
            <label for="q-tattoo" style="margin:0;">I have had a tattoo or body piercing in the past 12 months</label>
          </div>
          <div class="form-group">
            <label>Smoking Status</label>
            <select id="q-smoke" class="dash-select">
              <option value="never" ${!q || q.smoking_status === 'never' ? 'selected' : ''}>Never smoked</option>
              <option value="former" ${q && q.smoking_status === 'former' ? 'selected' : ''}>Former smoker (quit 6+ months ago)</option>
              <option value="current" ${q && q.smoking_status === 'current' ? 'selected' : ''}>Current smoker</option>
            </select>
          </div>
          <div class="form-group">
            <label>Alcohol Use</label>
            <select id="q-alcohol" class="dash-select">
              <option value="none" ${!q || q.alcohol_use === 'none' ? 'selected' : ''}>None</option>
              <option value="occasional" ${q && q.alcohol_use === 'occasional' ? 'selected' : ''}>Occasional (social)</option>
              <option value="regular" ${q && q.alcohol_use === 'regular' ? 'selected' : ''}>Regular</option>
            </select>
          </div>
          <div class="form-group">
            <label>Current Medications (if any)</label>
            <input type="text" id="q-meds" class="dash-input" value="${escHtml(q ? q.medications : '')}" placeholder="List any medications, or leave blank if none" />
          </div>
          <div class="form-group">
            <label>Chronic Conditions (if any)</label>
            <input type="text" id="q-chronic" class="dash-input" value="${escHtml(q ? q.chronic_conditions : '')}" placeholder="e.g., Diabetes, Hypertension, or leave blank" />
          </div>
          <div style="margin-top:16px;">
            <button class="btn-dash btn-dash-primary" onclick="submitQuestionnaire()">Save Health Questionnaire</button>
          </div>
        </div>
      </div>`;
  } else if (currentUser.role === 'recipient') {
    const profile = await API.get('/api/recipients/my/profile');
    el.innerHTML = `
      <div class="dash-card">
        <div class="dash-card-header"><span class="dash-card-title">My Recipient Profile</span></div>
        <div class="dash-card-body">
          <div class="dash-grid-2">
            <div><label class="form-label-dash">Recipient ID</label><p><strong>${profile.recipient_id}</strong></p></div>
            <div><label class="form-label-dash">Priority</label><p><span class="badge ${(profile.priority_status || 'normal').toLowerCase()}">${profile.priority_status}</span></p></div>
            <div><label class="form-label-dash">Infant Name</label><p>${escHtml(profile.infant_name)}</p></div>
            <div><label class="form-label-dash">Guardian</label><p>${escHtml(profile.guardian_name)}</p></div>
            <div><label class="form-label-dash">Hospital</label><p>${escHtml(profile.hospital_name || '—')}</p></div>
            <div><label class="form-label-dash">Doctor</label><p>${escHtml(profile.doctor_name || '—')}</p></div>
            <div><label class="form-label-dash">Diagnosis</label><p>${escHtml(profile.diagnosis || '—')}</p></div>
            <div><label class="form-label-dash">Birth Weight</label><p>${profile.birth_weight_grams ? profile.birth_weight_grams + 'g' : '—'}</p></div>
          </div>
        </div>
      </div>`;
  }
}

// ── TRACK ORDER PAGE ─────────────────────────────────────
async function renderTrackOrder(el) {
  el.innerHTML = `
    <div class="dash-card">
      <div class="dash-card-header"><span class="dash-card-title">Track Your Order</span></div>
      <div class="dash-card-body">
        <div class="dash-form">
          <div class="form-group">
            <label>Tracking Code</label>
            <input type="text" id="track-code-input" class="dash-input" placeholder="Enter your tracking code (e.g., TRK-ABC123)" />
          </div>
          <button class="btn-dash btn-dash-primary" onclick="trackOrder()">🔍 Track Order</button>
        </div>
        <div id="track-result" style="margin-top:20px;"></div>
      </div>
    </div>`;
}

// ── MODAL HELPERS ────────────────────────────────────────
function openModal(title, bodyHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-overlay').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

// ── Screening Modal ──────────────────────────────────────
window.openScreeningModal = function(donorId, donorName) {
  openModal(`Screen Donor: ${donorName}`, `
    <p style="margin-bottom:16px;font-size:0.82rem;color:var(--clr-text-muted);">Record blood test and medical screening results for <strong>${donorName}</strong> (${donorId}).</p>
    <div class="form-group">
      <label>HIV Test Result *</label>
      <select id="scr-hiv" class="dash-select"><option value="NEGATIVE">NEGATIVE</option><option value="POSITIVE">POSITIVE</option></select>
    </div>
    <div class="form-group">
      <label>Hepatitis B Test Result *</label>
      <select id="scr-hepb" class="dash-select"><option value="NEGATIVE">NEGATIVE</option><option value="POSITIVE">POSITIVE</option></select>
    </div>
    <div class="form-group">
      <label>Syphilis Test Result *</label>
      <select id="scr-syphilis" class="dash-select"><option value="NEGATIVE">NEGATIVE</option><option value="POSITIVE">POSITIVE</option></select>
    </div>
    <div class="form-group">
      <label>Screening Date</label>
      <input type="date" id="scr-date" class="dash-input" value="${new Date().toISOString().split('T')[0]}" />
    </div>
    <div class="form-group">
      <label>Physician Notes</label>
      <textarea id="scr-notes" class="dash-textarea" placeholder="Optional notes..."></textarea>
    </div>
    <div class="modal-actions">
      <button class="btn-dash btn-dash-outline" onclick="closeModal()">Cancel</button>
      <button class="btn-dash btn-dash-primary" onclick="submitScreening('${donorId}')">Submit Screening</button>
    </div>
  `);
};

window.submitScreening = async function(donorId) {
  const result = await API.post('/api/donors/screening', {
    donor_id: donorId,
    hiv_result: document.getElementById('scr-hiv').value,
    hep_b_result: document.getElementById('scr-hepb').value,
    syphilis_result: document.getElementById('scr-syphilis').value,
    screening_date: document.getElementById('scr-date').value,
    physician_notes: document.getElementById('scr-notes').value
  });
  closeModal();
  if (result.success) {
    toast(result.message, result.result === 'APPROVED' ? 'success' : 'warning');
  } else {
    toast(result.error, 'error');
  }
  loadPage('donors');
};

// ── Donation Modal ───────────────────────────────────────
window.openDonationModal = async function() {
  const donors = await API.get('/api/donors');
  // C-02: Only show donors who are APPROVED AND have all three tests NEGATIVE
  const approved = donors.filter(d =>
    d.screening_status === 'APPROVED' &&
    d.hiv_result === 'NEGATIVE' &&
    d.hep_b_result === 'NEGATIVE' &&
    d.syphilis_result === 'NEGATIVE'
  );

  openModal('Record New Donation', `
    <div class="form-group">
      <label>Donor *</label>
      <select id="don-donor" class="dash-select">
        <option value="">Select approved donor...</option>
        ${approved.map(d => `<option value="${d.donor_id}">${d.donor_id} — ${d.first_name} ${d.last_name}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Donation Date *</label>
      <input type="date" id="don-date" class="dash-input" value="${new Date().toISOString().split('T')[0]}" />
    </div>
    <div class="form-group">
      <label>Volume (ml) *</label>
      <input type="number" id="don-volume" class="dash-input" min="1" step="0.1" placeholder="Enter volume in ml" />
    </div>
    <div class="form-group">
      <label>Expressed Date</label>
      <input type="date" id="don-expressed" class="dash-input" value="${new Date().toISOString().split('T')[0]}" />
    </div>
    <div class="modal-actions">
      <button class="btn-dash btn-dash-outline" onclick="closeModal()">Cancel</button>
      <button class="btn-dash btn-dash-accent" onclick="submitDonation()">Record Donation</button>
    </div>
  `);
};

window.submitDonation = async function() {
  const result = await API.post('/api/milk/donate', {
    donor_id: document.getElementById('don-donor').value,
    donation_date: document.getElementById('don-date').value,
    volume_ml: document.getElementById('don-volume').value,
    expressed_date: document.getElementById('don-expressed').value
  });
  closeModal();
  if (result.success) {
    toast(result.message, 'success');
  } else {
    toast(result.error, 'error');
  }
  loadPage('donations');
};

// ── QR Code Viewer ───────────────────────────────────────
window.viewQR = async function(donationId) {
  const data = await API.get(`/api/milk/qr/${donationId}`);
  if (data.qr) {
    // H-07: QR Code label print interface
    openModal(`QR Code: ${donationId}`, `
      <div class="qr-display">
        <img src="${data.qr}" alt="QR Code for ${donationId}" />
        <p><strong>${data.data.donor}</strong></p>
        <p>Date: ${data.data.date} | Volume: ${data.data.volume}</p>
        <p style="font-size:0.72rem;color:var(--clr-text-muted);margin-top:4px;">Scan with QR reader to verify</p>
      </div>
      <div class="modal-actions">
        <button class="btn-dash btn-dash-outline" onclick="closeModal()">Close</button>
        <button class="btn-dash btn-dash-primary" onclick="printQRLabel('${donationId}', '${data.data.donor.replace(/'/g, '&apos;')}', '${data.data.date}', '${data.data.volume}', this.closest('.modal-content').querySelector('.qr-display img').src)">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="#fff"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
          Print Label
        </button>
      </div>
    `);
  }
};

// H-07: Print label for milk container
window.printQRLabel = function(id, donor, date, volume, qrSrc) {
  const win = window.open('', '_blank', 'width=400,height=500');
  win.document.write(`<!DOCTYPE html><html><head><title>Milk Label — ${id}</title>
    <style>body{font-family:Arial,sans-serif;margin:0;padding:24px;text-align:center;}
    .label-box{border:2px solid #1a6fa8;border-radius:8px;padding:20px;display:inline-block;min-width:280px;}
    h2{color:#1a6fa8;font-size:1rem;margin:0 0 12px;}
    img{width:180px;height:180px;}
    .field{font-size:0.82rem;margin:4px 0;text-align:left;}
    .field strong{color:#1a1a2e;}
    .barcode{font-size:0.72rem;color:#666;margin-top:8px;border-top:1px dashed #ccc;padding-top:8px;}
    @media print{body{margin:0;}}</style>
  </head><body>
    <div class="label-box">
      <h2>MAKATI HUMAN MILK BANK</h2>
      <img src="${qrSrc}" alt="QR" />
      <div class="field"><strong>Donation ID:</strong> ${id}</div>
      <div class="field"><strong>Donor:</strong> ${donor}</div>
      <div class="field"><strong>Date:</strong> ${date}</div>
      <div class="field"><strong>Volume:</strong> ${volume}</div>
      <div class="field" style="color:#dc2626;font-weight:700;">STORE AT -20°C</div>
      <div class="barcode">HMBMS — DOH PHM Compliant — ${id}</div>
    </div>
    <script>window.onload=function(){window.print();}<\/script>
  </body></html>`);
  win.document.close();
};

// ── Storage Logging ──────────────────────────────────────
window.logStorage = async function(donationId) {
  // C-03 + C-07: storage temp input with max constraint and live warning
  openModal(`Log Storage: ${donationId}`, `
    <div class="form-group">
      <label>Freezer Location</label>
      <select id="stor-loc" class="dash-select">
        <option value="Freezer A">Freezer A</option>
        <option value="Freezer B">Freezer B</option>
        <option value="Freezer C">Freezer C</option>
      </select>
    </div>
    <div class="form-group">
      <label>Storage Temperature (°C) — Must be -20°C or colder</label>
      <input type="number" id="stor-temp" class="dash-input" value="-20" max="-20" step="1"
             oninput="checkStorageTemp()" />
      <div id="stor-temp-warn" style="display:none;color:var(--clr-error);font-size:0.82rem;font-weight:600;margin-top:6px;padding:6px 10px;background:#fff0f0;border:1px solid var(--clr-error);border-radius:4px;">
        SAFETY VIOLATION: Temperature must be -20°C or colder as per DOH guidelines.
      </div>
    </div>
    <p style="font-size:0.82rem;color:var(--clr-text-muted);margin:10px 0;">DOH guidelines require milk to be stored frozen at -20°C.</p>
    <div class="modal-actions">
      <button class="btn-dash btn-dash-outline" onclick="closeModal()">Cancel</button>
      <button class="btn-dash btn-dash-primary" id="stor-submit-btn" onclick="submitStorage('${donationId}')">Log Storage</button>
    </div>
  `);
};

window.checkStorageTemp = function() {
  const val = Number(document.getElementById('stor-temp').value);
  const warn = document.getElementById('stor-temp-warn');
  const btn = document.getElementById('stor-submit-btn');
  if (val > -20) {
    warn.style.display = 'block';
    btn.disabled = true;
    btn.style.opacity = '0.5';
  } else {
    warn.style.display = 'none';
    btn.disabled = false;
    btn.style.opacity = '1';
  }
};

window.submitStorage = async function(donationId) {
  const tempVal = Number(document.getElementById('stor-temp').value);
  // C-03: Frontend guard — should already be blocked by checkStorageTemp() but double-check
  if (tempVal > -20) {
    toast('SAFETY VIOLATION: Storage temperature must be -20°C or colder.', 'error');
    return;
  }
  const result = await API.post('/api/milk/storage', {
    donation_id: donationId,
    freezer_location: document.getElementById('stor-loc').value,
    storage_temp: tempVal
  });
  closeModal();
  if (result.safety_alert) {
    toast('SAFETY VIOLATION: ' + result.error, 'error');
  } else {
    toast(result.success ? result.message : result.error, result.success ? 'success' : 'error');
  }
  loadPage('donations');
};

// ── Create Batch Modal ───────────────────────────────────
window.openCreateBatchModal = async function() {
  const donations = await API.get('/api/milk/donations');
  const stored = donations.filter(d => d.storage_status === 'STORED');

  openModal('Create Pasteurization Batch', `
    <p style="font-size:0.82rem;color:var(--clr-text-muted);margin-bottom:12px;">Select stored donations to pool into a pasteurization batch.</p>
    <div class="form-group">
      <label>Select Donations</label>
      ${stored.length === 0 ? '<p>No stored donations available.</p>' :
        stored.map(d => `<div style="display:flex;gap:10px;align-items:center;padding:6px 0;font-size:0.85rem;border-bottom:1px solid var(--clr-bg);">
          <input type="checkbox" class="batch-donation-cb" id="cb-${d.donation_id}" value="${d.donation_id}" style="width:16px;height:16px;flex-shrink:0;" />
          <label for="cb-${d.donation_id}" style="margin:0;cursor:pointer;flex:1;">${d.donation_id} — ${d.first_name} ${d.last_name} (${d.volume_ml}ml)</label>
        </div>`).join('')}
    </div>
    <div class="form-group" style="display:flex;gap:10px;align-items:center;padding:8px 0;">
      <input type="checkbox" id="batch-thaw" style="width:16px;height:16px;flex-shrink:0;" />
      <label for="batch-thaw" style="margin:0;">Milk thawed for under 24 hours</label>
    </div>
    <div class="form-group" style="display:flex;gap:10px;align-items:center;padding:8px 0;">
      <input type="checkbox" id="batch-laminar" style="width:16px;height:16px;flex-shrink:0;" />
      <label for="batch-laminar" style="margin:0;">Pooled under laminar flow hood</label>
    </div>
    <div class="modal-actions">
      <button class="btn-dash btn-dash-outline" onclick="closeModal()">Cancel</button>
      <button class="btn-dash btn-dash-accent" onclick="submitBatch()">Create Batch</button>
    </div>
  `);
};

window.submitBatch = async function() {
  const donationIds = [...document.querySelectorAll('.batch-donation-cb:checked')].map(cb => cb.value);
  if (donationIds.length === 0) return toast('Select at least one donation.', 'error');

  const result = await API.post('/api/batches/create', {
    donation_ids: donationIds,
    thaw_confirmed: document.getElementById('batch-thaw').checked,
    laminar_flow_confirmed: document.getElementById('batch-laminar').checked
  });
  closeModal();
  toast(result.success ? result.message : result.error, result.success ? 'success' : 'error');
  loadPage('batches');
};

// ── Pasteurize Modal ─────────────────────────────────────
window.openPasteurizeModal = function(batchId) {
  openModal(`Pasteurize Batch: ${batchId}`, `
    <p style="font-size:0.82rem;color:var(--clr-text-muted);margin-bottom:12px;">Record pasteurization details. Temperature must be ≥62.5°C and duration ≥30 minutes.</p>
    <div class="form-group">
      <label>Start Time *</label>
      <input type="datetime-local" id="past-start" class="dash-input" />
    </div>
    <div class="form-group">
      <label>End Time *</label>
      <input type="datetime-local" id="past-end" class="dash-input" />
    </div>
    <div class="form-group">
      <label>Temperature (°C) *</label>
      <input type="number" id="past-temp" class="dash-input" step="0.1" value="62.5" min="62.5" />
    </div>
    <div class="form-group">
      <label>Duration (minutes) *</label>
      <input type="number" id="past-dur" class="dash-input" value="30" min="30" />
    </div>
    <div class="form-group">
      <label>Technician Name</label>
      <input type="text" id="past-tech" class="dash-input" value="${currentUser.first_name} ${currentUser.last_name}" />
    </div>
    <div class="modal-actions">
      <button class="btn-dash btn-dash-outline" onclick="closeModal()">Cancel</button>
      <button class="btn-dash btn-dash-primary" onclick="submitPasteurize('${batchId}')">Log Pasteurization</button>
    </div>
  `);
};

window.submitPasteurize = async function(batchId) {
  const result = await API.post('/api/batches/pasteurize', {
    batch_id: batchId,
    start_time: document.getElementById('past-start').value,
    end_time: document.getElementById('past-end').value,
    temperature: document.getElementById('past-temp').value,
    duration_minutes: document.getElementById('past-dur').value,
    technician_name: document.getElementById('past-tech').value
  });
  closeModal();
  if (result.safety_alert) {
    toast('⚠️ SAFETY VIOLATION: ' + result.error, 'error');
  } else {
    toast(result.success ? result.message : result.error, result.success ? 'success' : 'error');
  }
  loadPage('batches');
};

// ── Lab Test Modal ───────────────────────────────────────
window.openLabTestModal = function(batchId) {
  // C-05: Both bacterial count fields are required (§3.7)
  openModal(`Lab Test: ${batchId}`, `
    <p style="font-size:0.82rem;color:var(--clr-text-muted);margin-bottom:12px;">Record bacterial count results before and after pasteurization. All fields are required per DOH §3.7.</p>
    <div class="form-group">
      <label>Pre-Pasteurization Result *</label>
      <select id="lab-pre" class="dash-select"><option value="PASS">PASS</option><option value="FAIL">FAIL</option></select>
    </div>
    <div class="form-group">
      <label>Pre-Pasteurization Bacterial Count * <span style="font-size:0.75rem;color:var(--clr-text-muted);">(e.g., &lt;10 CFU/ml)</span></label>
      <input type="text" id="lab-pre-count" class="dash-input" placeholder="e.g., <10 CFU/ml" required />
    </div>
    <div class="form-group">
      <label>Post-Pasteurization Result *</label>
      <select id="lab-post" class="dash-select"><option value="PASS">PASS</option><option value="FAIL">FAIL</option></select>
    </div>
    <div class="form-group">
      <label>Post-Pasteurization Bacterial Count * <span style="font-size:0.75rem;color:var(--clr-text-muted);">(e.g., 0 CFU/ml)</span></label>
      <input type="text" id="lab-post-count" class="dash-input" placeholder="e.g., 0 CFU/ml" required />
    </div>
    <div class="modal-actions">
      <button class="btn-dash btn-dash-outline" onclick="closeModal()">Cancel</button>
      <button class="btn-dash btn-dash-accent" onclick="submitLabTest('${batchId}')">Submit Results</button>
    </div>
  `);
};

window.submitLabTest = async function(batchId) {
  // C-05: Validate bacterial counts before submitting
  const preCount = document.getElementById('lab-pre-count').value.trim();
  const postCount = document.getElementById('lab-post-count').value.trim();
  if (!preCount || !postCount) {
    toast('Both pre and post bacterial count values are required (e.g., "<10 CFU/ml").', 'error');
    return;
  }
  const result = await API.post('/api/batches/labtest', {
    batch_id: batchId,
    pre_test_result: document.getElementById('lab-pre').value,
    post_test_result: document.getElementById('lab-post').value,
    pre_bacterial_count: preCount,
    post_bacterial_count: postCount
  });
  closeModal();
  toast(result.success ? result.message : result.error, result.success ? (result.batch_status === 'PASS' ? 'success' : 'warning') : 'error');
  loadPage('batches');
};

// ── Batch Details ────────────────────────────────────────
window.viewBatchDetails = async function(batchId) {
  const data = await API.get(`/api/batches/${batchId}`);
  // BUG-07: Show bacterial count values in details modal
  openModal(`Batch Details: ${batchId}`, `
    <div class="dash-grid-2" style="margin-bottom:16px;">
      <div><label class="form-label-dash">Status</label><span class="badge ${data.batch_status.toLowerCase()}">${data.batch_status}</span></div>
      <div><label class="form-label-dash">Temperature</label><p>${data.temperature ? data.temperature + '°C' : '—'}</p></div>
      <div><label class="form-label-dash">Duration</label><p>${data.duration_minutes ? data.duration_minutes + ' min' : '—'}</p></div>
      <div><label class="form-label-dash">Expiry</label><p>${data.expiration_date || '—'}</p></div>
      <div><label class="form-label-dash">Storage</label><p>${data.storage_location || '—'}</p></div>
      <div><label class="form-label-dash">Technician</label><p>${data.technician_name || '—'}</p></div>
    </div>
    ${data.pre_test_result ? `<div style="background:var(--clr-bg);padding:10px 14px;border-radius:6px;margin-bottom:14px;">
      <p style="font-weight:700;font-size:0.82rem;margin-bottom:8px;">Lab Results</p>
      <div class="dash-grid-2">
        <div><label class="form-label-dash">Pre-Pasteurization</label><span class="badge ${data.pre_test_result.toLowerCase()}">${data.pre_test_result}</span></div>
        <div><label class="form-label-dash">Pre Bacterial Count</label><p style="font-family:monospace;">${data.pre_bacterial_count || '—'}</p></div>
        <div><label class="form-label-dash">Post-Pasteurization</label><span class="badge ${data.post_test_result.toLowerCase()}">${data.post_test_result}</span></div>
        <div><label class="form-label-dash">Post Bacterial Count</label><p style="font-family:monospace;">${data.post_bacterial_count || '—'}</p></div>
      </div>
    </div>` : ''}
    <h4 style="font-size:0.85rem;font-weight:700;margin-bottom:8px;">Chain of Custody</h4>
    <div class="custody-timeline">
      ${(data.custody || []).map(c => `
        <div class="custody-item">
          <div class="custody-action">${c.action}</div>
          <div class="custody-details">${c.first_name} ${c.last_name}${c.temperature ? ` — ${c.temperature}°C` : ''}${c.notes ? ` — ${c.notes}` : ''}</div>
          <div class="custody-time">${formatDate(c.timestamp)}</div>
        </div>
      `).join('')}
    </div>
  `);
};

// ── Donor Details ────────────────────────────────────────
window.viewDonorDetails = async function(donorId) {
  const donor = await API.get(`/api/donors/${donorId}`);
  openModal(`Donor: ${donor.first_name} ${donor.last_name}`, `
    <div class="dash-grid-2">
      <div><label class="form-label-dash">Donor ID</label><p><strong>${donor.donor_id}</strong></p></div>
      <div><label class="form-label-dash">Status</label><span class="badge ${donor.screening_status.toLowerCase()}">${donor.screening_status}</span></div>
      <div><label class="form-label-dash">Blood Type</label><p>${donor.blood_type || '—'}</p></div>
      <div><label class="form-label-dash">Contact</label><p>${donor.contact_number || '—'}</p></div>
      <div><label class="form-label-dash">HIV</label><p>${donor.hiv_result ? `<span class="badge ${donor.hiv_result === 'NEGATIVE' ? 'pass' : 'fail'}">${donor.hiv_result}</span>` : '—'}</p></div>
      <div><label class="form-label-dash">Hepatitis B</label><p>${donor.hep_b_result ? `<span class="badge ${donor.hep_b_result === 'NEGATIVE' ? 'pass' : 'fail'}">${donor.hep_b_result}</span>` : '—'}</p></div>
      <div><label class="form-label-dash">Syphilis</label><p>${donor.syphilis_result ? `<span class="badge ${donor.syphilis_result === 'NEGATIVE' ? 'pass' : 'fail'}">${donor.syphilis_result}</span>` : '—'}</p></div>
      <div><label class="form-label-dash">Screening Date</label><p>${donor.screening_date || '—'}</p></div>
    </div>
  `);
};

// ── Request Actions ──────────────────────────────────────
window.approveRequest = async function(reqId) {
  const result = await API.put(`/api/requests/${reqId}/approve`);
  toast(result.message, result.success ? 'success' : 'error');
  loadPage('requests');
};

window.confirmPayment = async function(reqId) {
  // H-11: Auto-calculate fee from volume (SRS §3.5: ₱50 per 100ml standard MHMB rate)
  let autoFee = '';
  try {
    const requests = await API.get('/api/requests');
    const thisReq = requests.find(r => r.request_id === reqId);
    if (thisReq && thisReq.requested_volume_ml) {
      autoFee = (Math.ceil(thisReq.requested_volume_ml / 100) * 50).toFixed(2);
    }
  } catch (e) {}

  openModal('Confirm Payment', `
    <p style="font-size:0.82rem;color:var(--clr-text-muted);margin-bottom:12px;">Standard rate: ₱50.00 per 100 ml. Amount pre-filled based on requested volume.</p>
    <div class="form-group">
      <label>Payment Amount (₱)</label>
      <input type="number" id="pay-amount" class="dash-input" placeholder="Enter amount" min="0" step="0.01" value="${autoFee}" />
    </div>
    <div class="modal-actions">
      <button class="btn-dash btn-dash-outline" onclick="closeModal()">Cancel</button>
      <button class="btn-dash btn-dash-accent" onclick="submitPayment('${reqId}')">Confirm Payment</button>
    </div>
  `);
};

window.submitPayment = async function(reqId) {
  const result = await API.put(`/api/requests/${reqId}/payment`, {
    payment_amount: document.getElementById('pay-amount').value
  });
  closeModal();
  toast(result.message, result.success ? 'success' : 'error');
  loadPage('requests');
};

window.markReady = async function(reqId) {
  const result = await API.put(`/api/requests/${reqId}/ready`);
  
  if (result.success && result.sms_data && result.sms_data.simulated) {
    alert(`📱 [MOCK SMS GATEWAY]\n\nTo: ${result.sms_data.to}\nMessage: ${result.sms_data.text}\n\n(This proves the SMS logic triggered correctly!)`);
  }
  
  toast(result.message, result.success ? 'success' : 'error');
  loadPage('requests');
};

window.cancelRequest = async function(reqId) {
  if (!confirm('Cancel this request?')) return;
  const result = await API.put(`/api/requests/${reqId}/cancel`);
  toast(result.message, result.success ? 'success' : 'error');
  loadPage('requests');
};

window.openDispenseModal = async function(reqId) {
  const fifo = await API.get('/api/inventory/fifo');
  if (!fifo.available) {
    toast('No ready batches available for dispensing.', 'error');
    return;
  }
  openModal('Dispense Milk', `
    <p style="margin-bottom:12px;">FIFO-selected batch: <strong>${fifo.batch.batch_id}</strong> (${fifo.batch.total_volume_ml} ml)</p>
    <p style="font-size:0.82rem;color:var(--clr-warning);margin-bottom:16px;">${fifo.alert}</p>
    <div class="modal-actions">
      <button class="btn-dash btn-dash-outline" onclick="closeModal()">Cancel</button>
      <button class="btn-dash btn-dash-primary" onclick="dispense('${fifo.batch.batch_id}','${reqId}')">Confirm Dispensing</button>
    </div>
  `);
};

window.dispense = async function(batchId, reqId) {
  const result = await API.post('/api/inventory/dispense', { batch_id: batchId, request_id: reqId });
  closeModal();
  toast(result.success ? result.message : result.error, result.success ? 'success' : 'error');
  if (result.alert) toast(result.alert, 'warning');
  loadPage('requests');
};

// ── New Request Modal (Recipient) ────────────────────────
window.openNewRequestModal = function() {
  openModal('Submit Milk Request', `
    <div class="form-group">
      <label>Requested Volume (ml) *</label>
      <input type="number" id="req-volume" class="dash-input" min="1" placeholder="Enter volume" />
    </div>
    <div class="form-group">
      <label>Doctor's Prescription (optional)</label>
      <input type="file" id="req-file" class="dash-input" accept=".pdf,.jpg,.jpeg,.png" />
    </div>
    <div class="modal-actions">
      <button class="btn-dash btn-dash-outline" onclick="closeModal()">Cancel</button>
      <button class="btn-dash btn-dash-accent" onclick="submitRequest()">Submit Request</button>
    </div>
  `);
};

window.submitRequest = async function() {
  const formData = new FormData();
  formData.append('requested_volume_ml', document.getElementById('req-volume').value);
  const file = document.getElementById('req-file').files[0];
  if (file) formData.append('prescription', file);

  const result = await API.upload('/api/requests/submit', formData);
  closeModal();
  if (result.success) {
    toast(`Request submitted! Tracking code: ${result.tracking_code}`, 'success');
  } else {
    toast(result.error, 'error');
  }
  loadPage('requests');
};

// ── Questionnaire Submit (C-08) ──────────────────────────
window.submitQuestionnaire = async function() {
  const result = await API.post('/api/donors/questionnaire', {
    birth_date: document.getElementById('q-dob').value,
    contact_number: document.getElementById('q-contact').value,
    home_address: document.getElementById('q-address').value,
    blood_type: document.getElementById('q-blood').value,
    currently_breastfeeding: document.getElementById('q-breastfeed').checked,
    recent_surgery: document.getElementById('q-surgery').checked,
    recent_transfusion: document.getElementById('q-transfusion').checked,
    tattoo_or_piercing_recent: document.getElementById('q-tattoo').checked,
    smoking_status: document.getElementById('q-smoke').value,
    alcohol_use: document.getElementById('q-alcohol').value,
    medications: document.getElementById('q-meds').value,
    chronic_conditions: document.getElementById('q-chronic').value
  });
  if (result.success) {
    toast('Health questionnaire saved successfully.', 'success');
    loadPage('profile');
  } else {
    toast(result.error || 'Failed to save questionnaire.', 'error');
  }
};

window.trackOrder = async function() {
  const code = document.getElementById('track-code-input').value.trim();
  if (!code) return toast('Enter a tracking code.', 'error');

  // C-06: Handle 410 Gone (expired tracking code) by reading raw response
  const res = await fetch(`/api/requests/track/${code}`);
  const result = await res.json();
  const el = document.getElementById('track-result');

  // C-06: Expired tracking code (DISPENSED or CANCELLED)
  if (res.status === 410 && result.expired) {
    el.innerHTML = `<div class="dash-card" style="border-color:var(--clr-text-muted);">
      <div class="dash-card-body" style="text-align:center;padding:32px;">
        <div style="font-size:2rem;margin-bottom:12px;">&#10003;</div>
        <h3 style="margin-bottom:8px;">Tracking Code Expired</h3>
        <p style="color:var(--clr-text-muted);">${escHtml(result.error)}</p>
        <span class="badge ${result.status.toLowerCase()}" style="margin-top:12px;display:inline-block;">${result.status}</span>
      </div>
    </div>`;
    return;
  }

  if (result.error) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon" style="font-size:2rem;">&#10007;</div><h3>Not Found</h3><p>${escHtml(result.error)}</p></div>`;
    return;
  }

  const statusSteps = ['PENDING', 'APPROVED', 'READY', 'DISPENSED'];
  const currentIdx = statusSteps.indexOf(result.request_status);

  el.innerHTML = `
    <div class="dash-card">
      <div class="dash-card-header"><span class="dash-card-title">Order Status: ${result.tracking_code}</span></div>
      <div class="dash-card-body">
        <div style="display:flex;gap:12px;margin-bottom:20px;">
          ${statusSteps.map((s, i) => `<div style="flex:1;text-align:center;">
            <div style="width:32px;height:32px;margin:0 auto 6px;border-radius:50%;background:${i <= currentIdx ? 'var(--clr-accent)' : 'var(--clr-border)'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;">${i <= currentIdx ? '✓' : i + 1}</div>
            <div style="font-size:0.72rem;font-weight:600;color:${i <= currentIdx ? 'var(--clr-accent)' : 'var(--clr-text-muted)'}">${s}</div>
          </div>`).join('')}
        </div>
        <div class="dash-grid-2">
          <div><label class="form-label-dash">Status</label><span class="badge ${result.request_status.toLowerCase()}">${result.request_status}</span></div>
          <div><label class="form-label-dash">Volume</label><p>${result.requested_volume_ml} ml</p></div>
          <div><label class="form-label-dash">Infant</label><p>${escHtml(result.infant_name)}</p></div>
          <div><label class="form-label-dash">Hospital</label><p>${escHtml(result.hospital_name || '—')}</p></div>
        </div>
      </div>
    </div>`;
};

// ── Recall Execution ─────────────────────────────────────
window.executeRecall = async function() {
  const donorId = document.getElementById('recall-donor').value;
  const reason = document.getElementById('recall-reason').value;
  if (!donorId || !reason) return toast('Select a donor and provide a reason.', 'error');
  if (!confirm('⚠️ Are you sure? This will QUARANTINE all batches linked to this donor.')) return;

  const result = await API.post('/api/recalls/execute', { donor_id: donorId, reason });
  if (result.success) {
    toast(`🚨 ${result.message}`, 'warning');
  } else {
    toast(result.error, 'error');
  }
  loadPage('recall');
};

// ── Appointment Modal ────────────────────────────────────
window.openAppointmentModal = async function() {
  const donors = await API.get('/api/donors');
  openModal('Create Appointment', `
    <div class="form-group">
      <label>Donor (optional)</label>
      <select id="appt-donor" class="dash-select">
        <option value="">General appointment...</option>
        ${donors.map(d => `<option value="${d.donor_id}">${d.first_name} ${d.last_name}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Program</label>
      <select id="appt-program" class="dash-select">
        <option value="general">General</option>
        <option value="supsup_todo">Supsup Todo (Community)</option>
        <option value="milky_way">Milky Way (Hospital)</option>
        <option value="moms_act">Mom's Act (Household)</option>
      </select>
    </div>
    <div class="form-group">
      <label>Date *</label>
      <input type="date" id="appt-date" class="dash-input" />
    </div>
    <div class="form-group">
      <label>Time</label>
      <input type="time" id="appt-time" class="dash-input" />
    </div>
    <div class="form-group">
      <label>Location</label>
      <input type="text" id="appt-loc" class="dash-input" placeholder="Health center / address" />
    </div>
    <div class="modal-actions">
      <button class="btn-dash btn-dash-outline" onclick="closeModal()">Cancel</button>
      <button class="btn-dash btn-dash-accent" onclick="submitAppointment()">Create</button>
    </div>
  `);
};

window.submitAppointment = async function() {
  const result = await API.post('/api/appointments', {
    donor_id: document.getElementById('appt-donor').value || null,
    program: document.getElementById('appt-program').value,
    appointment_date: document.getElementById('appt-date').value,
    appointment_time: document.getElementById('appt-time').value,
    location: document.getElementById('appt-loc').value
  });
  closeModal();
  toast(result.success ? result.message : result.error, result.success ? 'success' : 'error');
  loadPage('appointments');
};

window.updateAppt = async function(id, status) {
  const result = await API.put(`/api/appointments/${id}`, { status });
  toast(result.message, result.success ? 'success' : 'error');
  loadPage('appointments');
};

// ── Utility Functions ────────────────────────────────────
function statCard(color, icon, value, label) {
  return `<div class="stat-card ${color}">
    <div class="stat-card-header"><div class="stat-card-icon">${icon}</div></div>
    <div class="stat-card-value">${value}</div>
    <div class="stat-card-label">${label}</div>
  </div>`;
}

function quickAction(color, icon, title, desc, onClick) {
  const id = 'qa-' + title.replace(/\s/g, '-').toLowerCase();
  window['__qa_' + id] = onClick;
  return `<div class="quick-action-card" id="${id}" data-action="${id}">
    <div class="quick-action-icon ${color}">${icon}</div>
    <div class="quick-action-text"><h4>${title}</h4><p>${desc}</p></div>
  </div>`;
}

function attachQuickActions() {
  document.querySelectorAll('.quick-action-card').forEach(card => {
    card.addEventListener('click', () => {
      const fn = window['__qa_' + card.id];
      if (fn) fn();
    });
  });
}

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toastEl = document.createElement('div');
  toastEl.className = `toast ${type}`;
  toastEl.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <div class="toast-text"><div class="toast-msg">${escHtml(message)}</div></div>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;
  container.appendChild(toastEl);
  setTimeout(() => toastEl.remove(), 6000);
}
