// src/components/management/sidebar.js
// Centralized sidebar — no collapse, just clean injection + active state + user info.

document.addEventListener('DOMContentLoaded', () => {

  // ── 1. Inject sidebar markup ──────────────────────────────────
  const container = document.getElementById('sidebar-container');
  if (!container) {
    console.warn('[sidebar.js] #sidebar-container not found.');
    return;
  }

  container.innerHTML = `
    <aside class="sidebar" id="sidebar">

      <!-- Logo -->
      <div class="sidebar-logo">
        <a href="/pages/management/dashboard.html" class="logo-mark">
          <div class="logo-icon">
            <i class="bi bi-heart-fill"></i>
          </div>
          <span class="logo-text">ANIMUA</span>
        </a>
      </div>

      <!-- Navigation -->
      <nav class="sidebar-nav">

        <div class="nav-section">
          <span class="nav-label">Main</span>

          <a href="/pages/management/dashboard.html"
             class="nav-item" data-page="dashboard">
            <span class="nav-icon"><i class="bi bi-grid-1x2-fill"></i></span>
            <span class="nav-text">Dashboard</span>
          </a>

          <a href="/pages/management/animalRecords.html"
             class="nav-item" data-page="animalRecords">
            <span class="nav-icon"><i class="bi bi-clipboard2-heart-fill"></i></span>
            <span class="nav-text">Animal Records</span>
            <span class="nav-badge" id="badge-records">12</span>
          </a>

          <a href="/pages/management/surrenders.html"
             class="nav-item" data-page="surrenders">
            <span class="nav-icon"><i class="bi bi-house-door-fill"></i></span>
            <span class="nav-text">Surrenders</span>
          </a>

          <a href="/pages/management/adoptions.html"
             class="nav-item" data-page="adoptions">
            <span class="nav-icon"><i class="bi bi-person-check-fill"></i></span>
            <span class="nav-text">Adoptions</span>
            <span class="nav-badge" id="badge-adoptions">5</span>
          </a>
        </div>

        <div class="nav-section">
          <span class="nav-label">Operations</span>

          <a href="/pages/management/inventory.html"
             class="nav-item" data-page="inventory">
            <span class="nav-icon"><i class="bi bi-box-seam-fill"></i></span>
            <span class="nav-text">Inventory</span>
          </a>

          <a href="/pages/management/reports.html"
             class="nav-item" data-page="reports">
            <span class="nav-icon"><i class="bi bi-bar-chart-fill"></i></span>
            <span class="nav-text">Reports</span>
          </a>

          <a href="/pages/management/petCompatibility.html"
             class="nav-item" data-page="petCompatibility">
            <span class="nav-icon"><i class="bi bi-cpu-fill"></i></span>
            <span class="nav-text">Pet Compatibility</span>
          </a>
        </div>

        <div class="nav-section">
          <span class="nav-label">System</span>

          <a href="/pages/management/team.html"
             class="nav-item" data-page="team">
            <span class="nav-icon"><i class="bi bi-people-fill"></i></span>
            <span class="nav-text">Team</span>
          </a>

          <a href="/pages/management/settings.html"
             class="nav-item" data-page="settings">
            <span class="nav-icon"><i class="bi bi-gear-fill"></i></span>
            <span class="nav-text">Settings</span>
          </a>

          <a href="/pages/management/help.html"
             class="nav-item" data-page="help">
            <span class="nav-icon"><i class="bi bi-question-circle-fill"></i></span>
            <span class="nav-text">Help</span>
          </a>
        </div>

      </nav>

      <!-- Footer -->
      <div class="sidebar-footer">
        <div class="sidebar-user" id="sidebar-user-card">
          <div class="s-avatar" id="sidebar-initials">AS</div>
          <div class="s-info">
            <div class="s-name" id="sidebar-name">Admin User</div>
            <div class="s-role" id="sidebar-role">Administrator</div>
          </div>
          <i class="bi bi-chevron-expand s-caret"></i>
        </div>
        <button class="btn-logout-sm" id="sidebar-logout">
          <i class="bi bi-box-arrow-left"></i>
          Sign Out
        </button>
      </div>

    </aside>
  `;

  // ── 2. Active nav highlight ───────────────────────────────────
  const currentFile = window.location.pathname.split('/').pop() || 'dashboard.html';

  document.querySelectorAll('.nav-item').forEach(link => {
    const href = link.getAttribute('href') || '';
    const linkFile = href.split('/').pop();
    if (linkFile === currentFile) {
      link.classList.add('active');
    }
  });

  // ── 3. User info from localStorage ───────────────────────────
  const name     = localStorage.getItem('user_name') || 'Administrator';
  const role     = localStorage.getItem('user_role') || 'Admin';
  const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  const el = id => document.getElementById(id);
  if (el('sidebar-name'))     el('sidebar-name').innerText     = name;
  if (el('sidebar-role'))     el('sidebar-role').innerText     = role;
  if (el('sidebar-initials')) el('sidebar-initials').innerText = initials;

  // ── 4. Logout ─────────────────────────────────────────────────
  el('sidebar-logout')?.addEventListener('click', () => {
    localStorage.removeItem('animua_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_name');
    window.location.href = '/pages/management/admin-login.html';
  });

  // ── 5. Nav item ripple effect on click ────────────────────────
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function (e) {
      // Remove existing ripple
      const old = this.querySelector('.nav-ripple');
      if (old) old.remove();

      const ripple = document.createElement('span');
      ripple.classList.add('nav-ripple');

      const rect = this.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      ripple.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        left: ${e.clientX - rect.left - size / 2}px;
        top: ${e.clientY - rect.top - size / 2}px;
      `;
      this.appendChild(ripple);

      // Remove after animation
      ripple.addEventListener('animationend', () => ripple.remove());
    });
  });

});