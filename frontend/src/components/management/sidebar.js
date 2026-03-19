// src/components/management/sidebar.js

async function loadSidebar() {
  const container = document.getElementById('sidebar-container');
  if (!container) return;

  // Fetch and inject the sidebar HTML
  const res = await fetch('/src/components/management/sidebar.html');
  const html = await res.text();
  container.innerHTML = html;

  // ── Active nav item — highlight based on current page ──
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-item').forEach(link => {
    if (link.getAttribute('href') === currentPath) {
      link.classList.add('active');
    }
  });

  // ── Populate user info from localStorage ──
  const name     = localStorage.getItem('user_name') || 'Administrator';
  const role     = localStorage.getItem('user_role') || 'Staff';
  const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  document.getElementById('sidebar-name').innerText     = name;
  document.getElementById('sidebar-role').innerText     = role;
  document.getElementById('sidebar-initials').innerText = initials;

  // ── Logout ──
  document.getElementById('sidebar-logout').addEventListener('click', () => {
    localStorage.removeItem('animua_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_name');
    window.location.href = '/pages/management/admin-login.html';
  });

  // ── Collapsible sidebar ──
  const sidebar   = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebarToggle');

  if (localStorage.getItem('sidebar_collapsed') === 'true') {
    sidebar.classList.add('collapsed');
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      localStorage.setItem('sidebar_collapsed', sidebar.classList.contains('collapsed'));
    });
  }
}

loadSidebar();