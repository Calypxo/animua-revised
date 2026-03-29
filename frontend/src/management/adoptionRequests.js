import "../css/management/admin-dashboard.css";
import "../css/management/sidebar.css";
import "../css/management/animalRecords.css";

import Swal from "sweetalert2";
import { API_BASE_URL } from "../utils/api.js";
import { protectManagementPage } from "../auth/authGuard.js";
import { renderTopbarUser } from "../components/management/topbarUser.js";
import { loadSidebar } from "../components/management/sidebarLoader.js";

window.Swal = Swal;

let requests = [];
let displayedRequests = [];
let currentPage = 1;
const ROWS_PER_PAGE = 7;
let selectedRequest = null;

const requestStatusBadge = {
  Pending: "b-intake",
  Approved: "b-ready",
  Rejected: "b-aggro",
};

async function loadAdoptionRequests() {
  try {
    const res = await fetch(`${API_BASE_URL}/adoptions`);

    if (!res.ok) {
      throw new Error("Failed to load adoption requests");
    }

    requests = await res.json();
    displayedRequests = [...requests];
    applyFilters();
  } catch (error) {
    console.error("Load adoption requests error:", error);
    Swal.fire({
      icon: "error",
      title: "Load Failed",
      text: "Could not load adoption requests.",
    });
  }
}

function renderTable(data) {
  const tbody = document.getElementById("requestsTableBody");
  const pageInfo = document.getElementById("requestPageInfo");
  const requestCount = document.getElementById("requestCount");

  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / ROWS_PER_PAGE) || 1;

  if (currentPage > totalPages) {
    currentPage = totalPages;
  }

  const start = (currentPage - 1) * ROWS_PER_PAGE;
  const end = start + ROWS_PER_PAGE;
  const pageData = data.slice(start, end);

  if (requestCount) {
    requestCount.textContent = String(totalItems);
  }

  if (totalItems === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;padding:48px 20px;">
          <div style="color:var(--txt-g);font-size:1.8rem;margin-bottom:8px;">📄</div>
          <div style="font-size:0.83rem;color:var(--txt-m);">
            No adoption requests found.
          </div>
        </td>
      </tr>
    `;
    pageInfo.textContent = "Showing 0–0 of 0 requests";
    renderPagination(0);
    return;
  }

  tbody.innerHTML = pageData.map((request, index) => `
    <tr style="animation:fadeUp .35s ${index * 0.04}s cubic-bezier(0.16,1,0.3,1) both;">
      <td>
        <div class="pet-cell">
          <div class="pet-emoji em-other">👤</div>
          <div>
            <div class="pet-name">${request.full_name || "—"}</div>
            <div class="pet-id-tag">#REQ-${request.id?.slice(0, 6).toUpperCase() || "—"}</div>
          </div>
        </div>
      </td>

      <td>
        <span class="badge b-breed">${request.pet_name || "—"}</span>
      </td>

      <td>${request.contact_number || "—"}</td>
      <td>${request.address || "—"}</td>

      <td>
        <span class="badge ${requestStatusBadge[request.status] || "b-breed"}">
          ${request.status || "Pending"}
        </span>
      </td>

      <td>
        ${request.createdAt ? new Date(request.createdAt).toLocaleDateString() : "—"}
      </td>

      <td>
        <div class="act-btns" style="justify-content:center;">
          <button class="btn-act view" type="button" data-action="view" data-id="${request.id}" title="View">
            <i class="bi bi-eye-fill"></i>
          </button>

          <button class="btn-act edit" type="button" data-action="approve" data-id="${request.id}" title="Approve">
            <i class="bi bi-check-lg"></i>
          </button>

          <button class="btn-act" type="button" data-action="reject" data-id="${request.id}" title="Reject">
            <i class="bi bi-x-lg"></i>
          </button>

          <button class="btn-act delete" type="button" data-action="delete" data-id="${request.id}" title="Delete">
            <i class="bi bi-trash-fill"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join("");

  pageInfo.textContent = `Showing ${start + 1}–${Math.min(end, totalItems)} of ${totalItems} request${totalItems !== 1 ? "s" : ""}`;
  renderPagination(totalItems);
}

function renderPagination(totalItems) {
  const container = document.getElementById("requestPagination");
  if (!container) return;

  const totalPages = Math.ceil(totalItems / ROWS_PER_PAGE);
  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  let html = `
    <button class="pg-btn" ${currentPage === 1 ? "disabled" : ""} data-page="${currentPage - 1}">
      ‹
    </button>
  `;

  const maxVisible = 5;
  let start = Math.max(1, currentPage - 2);
  let end = Math.min(totalPages, start + maxVisible - 1);

  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1);
  }

  if (start > 1) {
    html += `<button class="pg-btn" data-page="1">1</button>`;
    if (start > 2) html += `<span class="pg-dots">...</span>`;
  }

  for (let i = start; i <= end; i++) {
    html += `
      <button class="pg-btn ${i === currentPage ? "active" : ""}" data-page="${i}">
        ${i}
      </button>
    `;
  }

  if (end < totalPages) {
    if (end < totalPages - 1) html += `<span class="pg-dots">...</span>`;
    html += `<button class="pg-btn" data-page="${totalPages}">${totalPages}</button>`;
  }

  html += `
    <button class="pg-btn" ${currentPage === totalPages ? "disabled" : ""} data-page="${currentPage + 1}">
      ›
    </button>
  `;

  container.innerHTML = html;

  container.querySelectorAll(".pg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const page = Number(btn.dataset.page);
      if (!page) return;

      currentPage = page;
      renderTable(displayedRequests);
    });
  });
}

function applyFilters() {
  const q = document.getElementById("requestSearchInput")?.value.toLowerCase() || "";
  const status = document.getElementById("filterRequestStatus")?.value || "";

  displayedRequests = requests.filter((request) => {
    const text = `${request.full_name || ""} ${request.pet_name || ""} ${request.contact_number || ""} ${request.address || ""}`.toLowerCase();

    return (
      (!q || text.includes(q)) &&
      (!status || request.status === status)
    );
  });

  currentPage = 1;
  renderTable(displayedRequests);
}

function openRequestModal(request) {
  selectedRequest = request;

  document.getElementById("requestMetaId").textContent = `#REQ-${request.id?.slice(0, 6).toUpperCase() || "—"}`;
  document.getElementById("requestMetaPet").textContent = request.pet_name || "—";
  document.getElementById("requestMetaStatus").textContent = request.status || "Pending";

  document.getElementById("viewFullName").textContent = request.full_name || "—";
  document.getElementById("viewAge").textContent = request.age || "—";
  document.getElementById("viewBirthdate").textContent = request.birthdate || "—";
  document.getElementById("viewGender").textContent = request.gender || "—";
  document.getElementById("viewCivilStatus").textContent = request.civil_status || "—";
  document.getElementById("viewCitizenship").textContent = request.citizenship || "—";
  document.getElementById("viewContactNumber").textContent = request.contact_number || "—";
  document.getElementById("viewOccupation").textContent = request.occupation || "—";
  document.getElementById("viewAddress").textContent = request.address || "—";

  document.getElementById("viewSpouseName").textContent = request.spouse_name || "—";
  document.getElementById("viewChildrenNames").textContent = request.children_names || "—";
  document.getElementById("viewWhyAdopt").textContent = request.why_adopt || "—";
  document.getElementById("viewVisitVeterinarian").textContent = request.visit_veterinarian || "—";
  document.getElementById("viewExistingPets").textContent = request.existing_pets || "—";

  document.getElementById("viewIssuedDay").textContent = request.issued_day || "—";
  document.getElementById("viewIssuedMonth").textContent = request.issued_month || "—";
  document.getElementById("viewIssuedYear").textContent = request.issued_year || "—";
  document.getElementById("viewSignatureName").textContent = request.signature_name || "—";

  document.getElementById("requestModal").classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeRequestModal() {
  document.getElementById("requestModal").classList.remove("open");
  document.body.style.overflow = "";
  selectedRequest = null;
}

async function updateRequestStatus(requestId, newStatus) {
  try {
    const res = await fetch(`${API_BASE_URL}/adoptions/${requestId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: newStatus }),
    });

    if (!res.ok) {
      throw new Error(`Failed to update request status to ${newStatus}`);
    }

    await loadAdoptionRequests();

    Swal.fire({
      icon: "success",
      title: "Updated!",
      text: `Request marked as ${newStatus}.`,
      timer: 1500,
      showConfirmButton: false,
    });
  } catch (error) {
    console.error("Update request status error:", error);
    Swal.fire({
      icon: "error",
      title: "Update Failed",
      text: error.message || "Could not update request status.",
    });
  }
}

async function deleteRequest(requestId) {
  try {
    const res = await fetch(`${API_BASE_URL}/adoptions/${requestId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      throw new Error("Failed to delete adoption request");
    }

    await loadAdoptionRequests();

    Swal.fire({
      icon: "success",
      title: "Deleted!",
      text: "Adoption request deleted successfully.",
      timer: 1500,
      showConfirmButton: false,
    });
  } catch (error) {
    console.error("Delete request error:", error);
    Swal.fire({
      icon: "error",
      title: "Delete Failed",
      text: error.message || "Could not delete request.",
    });
  }
}

function bindEvents() {
  document.getElementById("btnRefreshRequests")?.addEventListener("click", loadAdoptionRequests);
  document.getElementById("requestModalClose")?.addEventListener("click", closeRequestModal);
  document.getElementById("btnCloseRequestModal")?.addEventListener("click", closeRequestModal);

  document.getElementById("requestModal")?.addEventListener("click", (event) => {
    if (event.target.id === "requestModal") closeRequestModal();
  });

  ["requestSearchInput", "filterRequestStatus"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", applyFilters);
    document.getElementById(id)?.addEventListener("change", applyFilters);
  });

  document.addEventListener("click", async (event) => {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;

    const requestId = actionButton.dataset.id;
    const action = actionButton.dataset.action;
    const request = requests.find((item) => item.id === requestId);

    if (!request) return;

    if (action === "view") {
      openRequestModal(request);
      return;
    }

    if (action === "approve") {
      const result = await Swal.fire({
        icon: "question",
        title: "Approve adoption request?",
        text: `Approve the request of ${request.full_name || "this applicant"} for ${request.pet_name || "this pet"}?`,
        showCancelButton: true,
        confirmButtonText: "Approve",
        confirmButtonColor: "#198754",
      });

      if (result.isConfirmed) {
        await updateRequestStatus(requestId, "Approved");
      }
      return;
    }

    if (action === "reject") {
      const result = await Swal.fire({
        icon: "warning",
        title: "Reject adoption request?",
        text: `Reject the request of ${request.full_name || "this applicant"}?`,
        showCancelButton: true,
        confirmButtonText: "Reject",
        confirmButtonColor: "#dc3545",
      });

      if (result.isConfirmed) {
        await updateRequestStatus(requestId, "Rejected");
      }
      return;
    }

    if (action === "delete") {
      const result = await Swal.fire({
        icon: "warning",
        title: "Delete adoption request?",
        text: `This will permanently remove the request of ${request.full_name || "this applicant"}.`,
        showCancelButton: true,
        confirmButtonText: "Delete",
        confirmButtonColor: "#dc3545",
      });

      if (result.isConfirmed) {
        await deleteRequest(requestId);
      }
      return;
    }

  });

  

  document.getElementById("btnApproveRequest")?.addEventListener("click", async () => {
    if (!selectedRequest) return;

    const result = await Swal.fire({
      icon: "question",
      title: "Approve adoption request?",
      text: `Approve the request of ${selectedRequest.full_name || "this applicant"} for ${selectedRequest.pet_name || "this pet"}?`,
      showCancelButton: true,
      confirmButtonText: "Approve",
      confirmButtonColor: "#198754",
    });

    if (result.isConfirmed) {
      closeRequestModal();
      await updateRequestStatus(selectedRequest.id, "Approved");
    }
  });
}

async function initAdoptionRequests() {
  try {
    await protectManagementPage();
    loadSidebar();
    renderTopbarUser();
    await loadAdoptionRequests();
    bindEvents();
    document.body.style.display = "block";
  } catch (error) {
    console.error("Adoption requests init failed:", error);
  }
}

window.addEventListener("DOMContentLoaded", initAdoptionRequests);