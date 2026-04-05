import { clearUserSession, getUserName, getUserRole } from "../../utils/storage.js";

export function loadSidebar() {
  const container = document.getElementById("sidebar-container");
  if (!container) return;

  const name = getUserName() || "Admin User";
  const role = getUserRole() || "Administrator";
  const initials = name.split(" ").map(n => n[0]).join("").toUpperCase();

  container.innerHTML = `
    <button class="mobile-nav-toggle" id="mobile-nav-toggle"><i class="bi bi-list"></i></button>
    <div class="sidebar-overlay" id="sidebar-overlay"></div>

    <aside class="sidebar" id="sidebar">
      <div class="sidebar-logo">
        <div class="logo-icon-box"><i class="bi bi-heart-fill logo-icon"></i></div>
        <span class="logo-text">ANIMUA</span>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section">
          <div class="nav-label">Main</div>
          <a href="/pages/management/dashboard.html" class="nav-item"><i class="bi bi-grid-1x2"></i><span class="nav-text">Dashboard</span></a>
          <a href="/pages/management/userManagement.html" class="nav-item"><i class="bi bi-people"></i><span class="nav-text">User Management</span></a>
        </div>

        <div class="nav-section">
          <div class="nav-label">Animal Management</div>
          <a href="/pages/management/intakeList.html" class="nav-item"><i class="bi bi-box-arrow-in-right"></i><span class="nav-text">Animal Intake</span></a>
          <a href="/pages/management/animalProfiling.html" class="nav-item"><i class="bi bi-card-list"></i><span class="nav-text">Animal Profiling</span></a>
        </div>

        <div class="nav-section">
          <div class="nav-label">Adoption & Matching</div>
          <a href="/pages/management/surrenders.html" class="nav-item"><i class="bi bi-file-earmark-text"></i><span class="nav-text">Surrender Requests</span></a>
          <a href="/pages/management/petCompatibility.html" class="nav-item"><i class="bi bi-cpu"></i><span class="nav-text">Pet Matching (AI)</span></a>
          <a href="/pages/management/adoptionApplications.html" class="nav-item"><i class="bi bi-person-check"></i><span class="nav-text">Adoption Apps</span></a>
          <a href="/pages/management/followUps.html" class="nav-item"><i class="bi bi-chat-heart"></i><span class="nav-text">Post-Adoption</span></a>
        </div>

        <div class="nav-section">
          <div class="nav-label">Logistics</div>
          <a href="/pages/management/inventory.html" class="nav-item"><i class="bi bi-box-seam"></i><span class="nav-text">Inventory</span></a>
          <a href="/pages/management/reports.html" class="nav-item"><i class="bi bi-bar-chart"></i><span class="nav-text">Reports</span></a>
          <a href="/pages/management/settings.html" class="nav-item"><i class="bi bi-gear"></i><span class="nav-text">Settings</span></a>
        </div>
      </nav>

      <div class="sidebar-footer">
        <div class="user-card">
          <div class="avatar-circle">${initials}</div>
          <div class="u-meta">
            <div class="u-name">${name}</div>
            <div class="u-role">${role}</div>
          </div>
        </div>
        <button id="sidebar-logout" class="logout-btn"><i class="bi bi-box-arrow-left"></i> <span>Sign Out</span></button>
      </div>
    </aside>
  `;

  setActiveNav();
  setupResponsiveLogic();
  setupLogout();
  setupNavigation(); // The SPA-Lite Logic
}

function setupNavigation() {
  const navLinks = document.querySelectorAll(".nav-item");
  const mainContent = document.getElementById("main-content");
  const pageTitle = document.getElementById("page-title");

  navLinks.forEach(link => {
    link.addEventListener("click", async (e) => {
      const targetUrl = link.getAttribute("href");
      if (!targetUrl || targetUrl.startsWith('#')) return;

      e.preventDefault();
      
      // Smoothly update URL
      window.history.pushState({}, "", targetUrl);

      try {
        const response = await fetch(targetUrl);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        
        // SWAP CONTENT ONLY
        const newContent = doc.getElementById("main-content").innerHTML;
        mainContent.innerHTML = newContent;
        
        // Update Title if exists in the new page
        if (doc.querySelector('h1')) {
           pageTitle.innerText = doc.querySelector('h1').innerText;
        }

        // Re-run Page Specific Logic
        // Halimbawa: if(targetUrl.includes('intake')) initIntakeModule();

      } catch (err) {
        console.warn("Routing failed, doing full reload.");
        window.location.href = targetUrl;
      }
    });
  });
}

function setupResponsiveLogic() {
  const toggle = document.getElementById('mobile-nav-toggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  if (toggle) toggle.onclick = () => {
    sidebar.classList.toggle('mobile-show');
    overlay.classList.toggle('active');
  };
  if (overlay) overlay.onclick = () => {
    sidebar.classList.remove('mobile-show');
    overlay.classList.remove('active');
  };
}

function setActiveNav() {
  const currentPath = window.location.pathname;
  document.querySelectorAll(".nav-item").forEach((link) => {
    const href = link.getAttribute("href");
    if (href && currentPath.includes(href)) link.classList.add("active");
  });
}

function setupLogout() {
  const logoutBtn = document.getElementById("sidebar-logout");
  if (logoutBtn) logoutBtn.onclick = () => {
    clearUserSession();
    window.location.href = "/pages/management/admin-login.html";
  };
}

window.addEventListener("popstate", () => window.location.reload());