import "../css/management/admin-dashboard.css";
import "../css/management/sidebar.css";

import "../components/global/welcome.js";
import { protectManagementPage } from "../auth/authGuard.js";
import { renderTopbarUser } from "../components/management/topbarUser.js";
import { loadSidebar } from "../components/management/sidebarLoader.js";
import { API_BASE_URL } from "../utils/api.js";

import Swal from "sweetalert2";
window.Swal = Swal;

async function initDashboard() {
  try {
    await protectManagementPage();
    loadSidebar();
    renderTopbarUser();
    await loadDashboardStats();

    document.body.style.display = "block";
  } catch (error) {
    console.error("Dashboard init failed:", error);
  }
}

async function loadDashboardStats() {
  try {
    const token = localStorage.getItem("animua_token");

    const res = await fetch(`${API_BASE_URL}/dashboard/stats`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error("Failed to load dashboard stats");
    }

    const stats = await res.json();

    const totalPetsEl = document.getElementById("totalPetsCount");
    const intakeEl = document.getElementById("intakeCount");
    const quarantineEl = document.getElementById("quarantineCount");
    const readyEl = document.getElementById("readyCount");

    if (totalPetsEl) totalPetsEl.textContent = stats.totalPets;
    if (intakeEl) intakeEl.textContent = stats.intake;
    if (quarantineEl) quarantineEl.textContent = stats.quarantine;
    if (readyEl) readyEl.textContent = stats.readyForAdoption;

  } catch (error) {
    console.error("Dashboard stats error:", error);
  }
}

window.addEventListener("DOMContentLoaded", initDashboard);