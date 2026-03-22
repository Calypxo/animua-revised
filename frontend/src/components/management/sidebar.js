// src/components/management/sidebar.js

async function loadSidebar() {
  const container = document.getElementById('sidebar-container');
  if (!container) return;

  try {
    // 1. Fetch and inject the sidebar HTML
    const res = await fetch('/src/components/management/sidebar.html');
    if (!res.ok) throw new Error("Sidebar HTML not found");
    
    const html = await res.text();
    container.innerHTML = html;

    // --- CRITICAL: All code below must stay INSIDE this function ---
    // This ensures the elements exist before we try to touch them.

    // 2. Active nav item highlight
    const currentPath = window.location.pathname;
    document.querySelectorAll('.nav-link, .nav-item').forEach(link => {
      const href = link.getAttribute('href');
      if (href && currentPath.includes(href)) {
        link.classList.add('active');
      }
    });

    // 3. Populate user info from localStorage
    const name = localStorage.getItem('user_name') || 'Administrator';
    const role = localStorage.getItem('user_role') || 'Staff';
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    // Selectors check (Prevents "cannot set property of null" errors)
    const nameEl = document.getElementById('sidebar-name');
    const roleEl = document.getElementById('sidebar-role');
    const initEl = document.getElementById('sidebar-initials');

    if (nameEl) nameEl.innerText = name;
    if (roleEl) roleEl.innerText = role;
    if (initEl) initEl.innerText = initials;

    // 4. Logout Logic
    const logoutBtn = document.getElementById('sidebar-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // Clear all session data
        localStorage.removeItem('animua_token');
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_name');
        localStorage.removeItem('user_email');
        localStorage.removeItem('show_welcome_toast');
        
        window.location.replace('/pages/management/admin-login.html');
      });
    }

    // 5. Collapsible sidebar logic
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebarToggle');

    if (sidebar && localStorage.getItem('sidebar_collapsed') === 'true') {
      sidebar.classList.add('collapsed');
    }

    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebar_collapsed', sidebar.classList.contains('collapsed'));
      });
    }

  } catch (error) {
    console.error("Error loading sidebar:", error);
  }
}

// Initialize
loadSidebar();