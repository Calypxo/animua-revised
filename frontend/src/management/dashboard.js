import "../css/management/admin-dashboard.css";
import "../css/management/sidebar.css";

import "../components/global/welcome.js";
import { protectManagementPage } from "../auth/authGuard.js";
import { renderTopbarUser } from "../components/management/topbarUser.js";
import { loadSidebar } from "../components/management/sidebarLoader.js";

import Swal from "sweetalert2";
window.Swal = Swal;

async function initDashboard() {
  try {
    await protectManagementPage();
    loadSidebar();
    renderTopbarUser();

    document.body.style.display = "block";
  } catch (error) {
    console.error("Dashboard init failed:", error);
  }
}

window.addEventListener("DOMContentLoaded", initDashboard);