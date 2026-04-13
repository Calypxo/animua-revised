import { clearUserSession, getUserName, getUserRole } from "../../utils/storage.js";

export function loadSidebar() {
  const container = document.getElementById("sidebar-container");
  if (!container) return;

  const name     = getUserName() || "Admin User";
  const role     = getUserRole() || "Administrator";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  container.innerHTML = `
    <!-- Mobile hamburger (hidden on desktop via CSS) -->
    <button class="mobile-nav-toggle" id="mobile-nav-toggle" aria-label="Open menu">
      <i class="bi bi-list"></i>
    </button>

    <!-- Dim overlay for mobile -->
    <div class="sidebar-overlay" id="sidebar-overlay"></div>

    <aside class="sidebar" id="sidebar">

      <!-- Logo -->
      <div class="sidebar-logo">
        <div class="logo-icon-box">
          <i class="bi bi-heart-fill logo-icon"></i>
        </div>
        <span class="logo-text">ANIMUA</span>
      </div>

      <!-- Navigation -->
      <nav class="sidebar-nav" aria-label="Main navigation">

        <div class="nav-section">
          <div class="nav-label">Main</div>
          <a href="/pages/dashboard.html" class="nav-item">
            <i class="bi bi-grid-1x2"></i>
            <span class="nav-text">Dashboard</span>
          </a>
          <a href="/pages/userManagement.html" class="nav-item">
            <i class="bi bi-people"></i>
            <span class="nav-text">User Management</span>
          </a>
        </div>

        <div class="nav-divider"></div>

        <div class="nav-section">
          <div class="nav-label">Animal Management</div>
          <a href="/pages/intakeList.html" class="nav-item">
            <i class="bi bi-box-arrow-in-right"></i>
            <span class="nav-text">Animal Intake</span>
          </a>
          <a href="/pages/animalProfiling.html" class="nav-item">
            <i class="bi bi-card-list"></i>
            <span class="nav-text">Animal Profiling</span>
          </a>
          
        </div>

        <div class="nav-divider"></div>

        <div class="nav-section">
          <div class="nav-label">Adoption & Matching</div>
          <a href="/pages/surrenders.html" class="nav-item">
            <i class="bi bi-file-earmark-text"></i>
            <span class="nav-text">Surrender Requests</span>
          </a>
          <a href="/pages/adoptionApplications.html" class="nav-item">
            <i class="bi bi-person-check"></i>
            <span class="nav-text">Adoption Apps</span>
          </a>
          <a href="/pages/postAdoption.html" class="nav-item">
            <i class="bi bi-chat-heart"></i>
            <span class="nav-text">Post-Adoption</span>
          </a>
        </div>

        <div class="nav-divider"></div>

        <div class="nav-section">
          <div class="nav-label">Logistics</div>
          <a href="/pages/inventory.html" class="nav-item">
            <i class="bi bi-box-seam"></i>
            <span class="nav-text">Inventory</span>
          </a>
          <a href="/pages/reports.html" class="nav-item">
            <i class="bi bi-bar-chart"></i>
            <span class="nav-text">Reports</span>
          </a>
          <a href="/pages/auditTrail.html" class="nav-item">
            <i class="bi bi-file-earmark-text"></i>
            <span class="nav-text">Audit Trail</span>
          </a>

          <a href="/pages/archivedRecords.html" class="nav-item">
            <i class="bi bi-file-earmark-text"></i>
            <span class="nav-text">Archived Records</span>
          </a>
        </div>

      </nav>

      <!-- Footer: user info + logout -->
      <div class="sidebar-footer">
        <div class="user-card">
          <div class="avatar-circle" title="${name}">${initials}</div>
          <div class="u-meta">
            <div class="u-name">${name}</div>
            <div class="u-role">${role}</div>
          </div>
        </div>
        <button id="sidebar-logout" class="logout-btn" type="button">
          <i class="bi bi-box-arrow-left"></i>
          <span>Sign Out</span>
        </button>
      </div>

    </aside>
  `;

  setActiveNav();
  setupResponsiveLogic();
  setupCollapseToggle();
  setupLogout();
}

/* ── Highlight current page link ───────────────────── */
function setActiveNav() {
  const currentPath = window.location.pathname;
  document.querySelectorAll(".nav-item").forEach((link) => {
    const href = link.getAttribute("href");
    if (!href) return;
    // Match exact or ends-with (handles /pages/dashboard.html vs /dashboard.html)
    if (href === currentPath || currentPath.endsWith(href)) {
      link.classList.add("active");
    }
  });
}

/* ── Mobile overlay open/close ──────────────────────── */
function setupResponsiveLogic() {
  const toggle  = document.getElementById("mobile-nav-toggle");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");

  if (!toggle || !sidebar || !overlay) return;

  toggle.onclick = () => {
    const open = sidebar.classList.toggle("mobile-show");
    overlay.classList.toggle("active", open);
    toggle.setAttribute("aria-expanded", open);
  };

  overlay.onclick = () => {
    sidebar.classList.remove("mobile-show");
    overlay.classList.remove("active");
    toggle.setAttribute("aria-expanded", "false");
  };

  // Close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sidebar.classList.contains("mobile-show")) {
      sidebar.classList.remove("mobile-show");
      overlay.classList.remove("active");
    }
  });
}

/* ── Desktop collapse toggle (via sidebarToggle btn) ── */
function setupCollapseToggle() {
  // The topbar's #sidebarToggle button triggers collapse on desktop
  const toggleBtn = document.getElementById("sidebarToggle");
  const sidebar   = document.getElementById("sidebar");
  const container = document.getElementById("sidebar-container");

  if (!toggleBtn || !sidebar || !container) return;

  // Only wire collapse on desktop (>768px)
  toggleBtn.addEventListener("click", () => {
    if (window.innerWidth <= 768) return; // mobile handled by setupResponsiveLogic

    const collapsed = sidebar.classList.toggle("collapsed");

    // Sync container width so .stage re-flows correctly
    if (collapsed) {
      container.style.width    = "64px";
      container.style.minWidth = "64px";
    } else {
      container.style.width    = "";
      container.style.minWidth = "";
    }
  });
}

/* ── Logout ─────────────────────────────────────────── */
function setupLogout() {
  const logoutBtn = document.getElementById("sidebar-logout");
  if (!logoutBtn) return;

  logoutBtn.onclick = () => {
    // Optional: Swal confirmation if Swal is available
    if (window.Swal) {
      window.Swal.fire({
        title: "Sign out?",
        text: "You'll be returned to the login screen.",
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#6f191c",
        cancelButtonColor: "#ede9e2",
        confirmButtonText: "Yes, sign out",
        cancelButtonText: "Cancel",
        customClass: { cancelButton: "swal-cancel-dark" }
      }).then((result) => {
        if (result.isConfirmed) {
          clearUserSession();
          window.location.href = "index.html";
        }
      });
    } else {
      clearUserSession();
      window.location.href = "index.html";
    }
  };
}