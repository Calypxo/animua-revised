import {
  clearUserSession,
  getUserName,
  getUserRole,
} from "../../utils/storage.js";

import {
  canAccessModule,
  normalizeRole,
} from "../../auth/permissions.js";

import Swal from "sweetalert2";

export function loadSidebar() {
  const container = document.getElementById("sidebar-container");

  if (!container) {
    return;
  }

  const name = getUserName() || "ANIMUA User";
  const storedRole = getUserRole();
  const role = normalizeRole(storedRole);

  if (!role) {
    clearUserSession();
    window.location.replace("/pages/admin-login.html");
    return;
  }

  const initials = getInitials(name);

  container.innerHTML = `
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

        ${renderMainSection(role)}

        ${renderAnimalManagementSection(role)}

        ${renderAdoptionSection(role)}

        ${renderCommunitySection(role)}

        ${renderLogisticsSection(role)}

      </nav>

      <!-- Footer -->
      <div class="sidebar-footer">
        <div class="user-card">

          <div class="avatar-circle" title="${escapeHtml(name)}">
            ${initials}
          </div>

          <div class="u-meta">
            <div class="u-name">${escapeHtml(name)}</div>
            <div class="u-role">${escapeHtml(role)}</div>
          </div>

        </div>

        <a
          href="/pages/accountSettings.html"
          class="account-settings-btn"
          id="sidebar-account-settings"
        >
          <i class="bi bi-gear"></i>
          <span>Account Settings</span>
        </a>

        <button
          id="sidebar-logout"
          class="logout-btn"
          type="button"
        >
          <i class="bi bi-box-arrow-left"></i>
          <span>Sign Out</span>
        </button>
      </div>

    </aside>
  `;

  removeEmptySections();
  setActiveNav();
  setupResponsiveLogic();
  setupLogout();
}

/* =========================================================
   SIDEBAR SECTIONS
========================================================= */

function renderMainSection(role) {
  const links = [
    renderNavItem({
      allowed: canAccessModule(role, "dashboard"),
      href: "/pages/dashboard.html",
      icon: "bi-grid-1x2",
      label: "Dashboard",
    }),

    renderNavItem({
      allowed: canAccessModule(role, "users"),
      href: "/pages/userManagement.html",
      icon: "bi-people",
      label: "User Management",
    }),
  ].join("");

  return renderSection("Main", links);
}

function renderAnimalManagementSection(role) {
  const links = [
    renderNavItem({
      allowed: canAccessModule(role, "intake"),
      href: "/pages/intakeList.html",
      icon: "bi-box-arrow-in-right",
      label: "Animal Intake",
    }),

    renderNavItem({
      allowed: canAccessModule(role, "animals"),
      href: "/pages/animalProfiling.html",
      icon: "bi-card-list",
      label: "Animal Profiling",
    }),
  ].join("");

  return renderSection("Animal Management", links);
}

function renderAdoptionSection(role) {
  const links = [
    renderNavItem({
      allowed: canAccessModule(role, "surrender"),
      href: "/pages/surrenders.html",
      icon: "bi-file-earmark-text",
      label: "Surrender Requests",
    }),

    renderNavItem({
      allowed: canAccessModule(role, "adoption"),
      href: "/pages/adoptionApplications.html",
      icon: "bi-person-check",
      label: "Adoption Apps",
    }),

  ].join("");

  return renderSection("Adoption & Matching", links);
}

function renderCommunitySection(role) {
  const links = [
    renderNavItem({
      allowed: canAccessModule(role, "announcements"),
      href: "/pages/announcements.html",
      icon: "bi-megaphone",
      label: "Announcements",
    }),
  ].join("");

  return renderSection("Community", links);
}

function renderLogisticsSection(role) {
  const links = [
    renderNavItem({
      allowed: canAccessModule(role, "inventory"),
      href: "/pages/inventory.html",
      icon: "bi-box-seam",
      label: "Inventory",
    }),

    renderNavItem({
      allowed: canAccessModule(role, "reports"),
      href: "/pages/reports.html",
      icon: "bi-bar-chart",
      label: "Reports",
    }),

    renderNavItem({
      allowed: canAccessModule(role, "audit"),
      href: "/pages/auditTrail.html",
      icon: "bi-journal-text",
      label: "Audit Trail",
    }),

    renderNavItem({
      allowed: canAccessModule(role, "archive"),
      href: "/pages/archivedRecords.html",
      icon: "bi-archive",
      label: "Archived Records",
    }),
  ].join("");

  return renderSection("Logistics", links);
}

/* =========================================================
   SIDEBAR RENDERING HELPERS
========================================================= */

function renderSection(label, links) {
  if (!links.trim()) {
    return "";
  }

  return `
    <div class="nav-divider"></div>

    <div class="nav-section">
      <div class="nav-label">${label}</div>
      ${links}
    </div>
  `;
}

function renderNavItem({
  allowed,
  href,
  icon,
  label,
}) {
  if (!allowed) {
    return "";
  }

  return `
    <a href="${href}" class="nav-item">
      <i class="bi ${icon}"></i>
      <span class="nav-text">${label}</span>
    </a>
  `;
}

function getInitials(name) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/*
 * This is mostly a safeguard in case a section renders without links.
 */
function removeEmptySections() {
  document.querySelectorAll(".nav-section").forEach((section) => {
    const links = section.querySelectorAll(".nav-item");

    if (links.length === 0) {
      const previousElement = section.previousElementSibling;

      if (previousElement?.classList.contains("nav-divider")) {
        previousElement.remove();
      }

      section.remove();
    }
  });
}

/* =========================================================
   ACTIVE NAVIGATION
========================================================= */

function setActiveNav() {
  const currentPath = normalizePath(window.location.pathname);

  document.querySelectorAll(".nav-item").forEach((link) => {
    const href = link.getAttribute("href");

    if (!href) {
      return;
    }

    const normalizedHref = normalizePath(href);

    if (
      currentPath === normalizedHref ||
      currentPath.endsWith(normalizedHref)
    ) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
  });

  const accountLink = document.getElementById("sidebar-account-settings");
  if (
    accountLink &&
    currentPath === normalizePath(accountLink.getAttribute("href"))
  ) {
    accountLink.classList.add("active");
    accountLink.setAttribute("aria-current", "page");
  }
}

function normalizePath(path) {
  if (!path) {
    return "/";
  }

  return path
    .split("?")[0]
    .split("#")[0]
    .replace(/\/+$/, "");
}

/* =========================================================
   RESPONSIVE SIDEBAR
========================================================= */

function setupResponsiveLogic() {
  const toggle = document.getElementById("sidebarToggle");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  const container = document.getElementById("sidebar-container");

  if (!toggle || !sidebar) {
    return;
  }

  toggle.addEventListener("click", () => {
    if (window.innerWidth <= 768) {
      toggleMobileSidebar(
        sidebar,
        overlay,
        toggle
      );
    } else {
      toggleDesktopSidebar(
        sidebar,
        container,
        toggle
      );
    }
  });

  overlay?.addEventListener("click", () => {
    closeMobileSidebar(
      sidebar,
      overlay,
      toggle
    );
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      sidebar.classList.contains("mobile-show")
    ) {
      closeMobileSidebar(
        sidebar,
        overlay,
        toggle
      );
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 768) {
      sidebar.classList.remove("mobile-show");
      overlay?.classList.remove("active");
    }
  });
}

function toggleMobileSidebar(
  sidebar,
  overlay,
  toggle
) {
  const isOpen = sidebar.classList.toggle("mobile-show");

  overlay?.classList.toggle("active", isOpen);
  toggle.setAttribute("aria-expanded", String(isOpen));
}

function closeMobileSidebar(
  sidebar,
  overlay,
  toggle
) {
  sidebar.classList.remove("mobile-show");
  overlay?.classList.remove("active");
  toggle.setAttribute("aria-expanded", "false");
}

function toggleDesktopSidebar(
  sidebar,
  container,
  toggle
) {
  const isCollapsed = sidebar.classList.toggle("collapsed");

  if (container) {
    container.style.width = isCollapsed
      ? "64px"
      : "";

    container.style.minWidth = isCollapsed
      ? "64px"
      : "";
  }

  toggle.setAttribute(
    "aria-expanded",
    String(!isCollapsed)
  );
}

/* =========================================================
   LOGOUT
========================================================= */

function setupLogout() {
  const logoutButton = document.getElementById("sidebar-logout");

  if (!logoutButton) {
    return;
  }

  logoutButton.addEventListener(
    "click",
    showLogoutConfirmation
  );
}

function showLogoutConfirmation() {
  Swal.fire({
    title: "Sign out?",
    text: "You'll be returned to the login screen.",
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: "#6f191c",
    cancelButtonColor: "#ede9e2",
    confirmButtonText: "Yes, sign out",
    cancelButtonText: "Cancel",
    customClass: {
      cancelButton: "swal-cancel-dark",
    },
  }).then((result) => {
    if (result.isConfirmed) {
      logoutUser();
    }
  });
}

function logoutUser() {
  clearUserSession();
  window.location.replace("/pages/admin-login.html");
}
