import "../../css/adminDashboard.css";
import "../../css/sidebarRefresh.css";
import "../../css/pageSkeleton.css";

import { initializeManagementModals } from "./managementModal.js";
import { initializeManagementConsistency } from "./managementConsistency.js";
import { clearUserSession, getUserRole } from "../../utils/storage.js";
import { canAccessModule, normalizeRole } from "../../auth/permissions.js";
import { workspaceSkeletonMarkup } from "./pageSkeleton.js";
import {
  isContactMessageCountStorageEvent,
  readContactMessageCount,
} from "./contactMessageBadge.js";

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const normalizePath = (path = "") => path.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
const EMBED_PARAM = "animuaShell";
const WORKSPACE_FRAME_NAME = "animua-management-workspace";

function isEmbeddedView() {
  if (window.self === window.top) return false;
  if (window.name === WORKSPACE_FRAME_NAME) return true;

  try {
    return window.parent.location.origin === window.location.origin;
  } catch {
    // The whole app may itself be hosted inside a cross-origin preview frame.
    return false;
  }
}

function managementUrl(value) {
  try {
    const url = new URL(value, window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/pages/")) return null;
    url.searchParams.delete(EMBED_PARAM);
    return url;
  } catch {
    return null;
  }
}

function cleanLocation(url) {
  return `${url.pathname}${url.search}${url.hash}`;
}

export function navigateManagementPage(target) {
  const url = managementUrl(target);
  if (!url) {
    window.location.assign(target);
    return;
  }

  if (isEmbeddedView()) {
    window.parent.postMessage({ type: "animua:navigate", href: cleanLocation(url) }, window.location.origin);
    return;
  }

  const shell = window.__animuaPersistentNavigation;
  if (shell?.navigate) {
    shell.navigate(cleanLocation(url));
    return;
  }

  window.location.assign(cleanLocation(url));
}

function link({ allowed = true, href, icon, label, badge = "" }) {
  if (!allowed) return "";
  return `
    <a class="nav-item" href="${href}" title="${escapeHtml(label)}">
      <span class="nav-icon"><i class="bi ${icon}" aria-hidden="true"></i></span>
      <span class="nav-text">${escapeHtml(label)}</span>
      ${badge ? `<span class="nav-item-badge" data-nav-badge="${escapeHtml(badge)}" hidden>0</span>` : ""}
    </a>`;
}

function updateContactMessageBadge(sidebar, value = readContactMessageCount()) {
  const badge = sidebar?.querySelector('[data-nav-badge="contact"]');
  if (!badge) return;
  const count = Math.max(0, Number(value || 0));
  badge.textContent = count > 99 ? "99+" : String(count);
  badge.hidden = value == null || count === 0;
  badge.setAttribute(
    "aria-label",
    `${count} new contact message${count === 1 ? "" : "s"}`
  );
}

function bindContactMessageBadge(container, sidebar) {
  updateContactMessageBadge(sidebar);
  if (container.dataset.contactBadgeBound === "true") return;
  container.dataset.contactBadgeBound = "true";

  window.addEventListener("animua:contact-count", (event) => {
    updateContactMessageBadge(sidebar, event.detail?.count);
  });
  window.addEventListener("storage", (event) => {
    if (isContactMessageCountStorageEvent(event)) {
      updateContactMessageBadge(sidebar);
    }
  });
}

function group({ id, icon, label, items }) {
  const visibleItems = items.filter(Boolean);
  if (!visibleItems.length) return "";
  return `
    <div class="nav-group" data-nav-group>
      <button class="nav-group-toggle" type="button" aria-expanded="false" aria-controls="${id}">
        <span class="nav-icon"><i class="bi ${icon}" aria-hidden="true"></i></span>
        <span class="nav-text">${escapeHtml(label)}</span>
        <span class="nav-group-indicator" aria-hidden="true">
          <i class="bi bi-plus-lg nav-plus"></i>
          <i class="bi bi-dash-lg nav-minus"></i>
        </span>
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
      ${link({ allowed: canAccessModule(role, "contact"), href: "/pages/contactMessages.html", icon: "bi-envelope-paper", label: "Contact Messages", badge: "contact" })}
      ${link({ allowed: canAccessModule(role, "compatibility"), href: "/pages/compatibilityQuiz.html", icon: "bi-stars", label: "Compatibility Quiz" })}
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
    </section>`;
}

function setActiveNavigation(sidebar, pathname = window.location.pathname) {
  const current = normalizePath(pathname);
  sidebar.querySelectorAll("a.nav-item").forEach((item) => {
    const active = current === normalizePath(item.getAttribute("href"));
    item.classList.toggle("active", active);
    item.removeAttribute("aria-current");
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
  const toggleSidebar = () => {
    if (window.innerWidth <= 768) {
      const open = sidebar.classList.toggle("mobile-show");
      overlay.classList.toggle("active", open);
      toggle?.setAttribute("aria-expanded", String(open));
      return;
    }
    const collapsed = sidebar.classList.toggle("collapsed");
    container.classList.toggle("sidebar-collapsed", collapsed);
    toggle?.setAttribute("aria-expanded", String(!collapsed));
  };

  toggle?.addEventListener("click", toggleSidebar);
  container.__animuaSidebarController = { toggle: toggleSidebar, closeMobile };

  overlay.addEventListener("click", closeMobile);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMobile();
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 768) closeMobile();
  });
}

function setupEmbeddedBridge(container) {
  document.documentElement.classList.add("animua-embedded-page");
  container.hidden = true;
  container.setAttribute("aria-hidden", "true");

  const send = (message) => window.parent.postMessage(message, window.location.origin);
  const toggle = document.getElementById("sidebarToggle");
  toggle?.addEventListener("click", (event) => {
    event.preventDefault();
    send({ type: "animua:toggle-sidebar" });
  });

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest("a[href]");
    if (!anchor || anchor.hasAttribute("download") || anchor.target === "_blank") return;
    const url = managementUrl(anchor.href);
    if (!url || (normalizePath(url.pathname) === normalizePath(window.location.pathname) && url.hash)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    send({ type: "animua:navigate", href: cleanLocation(url) });
  }, true);

  const notifyReady = () => send({ type: "animua:page-ready", path: cleanLocation(new URL(window.location.href)) });
  if (!document.body.classList.contains("loading")) {
    notifyReady();
  } else {
    const observer = new MutationObserver(() => {
      if (document.body.classList.contains("loading")) return;
      observer.disconnect();
      notifyReady();
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }
}

function setupPersistentNavigation(container, sidebar) {
  const existing = window.__animuaPersistentNavigation;
  if (existing) {
    existing.container = container;
    existing.sidebar = sidebar;
    setActiveNavigation(sidebar, window.location.pathname);
    return;
  }

  const stage = document.querySelector(".shell > .stage");
  if (!stage) return;

  const state = {
    container,
    sidebar,
    stage,
    frame: null,
    loader: null,
    fallbackTimer: null,
    navigate: null,
  };

  const markReady = () => {
    window.clearTimeout(state.fallbackTimer);
    state.stage.classList.remove("is-navigating");
    state.stage.setAttribute("aria-busy", "false");
    state.frame?.classList.add("is-ready");
    try {
      if (state.frame?.contentDocument?.title) document.title = state.frame.contentDocument.title;
    } catch {
      // The management pages are same-origin; keep the existing title if access is unavailable.
    }
  };

  const ensureFrame = () => {
    if (state.frame) return state.frame;

    const frame = document.createElement("iframe");
    frame.className = "persistent-page-frame";
    frame.name = WORKSPACE_FRAME_NAME;
    frame.title = "ANIMUA management workspace";
    frame.setAttribute("aria-label", "ANIMUA management workspace");

    const loader = document.createElement("div");
    loader.className = "persistent-page-loader";
    loader.setAttribute("role", "status");
    loader.setAttribute("aria-live", "polite");
    loader.setAttribute("aria-label", "Loading ANIMUA workspace");
    loader.innerHTML = workspaceSkeletonMarkup();

    frame.addEventListener("load", () => {
      try {
        if (frame.contentWindow?.location.pathname.endsWith("/admin-login.html")) {
          window.location.replace("/pages/admin-login.html");
          return;
        }
      } catch {
        // Same-origin management routes normally expose their path here.
      }
      window.clearTimeout(state.fallbackTimer);
      state.fallbackTimer = window.setTimeout(markReady, 5000);
    });

    state.frame = frame;
    state.loader = loader;
    state.stage.classList.add("persistent-shell-stage");
    state.stage.replaceChildren(frame, loader);
    return frame;
  };

  state.navigate = (target, { historyMode = "push" } = {}) => {
    const url = managementUrl(target);
    if (!url) {
      window.location.assign(target);
      return;
    }

    const destination = cleanLocation(url);
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (destination === current && !state.frame) return;
    if (destination === current && state.frame?.dataset.destination === destination) return;

    if (historyMode === "push") history.pushState({ ...(history.state || {}), animuaPath: destination }, "", destination);
    else if (historyMode === "replace") history.replaceState({ ...(history.state || {}), animuaPath: destination }, "", destination);

    setActiveNavigation(state.sidebar, url.pathname);
    state.container.__animuaSidebarController?.closeMobile();

    const embeddedUrl = new URL(url.href);
    embeddedUrl.searchParams.set(EMBED_PARAM, "1");
    const frame = ensureFrame();
    frame.dataset.destination = destination;
    frame.classList.remove("is-ready");
    state.stage.classList.add("is-navigating");
    state.stage.setAttribute("aria-busy", "true");
    frame.src = cleanLocation(embeddedUrl);
  };

  history.replaceState({ ...(history.state || {}), animuaPath: `${window.location.pathname}${window.location.search}${window.location.hash}` }, "", window.location.href);

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest("a[href]");
    if (!anchor || anchor.hasAttribute("download") || anchor.target === "_blank") return;
    const url = managementUrl(anchor.href);
    if (!url || (normalizePath(url.pathname) === normalizePath(window.location.pathname) && url.hash)) return;
    event.preventDefault();
    state.navigate(cleanLocation(url));
  }, true);

  window.addEventListener("popstate", () => state.navigate(window.location.href, { historyMode: "none" }));
  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin || event.source !== state.frame?.contentWindow) return;
    if (event.data?.type === "animua:navigate") state.navigate(event.data.href);
    if (event.data?.type === "animua:toggle-sidebar") state.container.__animuaSidebarController?.toggle();
    if (event.data?.type === "animua:page-ready") markReady();
    if (event.data?.type === "animua:contact-count") {
      updateContactMessageBadge(state.sidebar, event.data.count);
    }
  });

  window.__animuaPersistentNavigation = state;
}

export function loadSidebar() {
  const container = document.getElementById("sidebar-container");
  if (!container) return;

  initializeManagementModals();
  initializeManagementConsistency();

  const role = normalizeRole(getUserRole());
  if (!role) {
    clearUserSession();
    window.location.replace("/pages/admin-login.html");
    return;
  }

  if (isEmbeddedView()) {
    setupEmbeddedBridge(container);
    return;
  }

  container.innerHTML = `
    <div class="sidebar-overlay" id="sidebar-overlay"></div>
    <aside class="sidebar" id="sidebar" aria-label="Administration sidebar">
      <header class="sidebar-header">
        <a class="sidebar-brand" href="/pages/dashboard.html" aria-label="ANIMUA dashboard">
          <span class="brand-mark">
            <img class="brand-logo" src="/images/animua_logo1.svg" alt="" aria-hidden="true">
          </span>
          <span class="brand-copy"><strong>NIMUA</strong></span>
        </a>
      </header>
      <nav class="sidebar-nav" aria-label="Management navigation">
        ${mainNavigation(role)}
        ${systemNavigation(role)}
      </nav>
    </aside>`;

  const sidebar = container.querySelector("#sidebar");
  const overlay = container.querySelector("#sidebar-overlay");
  setActiveNavigation(sidebar);
  bindContactMessageBadge(container, sidebar);
  bindSidebar(container, sidebar, overlay);
  setupPersistentNavigation(container, sidebar);
}
