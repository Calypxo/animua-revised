import "../../css/sidebarRefresh.css";

import Swal from "sweetalert2";
import { clearUserSession, getUserName, getUserRole } from "../../utils/storage.js";
import { canAccessModule, normalizeRole } from "../../auth/permissions.js";

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const normalizePath = (path = "") => path.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";

function initials(name) {
  return String(name || "ANIMUA User")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function link({ allowed = true, href, icon, label }) {
  if (!allowed) return "";
  return `
    <a class="nav-item" href="${href}" title="${escapeHtml(label)}">
      <span class="nav-icon"><i class="bi ${icon}" aria-hidden="true"></i></span>
      <span class="nav-text">${escapeHtml(label)}</span>
    </a>`;
}

function group({ id, icon, label, items }) {
  const visibleItems = items.filter(Boolean);
  if (!visibleItems.length) return "";
  return `
    <div class="nav-group" data-nav-group>
      <button class="nav-group-toggle" type="button" aria-expanded="false" aria-controls="${id}">
        <span class="nav-icon"><i class="bi ${icon}" aria-hidden="true"></i></span>
        <span class="nav-text">${escapeHtml(label)}</span>
        <i class="bi bi-chevron-down nav-chevron" aria-hidden="true"></i>
      </button>
      <div class="nav-submenu" id="${id}">
        ${visibleItems.join("")}
      </div>
    </div>`;
}

function mainNavigation(role) {
  const animalGroup = group({
    id: "animal-management-menu",
    icon: "bi-heart-pulse",
    label: "Animal Management",
    items: [
      link({ allowed: canAccessModule(role, "intake"), href: "/pages/intakeList.html", icon: "bi-box-arrow-in-down", label: "Animal Intake" }),
      link({ allowed: canAccessModule(role, "animals"), href: "/pages/animalProfiling.html", icon: "bi-person-vcard", label: "Animal Profiling" }),
      link({ allowed: canAccessModule(role, "surrender"), href: "/pages/surrenders.html", icon: "bi-file-earmark-text", label: "Surrender Requests" }),
      link({ allowed: canAccessModule(role, "adoption"), href: "/pages/adoptionApplications.html", icon: "bi-house-heart", label: "Adoption Applications" }),
    ],
  });

  const operationsGroup = group({
    id: "operations-menu",
    icon: "bi-boxes",
    label: "Operations",
    items: [
      link({ allowed: canAccessModule(role, "inventory"), href: "/pages/inventory.html", icon: "bi-box-seam", label: "Inventory" }),
      link({ allowed: canAccessModule(role, "reports"), href: "/pages/reports.html", icon: "bi-bar-chart", label: "Reports" }),
    ],
  });

  return `
    <section class="nav-section" aria-labelledby="main-nav-label">
      <p class="nav-label" id="main-nav-label">Main</p>
      ${link({ allowed: canAccessModule(role, "dashboard"), href: "/pages/dashboard.html", icon: "bi-grid-1x2", label: "Dashboard" })}
      ${animalGroup}
      ${link({ allowed: canAccessModule(role, "announcements"), href: "/pages/announcements.html", icon: "bi-megaphone", label: "Announcements" })}
      ${operationsGroup}
    </section>`;
}

function systemNavigation(role) {
  return `
    <section class="nav-section nav-system" aria-labelledby="system-nav-label">
      <p class="nav-label" id="system-nav-label">System</p>
      ${link({ allowed: canAccessModule(role, "users"), href: "/pages/userManagement.html", icon: "bi-people", label: "User Management" })}
      ${link({ allowed: canAccessModule(role, "audit"), href: "/pages/auditTrail.html", icon: "bi-journal-check", label: "Audit Trail" })}
      ${link({ allowed: canAccessModule(role, "archive"), href: "/pages/archivedRecords.html", icon: "bi-archive", label: "Archived Records" })}
      ${link({ href: "/pages/accountSettings.html", icon: "bi-gear", label: "Account Settings" })}
      <button class="nav-item sidebar-signout" id="sidebar-logout" type="button" title="Sign Out">
        <span class="nav-icon"><i class="bi bi-box-arrow-left" aria-hidden="true"></i></span>
        <span class="nav-text">Sign Out</span>
      </button>
    </section>`;
}

function setActiveNavigation(sidebar) {
  const current = normalizePath(window.location.pathname);
  sidebar.querySelectorAll("a.nav-item").forEach((item) => {
    const active = current === normalizePath(item.getAttribute("href"));
    item.classList.toggle("active", active);
    if (active) {
      item.setAttribute("aria-current", "page");
      const group = item.closest("[data-nav-group]");
      if (group) setGroupExpanded(group, true);
    }
  });
}

function setGroupExpanded(group, expanded) {
  group.classList.toggle("expanded", expanded);
  group.querySelector(":scope > .nav-group-toggle")?.setAttribute("aria-expanded", String(expanded));
}

function bindSidebar(container, sidebar, overlay) {
  sidebar.querySelectorAll(".nav-group-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const group = button.closest("[data-nav-group]");
      setGroupExpanded(group, !group.classList.contains("expanded"));
    });
  });

  const toggle = document.getElementById("sidebarToggle");
  const closeMobile = () => {
    sidebar.classList.remove("mobile-show");
    overlay.classList.remove("active");
    toggle?.setAttribute("aria-expanded", "false");
  };

  toggle?.setAttribute("aria-controls", "sidebar");
  toggle?.addEventListener("click", () => {
    if (window.innerWidth <= 768) {
      const open = sidebar.classList.toggle("mobile-show");
      overlay.classList.toggle("active", open);
      toggle.setAttribute("aria-expanded", String(open));
      return;
    }
    const collapsed = sidebar.classList.toggle("collapsed");
    container.classList.toggle("sidebar-collapsed", collapsed);
    toggle.setAttribute("aria-expanded", String(!collapsed));
  });

  overlay.addEventListener("click", closeMobile);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMobile();
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 768) closeMobile();
  });

  sidebar.querySelector("#sidebar-logout")?.addEventListener("click", async () => {
    const result = await Swal.fire({
      title: "Sign out?",
      text: "You'll be returned to the login screen.",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#ef1725",
      cancelButtonColor: "#746963",
      confirmButtonText: "Yes, sign out",
    });
    if (result.isConfirmed) {
      clearUserSession();
      window.location.replace("/pages/admin-login.html");
    }
  });
}

export function loadSidebar() {
  const container = document.getElementById("sidebar-container");
  if (!container) return;

  const name = getUserName() || "ANIMUA User";
  const role = normalizeRole(getUserRole());
  if (!role) {
    clearUserSession();
    window.location.replace("/pages/admin-login.html");
    return;
  }

  container.innerHTML = `
    <div class="sidebar-overlay" id="sidebar-overlay"></div>
    <aside class="sidebar" id="sidebar" aria-label="Administration sidebar">
      <a class="sidebar-brand" href="/pages/dashboard.html" aria-label="ANIMUA dashboard">
        <span class="brand-mark"><i class="bi bi-heart-pulse-fill" aria-hidden="true"></i></span>
        <span class="brand-copy"><strong>ANIMUA</strong><small>Admin workspace</small></span>
      </a>
      <nav class="sidebar-nav" aria-label="Management navigation">
        ${mainNavigation(role)}
        ${systemNavigation(role)}
      </nav>
      <a class="sidebar-account" href="/pages/accountSettings.html" title="Open account settings">
        <span class="avatar-circle">${initials(name)}</span>
        <span class="u-meta"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(role)}</small></span>
        <i class="bi bi-gear account-gear" aria-hidden="true"></i>
      </a>
    </aside>`;

  const sidebar = container.querySelector("#sidebar");
  const overlay = container.querySelector("#sidebar-overlay");
  setActiveNavigation(sidebar);
  bindSidebar(container, sidebar, overlay);
}

