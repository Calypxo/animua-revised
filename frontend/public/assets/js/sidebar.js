function initSidebar() {
  const container = document.getElementById('sidebar-container');
  if (!container) {
    console.warn('[sidebar.js] #sidebar-container not found.');
    return;
  }

  const name     = localStorage.getItem('user_name') || 'Admin User';
  const role     = localStorage.getItem('user_role') || 'Administrator';
  const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  container.innerHTML = `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-logo">
        <a href="/pages/management/dashboard.html" class="logo-mark">
          <div class="logo-icon"><i class="bi bi-heart-fill"></i></div>
          <span class="logo-text">ANIMUA</span>
        </a>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-label">Main</div>
        <a href="/pages/management/dashboard.html" class="nav-item" data-tooltip="Dashboard">
          <i class="bi bi-grid-1x2-fill"></i>
          <span class="nav-text">Dashboard</span>
        </a>
        <a href="/pages/management/animalRecords.html" class="nav-item" data-tooltip="Animal Records">
          <i class="bi bi-collection-fill"></i>
          <span class="nav-text">Animal Records</span>
          <span class="nav-badge">12</span>
        </a>
        <a href="/pages/management/surrenders.html" class="nav-item" data-tooltip="Surrenders">
          <i class="bi bi-house-door-fill"></i>
          <span class="nav-text">Surrenders</span>
        </a>
        <a href="/pages/management/adoptions.html" class="nav-item" data-tooltip="Adoptions">
          <i class="bi bi-heart-arrow"></i>
          <span class="nav-text">Adoptions</span>
          <span class="nav-badge">5</span>
        </a>
        <div class="nav-label" style="margin-top:8px;">Operations</div>
        <a href="/pages/management/inventory.html" class="nav-item" data-tooltip="Inventory">
          <i class="bi bi-box-seam-fill"></i>
          <span class="nav-text">Inventory</span>
        </a>
        <a href="/pages/management/reports.html" class="nav-item" data-tooltip="Reports">
          <i class="bi bi-bar-chart-fill"></i>
          <span class="nav-text">Reports</span>
        </a>
        <a href="/pages/management/petCompatibility.html" class="nav-item" data-tooltip="Matching AI">
          <i class="bi bi-cpu-fill"></i>
          <span class="nav-text">Matching AI</span>
        </a>
        <div class="nav-label" style="margin-top:8px;">System</div>
        <a href="/pages/management/team.html" class="nav-item" data-tooltip="Team">
          <i class="bi bi-people-fill"></i>
          <span class="nav-text">Team</span>
        </a>
        <a href="/pages/management/schedule.html" class="nav-item" data-tooltip="Schedule">
          <i class="bi bi-calendar3"></i>
          <span class="nav-text">Schedule</span>
        </a>
        <a href="/pages/management/settings.html" class="nav-item" data-tooltip="Settings">
          <i class="bi bi-gear-fill"></i>
          <span class="nav-text">Settings</span>
        </a>
        <a href="/pages/management/help.html" class="nav-item" data-tooltip="Help">
          <i class="bi bi-question-circle-fill"></i>
          <span class="nav-text">Help</span>
        </a>
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-user">
          <div class="s-avatar" id="sidebar-initials">${initials}</div>
          <div class="s-user-info" style="flex:1;min-width:0;">
            <div class="s-name" id="sidebar-name">${name}</div>
            <div class="s-role" id="sidebar-role">${role}</div>
          </div>
          <i class="bi bi-chevron-expand s-caret"></i>
        </div>
        <button class="btn-logout-sm" id="sidebar-logout">
          <i class="bi bi-box-arrow-left"></i>
          <span class="nav-text">Sign Out</span>
        </button>
      </div>
    </aside>
  `;

  // Active nav highlight
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-item').forEach(link => {
    const href = link.getAttribute('href');
    if (href && currentPath.includes(href)) {
      link.classList.add('active');
    }
  });

  // Sidebar toggle
  const toggleBtn = document.getElementById('sidebarToggle');
  const sidebar   = document.getElementById('sidebar');

  if (toggleBtn && sidebar) {
    const isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
    if (isCollapsed) {
      sidebar.classList.add('collapsed');
      toggleBtn.classList.add('is-collapsed');
    }
    toggleBtn.addEventListener('click', () => {
      const collapsed = sidebar.classList.toggle('collapsed');
      toggleBtn.classList.toggle('is-collapsed', collapsed);
      localStorage.setItem('sidebar_collapsed', collapsed);
    });
  }

  // Logout
  const logoutBtn = document.getElementById('sidebar-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (typeof Swal !== 'undefined') {
        await Swal.fire({
          icon:              'info',
          title:             'Logged Out',
          text:              'Your session has been securely terminated.',
          timer:             1500,
          showConfirmButton: false
        });
      }
      localStorage.clear();
      window.location.href = "/pages/management/admin-login.html";
    });
  }
}

// Run immediately if DOM is ready, otherwise wait for it
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSidebar);
} else {
  initSidebar();
}