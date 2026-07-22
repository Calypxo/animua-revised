// admin-frontend/src/management/userManagement.js
import "../css/adminDashboard.css";
import "../css/sidebar.css";
import "../css/userManagement.css";

import {
  protectPageByModule,
} from "../auth/authGuard.js";

import {
  renderTopbarUser,
} from "../components/management/topbarUser.js";

import {
  loadSidebar,
} from "../components/management/sidebarLoader.js";

import {
  getUserEmail,
} from "../utils/storage.js";

import {
  ROLE_PERMISSIONS,
  normalizeRole,
  hasPermission,
} from "../auth/permissions.js";

import {
  getAllUsers,
  createUser,
  updateUser,
  toggleUserStatus,
} from "../services/users.service.js";

/* ── Constants ───────────────────────────────────────── */
const ALL_PERMISSIONS = [
  {
    key: "dashboard",
    label: "Dashboard",
  },
  {
    key: "users",
    label: "User Management",
  },
  {
    key: "surrender",
    label: "Animal Surrender",
  },
  {
    key: "intake",
    label: "Intake Management",
  },
  {
    key: "animals",
    label: "Animal Profiling",
  },
  {
    key: "quarantine",
    label: "Quarantine / Medical",
  },
  {
    key: "adoption",
    label: "Adoption",
  },
  {
    key: "inventory",
    label: "Inventory",
  },
  {
    key: "reports",
    label: "Reports",
  },
  {
    key: "audit",
    label: "Audit Trail",
  },
  {
    key: "archive",
    label: "Archive",
  },
];

const AVATAR_COLORS = [
  "#6f191c",
  "#2558a8",
  "#186534",
  "#b86a00",
  "#0d6e6e",
  "#9b2c4e",
  "#3d2b8a",
  "#1a6b5a",
  "#7a3b00",
  "#1a4e7a",
];

const PAGE_SIZE = 8;

/* ── State ───────────────────────────────────────────── */
let allUsers      = [];
let filteredUsers = [];
let currentPage   = 1;
let activeTab     = "all";   // "all" | "staff" (management) | "public"
let editingId     = null;
let togglingId    = null;
let isLoading     = false;
let currentRole = "";

/* ── Helpers ─────────────────────────────────────────── */
const initials  = u => `${(u.firstName||u.fullName||"?")[0]}${(u.lastName||"")[0]||""}`.toUpperCase();
const labelPerm = k => ALL_PERMISSIONS.find(p => p.key === k)?.label || k;
const rndColor  = () => AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

function formatLastLogin(ts) {
  if (!ts) return "Never";
  const date = ts._seconds ? new Date(ts._seconds * 1000) : new Date(ts);
  if (isNaN(date)) return "—";
  const diff = Date.now() - date;
  const m = Math.floor(diff/60000), h = Math.floor(m/60), d = Math.floor(h/24);
  if (m < 2)   return "Just now";
  if (m < 60)  return `${m}m ago`;
  if (h < 24)  return `${h}h ago`;
  if (d === 1) return "Yesterday";
  if (d < 7)   return `${d} days ago`;
  return date.toLocaleDateString("en-PH", { month:"short", day:"numeric", year:"numeric" });
}

function displayName(u) {
  return u.fullName || `${u.firstName||""} ${u.lastName||""}`.trim() || u.id;
}

function getDisplayRole(role) {
  const normalizedManagementRole = normalizeRole(role);

  if (normalizedManagementRole) {
    return normalizedManagementRole;
  }

  if (
    String(role).trim().toLowerCase() === "public"
  ) {
    return "Public";
  }

  return "";
}

function getPermissionsForRole(role) {
  const normalizedRole = normalizeRole(role);

  if (!normalizedRole) {
    return [];
  }

  const permissions = ROLE_PERMISSIONS[normalizedRole];

  if (!permissions) {
    return [];
  }

  return Object.keys(permissions);
}

function can(action) {
  return hasPermission(currentRole, "users", action);
}

/* ── Load & Stats ────────────────────────────────────── */
async function loadUsers() {
  setLoading(true);

  try {
    const data = await getAllUsers();
    allUsers = data.users || [];
    renderStats(data.summary);
  } catch (err) {
    console.error("[loadUsers]", err);
    showToast("error", err.message || "Failed to load users.");
    setTableMsg("Failed to load users. Please refresh.");
    allUsers = [];
  } finally {
    setLoading(false);
    applyFilters();
  }
}

function renderStats(summary) {
  const calculatedSummary = {
    total: allUsers.length,
    active: allUsers.filter(user => user.status === "Active").length,
    inactive: allUsers.filter(user => user.status === "Inactive").length,
    admins: allUsers.filter(user => {
      return getDisplayRole(user.role) === "Admin";
    }).length,
    staff: allUsers.filter(user => {
      return getDisplayRole(user.role) === "Staff";
    }).length,
    veterinarians: allUsers.filter(user => {
      return getDisplayRole(user.role) === "Veterinarian";
    }).length,
    public: allUsers.filter(user => {
      return getDisplayRole(user.role) === "Public";
    }).length
  };

  const stats = {
    ...calculatedSummary,
    ...(summary || {})
  };

  const setStatValue = (elementId, value) => {
    const element = document.getElementById(elementId);

    if (element) {
      element.textContent = value ?? 0;
    }
  };

  setStatValue("statTotal", stats.total);
  setStatValue("statActive", stats.active);
  setStatValue("statInactive", stats.inactive);
  setStatValue("statAdmins", stats.admins);
  setStatValue("statStaff", stats.staff);
  setStatValue("statVeterinarians", stats.veterinarians ?? stats.vets ?? 0);
  setStatValue("statPublic", stats.public);
}

function setLoading(v) {
  isLoading = v;
  if (v) setTableMsg('<div class="um-spinner"></div><p class="text-muted mt-2" style="font-size:0.85rem">Loading users…</p>');
}

function setTableMsg(html) {
  const b = document.getElementById("userTableBody");
  if (b) b.innerHTML = `<tr><td colspan="7" class="text-center py-5">${html}</td></tr>`;
}

/* ── Tabs ────────────────────────────────────────────── */
function bindTabs() {
  document.querySelectorAll(".um-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".um-tab").forEach(t => t.classList.remove("active"));
      btn.classList.add("active");
      activeTab = btn.dataset.tab;
      // sync role filter dropdown
      const rf = document.getElementById("filterRole");
      if (rf) {
        if (activeTab === "staff")  rf.value = "";
        if (activeTab === "public") rf.value = "Public";
        if (activeTab === "all")    rf.value = "";
      }
      applyFilters();
    });
  });
}

/* ── Filter ──────────────────────────────────────────── */
function applyFilters() {
  const q = (document.getElementById("searchUsers")?.value || "").toLowerCase().trim();
  const role = document.getElementById("filterRole")?.value || "";
  const status = document.getElementById("filterStatus")?.value || "";

  filteredUsers = allUsers.filter(user => {
    const normalizedRole = getDisplayRole(user.role);

    // Tab filter
    if (
      activeTab === "staff" &&
      normalizedRole === "Public"
    ) {
      return false;
    }

    if (
      activeTab === "public" &&
      normalizedRole !== "Public"
    ) {
      return false;
    }

    // Dropdown filters
    if (
      role &&
      normalizedRole !== role
    ) {
      return false;
    }

    if (
      status &&
      user.status !== status
    ) {
      return false;
    }

    // Search
    const name = `
      ${user.firstName || ""}
      ${user.lastName || ""}
      ${user.fullName || ""}
    `.toLowerCase();

    const email = String(
      user.email || user.id || ""
    ).toLowerCase();

    if (
      q &&
      !name.includes(q) &&
      !email.includes(q)
    ) {
      return false;
    }

    return true;
  });

  currentPage = 1;
  renderTable();
  renderPagination();
}

/* ── Table ───────────────────────────────────────────── */
function renderTable() {
  const tbody = document.getElementById("userTableBody");
  if (!tbody || isLoading) return;

  const start = (currentPage - 1) * PAGE_SIZE;
  const page  = filteredUsers.slice(start, start + PAGE_SIZE);

  if (!page.length) { setTableMsg("No users found."); return; }

  tbody.innerHTML = page.map(u => {
    const normalizedRole = getDisplayRole(u.role);
    const ini = initials(u);
    const color = u.color || rndColor();
    const isPublic = normalizedRole === "Public";
    const isActive = u.status === "Active";
    const dname = displayName(u);

    // Role badge
    const roleCfg = {
      Admin: {
        cls: "role-admin",
        icon: "bi-shield-fill",
        label: "Admin"
      },
      Staff: {
        cls: "role-staff",
        icon: "bi-person-badge-fill",
        label: "Staff"
      },
      Veterinarian: {
        cls: "role-veterinarian",
        icon: "bi-heart-pulse-fill",
        label: "Veterinarian"
      },
      Public: {
        cls: "role-public",
        icon: "bi-person-fill",
        label: "Public"
      }
    };
    const rc = roleCfg[normalizedRole] || roleCfg.Public;

    // Permissions / info column
    let permCol;
    if (isPublic) {
      permCol = `<span class="public-info-tag"><i class="bi bi-globe me-1"></i>Public portal user</span>`;
    } else {
      const assignedPermissions = getPermissionsForRole(normalizedRole);
      const perms = assignedPermissions.slice(0, 3);
      const extra = assignedPermissions.length - 3;

      permCol = perms
        .map(permission => {
          return `
            <span class="perm-tag">
              ${labelPerm(permission)}
            </span>
          `;
        })
        .join("") + (
          extra > 0
            ? `<span class="perm-tag-more">+${extra}</span>`
            : ""
        );

      if (!permCol) {
        permCol = `
          <span
            style="
              color: var(--stone-2);
              font-size: 0.78rem;
            "
          >
            None assigned
          </span>
        `;
      }
    }

    // Actions — Public users: view + toggle only, no edit
    const actions = `
      <button class="tbl-action-btn" title="View" data-action="view" data-id="${u.id}"><i class="bi bi-eye"></i></button>
      ${!isPublic ? `<button class="tbl-action-btn" title="Edit" data-action="edit" data-id="${u.id}"><i class="bi bi-pencil"></i></button>` : ""}
      <button class="tbl-action-btn ${isActive?"danger":"success"}"
        title="${isActive?"Deactivate":"Activate"}" data-action="toggle" data-id="${u.id}">
        <i class="bi ${isActive?"bi-person-x":"bi-person-check"}"></i>
      </button>`;

    return `
    <tr class="${isPublic?"public-row":""}" data-id="${u.id}" style="cursor:pointer">
      <td>
        <div class="user-cell">
          <div class="user-thumb" style="background:${color}">${ini}</div>
          <div>
            <div class="user-fullname">${dname}</div>
            <div class="user-id-text">${u.id}</div>
          </div>
        </div>
      </td>
      <td style="font-size:0.84rem;color:var(--stone)">${u.email||u.id}</td>
      <td><span class="role-badge ${rc.cls}"><i class="bi ${rc.icon}"></i> ${rc.label}</span></td>
      <td><div class="perm-tags">${permCol}</div></td>
      <td style="font-family:var(--mono);font-size:0.76rem;color:var(--stone)">${formatLastLogin(u.lastLogin)}</td>
      <td>
        <span class="status-badge ${isActive?"badge-active":"badge-inactive"}">
          <i class="bi ${isActive?"bi-circle-fill":"bi-circle"}"></i> ${u.status}
        </span>
      </td>
      <td>${actions}</td>
    </tr>`;
  }).join("");

  // Row click
  tbody.querySelectorAll("tr[data-id]").forEach(row => {
    row.addEventListener("click", e => {
      if (e.target.closest("[data-action]")) return;
      openViewModal(row.dataset.id);
    });
  });

  tbody.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const { action, id } = btn.dataset;
      if (action==="view")   openViewModal(id);
      if (action==="edit")   openEditModal(id);
      if (action==="toggle") openToggleModal(id);
    });
  });
}

/* ── Pagination ──────────────────────────────────────── */
function renderPagination() {
  const bar = document.getElementById("paginationBar");
  if (!bar) return;
  const total = filteredUsers.length;
  const pages = Math.max(1, Math.ceil(total/PAGE_SIZE));
  const start = Math.min((currentPage-1)*PAGE_SIZE+1, total);
  const end   = Math.min(currentPage*PAGE_SIZE, total);

  let h = `<span class="page-info">Showing ${total?start:0}–${end} of ${total}</span>`;
  h += `<button class="page-btn" id="pagePrev" ${currentPage===1?"disabled":""}><i class="bi bi-chevron-left"></i></button>`;
  for (let i=1;i<=pages;i++) h+=`<button class="page-btn ${i===currentPage?"active":""}" data-page="${i}">${i}</button>`;
  h += `<button class="page-btn" id="pageNext" ${currentPage===pages?"disabled":""}><i class="bi bi-chevron-right"></i></button>`;
  bar.innerHTML = h;

  bar.querySelector("#pagePrev")?.addEventListener("click",()=>{ if(currentPage>1){currentPage--;renderTable();renderPagination();} });
  bar.querySelector("#pageNext")?.addEventListener("click",()=>{ if(currentPage<pages){currentPage++;renderTable();renderPagination();} });
  bar.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>{currentPage=parseInt(b.dataset.page);renderTable();renderPagination();}));
}

/* ── Permission Grid ─────────────────────────────────── */
function renderPermGrid(selected = []) {
  const grid = document.getElementById("permGrid");

  if (!grid) {
    return;
  }

  grid.innerHTML = ALL_PERMISSIONS.map(permission => {
    const isEnabled = selected.includes(permission.key);

    return `
      <div
        class="perm-item ${isEnabled ? "checked" : ""} perm-readonly"
        data-perm="${permission.key}"
        aria-disabled="true"
      >
        <div class="perm-checkbox">
          <i class="bi bi-check"></i>
        </div>

        <span class="perm-name">
          ${permission.label}
        </span>
      </div>
    `;
  }).join("");
}

/* ── Add Modal ───────────────────────────────────────── */
function openAddModal() {
  if (!can("create")) {
  showToast("error", "You do not have permission to create users.");
  return;
}
  editingId = null;

  document.getElementById("modalTitle").textContent =
    "Add Management User";

  document.getElementById("userForm").reset();
  document.getElementById("formUserId").value = "";
  document.getElementById("avatarPreview").textContent = "?";
  document.getElementById("avatarPreview").style.background =
    "var(--clay)";

  document.getElementById("passwordGroup").style.display = "";
  document.getElementById("confirmPasswordGroup").style.display = "";
  document.getElementById("fEmail").disabled = false;

  document.getElementById("fRole").value = "Staff";

  clearFormErrors();
  renderPermGrid(getPermissionsForRole("Staff"));
  openModal("userModalBackdrop");
}

/* ── Edit Modal ──────────────────────────────────────── */
function openEditModal(id) {
  if (!can("edit")) {
  showToast("error", "You do not have permission to edit users.");
  return;
}

  const u = allUsers.find(u=>u.id===id);
  if (!u) return;

  const normalizedRole = getDisplayRole(u.role);

  if (!normalizedRole || normalizedRole === "Public") {
    return;
  }

  editingId = id;
  document.getElementById("modalTitle").textContent = "Edit User";
  document.getElementById("formUserId").value  = id;
  document.getElementById("fFirstName").value  = u.firstName || u.fullName?.split(" ")[0] || "";
  document.getElementById("fLastName").value   = u.lastName  || u.fullName?.split(" ").slice(1).join(" ") || "";
  document.getElementById("fEmail").value      = u.email || u.id;
  document.getElementById("fEmail").disabled   = true; // email = doc ID, cannot change
  document.getElementById("fRole").value       = normalizedRole;
  document.getElementById("fStatus").value     = u.status || "Active";
  document.getElementById("passwordGroup").style.display        = "none";
  document.getElementById("confirmPasswordGroup").style.display = "none";
  updateAvatarPreview();
  clearFormErrors();
  renderPermGrid(getPermissionsForRole(normalizedRole));
  openModal("userModalBackdrop");
}

/* ── Save ────────────────────────────────────────────── */
async function saveUser() {
  const requiredPermission = editingId ? "edit" : "create";

if (!can(requiredPermission)) {
  showToast(
    "error",
    editingId
      ? "You do not have permission to edit users."
      : "You do not have permission to create users."
  );
  return;
}

  if (!validateForm()) return;
  const btn = document.getElementById("modalSaveBtn");
  btn.disabled = true; btn.textContent = "Saving…";

  try {
    const firstName = document
      .getElementById("fFirstName")
      .value
      .trim();

    const lastName = document
      .getElementById("fLastName")
      .value
      .trim();

    const email = document
      .getElementById("fEmail")
      .value
      .trim()
      .toLowerCase();

      const selectedRole = document.getElementById("fRole").value;
    const role = normalizeRole(selectedRole);
    const status = document.getElementById("fStatus").value;

    if (!role) {
      throw new Error("A valid management role is required.");
    }

    const permissions = getPermissionsForRole(role);

    if (editingId) {
      await updateUser(editingId, { firstName, lastName, role, status, permissions });
      showToast("success", "User updated successfully.");
    } else {
      const password = document.getElementById("fPassword").value;
      await createUser({ firstName, lastName, email, password, role, status, permissions, color: rndColor() });
      showToast("success", "User created successfully.");
    }
    closeModal("userModalBackdrop");
    await loadUsers();
  } catch (err) {
    if (err.status===409) { setErr("errEmail","This email is already in use."); setInvalid("fEmail"); }
    else showToast("error", err.message || "Failed to save user.");
  } finally {
    btn.disabled = false; btn.innerHTML = `<i class="bi bi-floppy-fill"></i> Save User`;
  }
}

/* ── View Modal ──────────────────────────────────────── */
function openViewModal(id) {
  const u = allUsers.find(user => user.id === id);

  if (!u) {
    return;
  }

  const normalizedRole = getDisplayRole(u.role);
  const ini = initials(u);
  const color = u.color || rndColor();
  const dname = displayName(u);
  const isPublic = normalizedRole === "Public";
  const assignedPermissions = isPublic ? [] : getPermissionsForRole(normalizedRole);
  const roleLabel = {
    Admin: "Administrator",
    Staff: "Staff",
    Veterinarian: "Veterinarian",
    Public: "Public User"
  }[normalizedRole] || normalizedRole;
  const roleCls = {
    Admin: "role-admin",
    Staff: "role-staff",
    Veterinarian: "role-veterinarian",
    Public: "role-public"
  }[normalizedRole] || "role-public";

  document.getElementById("viewModalBody").innerHTML = `
    <div class="view-user-card">
      <div class="view-avatar" style="background:${color}">${ini}</div>
      <div>
        <div class="view-name">${dname}</div>
        <div class="view-email">${u.email||u.id}</div>
      </div>
      <div class="ms-auto"><span class="status-badge ${u.status==="Active"?"badge-active":"badge-inactive"}">${u.status}</span></div>
    </div>
    <div class="view-details-grid">
      <div class="view-detail-item"><div class="view-detail-lbl">ID / Email</div><div class="view-detail-val" style="font-family:var(--mono);font-size:0.78rem">${u.id}</div></div>
      <div class="view-detail-item"><div class="view-detail-lbl">Role</div><div class="view-detail-val"><span class="role-badge ${roleCls}">${roleLabel}</span></div></div>
      <div class="view-detail-item"><div class="view-detail-lbl">Last Login</div><div class="view-detail-val">${formatLastLogin(u.lastLogin)}</div></div>
      <div class="view-detail-item"><div class="view-detail-lbl">Account Status</div><div class="view-detail-val">${u.status}</div></div>
    </div>
    ${isPublic
      ? `<div class="view-perms-title"><i class="bi bi-info-circle me-1"></i> Public Portal User</div>
         <p style="font-size:0.84rem;color:var(--stone)">This user registered via the public portal. Password resets and permission management are handled on the public side.</p>`
      : `<div class="view-perms-title"><i class="bi bi-key-fill me-1"></i> Permissions (${assignedPermissions.length})</div>
         <div class="view-perms-list">${assignedPermissions.length
           ? assignedPermissions.map(permission => {
               return `
                 <span class="perm-tag">
                   ${labelPerm(permission)}
                 </span>
               `;
             }).join("")
           : `<span style="color:var(--stone-2);font-size:0.82rem">No permissions assigned.</span>`}</div>`
    }`;

  // Show Edit button only for non-public
  const editBtn = document.getElementById("viewModalEditBtn");
  editBtn.style.display = isPublic ? "none" : "";
  editBtn.onclick = () => { closeModal("viewModalBackdrop"); openEditModal(id); };

  openModal("viewModalBackdrop");
}

/* ── Toggle Status Modal ─────────────────────────────── */
function openToggleModal(id) {
  if (!can("delete")) {
  showToast("error", "You do not have permission to activate or deactivate users.");
  return;
}
  const u = allUsers.find(u=>u.id===id);
  if (!u) return;

  const currentUserEmail = String(getUserEmail() || "").trim().toLowerCase();
  const targetEmail = String(u.email || u.id || "").trim().toLowerCase();

  if (currentUserEmail && targetEmail === currentUserEmail) {
    showToast("error", "You cannot deactivate your own account.");
    return;
  }

  togglingId = id;
  const isActive = u.status==="Active";
  const dname    = displayName(u);
  document.getElementById("deactivateTitle").textContent = isActive?"Deactivate User":"Activate User";
  document.getElementById("deactivateMsg").textContent   = isActive
    ? `Deactivate ${dname}? They will lose all system access.`
    : `Re-activate ${dname}? They will regain access.`;
  const iw = document.getElementById("confirmIconWrap");
  iw.className = `confirm-icon-wrap ${isActive?"deactivate":"activate"}`;
  iw.querySelector("i").className = `bi ${isActive?"bi-person-x-fill":"bi-person-check-fill"}`;
  const cb = document.getElementById("deactivateConfirmBtn");
  cb.className = isActive?"btn-danger":"btn-success";
  cb.innerHTML = isActive?`<i class="bi bi-person-x-fill"></i> Deactivate`:`<i class="bi bi-person-check-fill"></i> Activate`;
  openModal("deactivateModalBackdrop");
}

async function confirmToggle() {
  if (!can("delete")) {
  showToast("error", "You do not have permission to activate or deactivate users.");
  return;
}

  const btn = document.getElementById("deactivateConfirmBtn");
  btn.disabled = true; btn.textContent = "Saving…";
  try {
    const res = await toggleUserStatus(togglingId);
    closeModal("deactivateModalBackdrop");
    showToast(res.status==="Active"?"success":"info",
      `User ${res.status==="Active"?"activated":"deactivated"} successfully.`);
    await loadUsers();
  } catch (err) {
    showToast("error", err.message||"Failed to update status.");
  } finally { btn.disabled = false; }
}

/* ── Form Validation ─────────────────────────────────── */
function validateForm() {
  clearFormErrors(); let ok=true;
  const fn = document.getElementById("fFirstName").value.trim();
  const ln = document.getElementById("fLastName").value.trim();
  const em = document.getElementById("fEmail").value.trim();
  const ro = document.getElementById("fRole").value;
  const normalizedRole = normalizeRole(ro);
  if (!fn) { setErr("errFirstName","First name required."); setInvalid("fFirstName"); ok=false; }
  if (!ln) { setErr("errLastName","Last name required.");   setInvalid("fLastName");  ok=false; }
  if (!em) { setErr("errEmail","Email required.");          setInvalid("fEmail");     ok=false; }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setErr("errEmail","Invalid email."); setInvalid("fEmail"); ok=false; }
  if (!normalizedRole) {
    setErr("errRole","Please select a valid management role.");
    setInvalid("fRole");
    ok = false;
  }
  if (!editingId) {
    const pw=document.getElementById("fPassword").value;
    const cp=document.getElementById("fConfirmPassword").value;
    if (!pw)        { setErr("errPassword","Password required.");    setInvalid("fPassword"); ok=false; }
    else if(pw.length<8){ setErr("errPassword","Min. 8 chars.");     setInvalid("fPassword"); ok=false; }
    if(pw&&cp!==pw) { setErr("errConfirmPassword","Passwords do not match."); setInvalid("fConfirmPassword"); ok=false; }
  }
  return ok;
}

function setErr(id,m)   { const e=document.getElementById(id); if(e) e.textContent=m; }
function setInvalid(id) { document.getElementById(id)?.classList.add("invalid"); }
function clearFormErrors() {
  document.querySelectorAll(".form-err").forEach(e=>e.textContent="");
  document.querySelectorAll(".form-inp.invalid").forEach(e=>e.classList.remove("invalid"));
}

/* ── Avatar Preview ──────────────────────────────────── */
function updateAvatarPreview() {
  const f=document.getElementById("fFirstName")?.value.trim();
  const l=document.getElementById("fLastName")?.value.trim();
  const el=document.getElementById("avatarPreview");
  if (!el) return;
  el.textContent=(f||l)?`${(f?.[0]||"").toUpperCase()}${(l?.[0]||"").toUpperCase()}`:"?";
}

function onRoleChange() {
  const role = document.getElementById("fRole")?.value;

  if (!role) {
    renderPermGrid([]);
    return;
  }

  const permissions = getPermissionsForRole(role);
  renderPermGrid(permissions);
}

/* ── Modal Helpers ───────────────────────────────────── */
function openModal(id)  { document.getElementById(id)?.classList.add("open"); }
function closeModal(id) { document.getElementById(id)?.classList.remove("open"); }
function closeAll() { ["userModalBackdrop","viewModalBackdrop","deactivateModalBackdrop"].forEach(closeModal); }

/* ── Toast ───────────────────────────────────────────── */
let toastT;
function showToast(type, msg) {
  const t=document.getElementById("umToast"), ic=document.getElementById("toastIcon"), m=document.getElementById("toastMsg");
  if (!t) return;
  const icons={success:"bi-check-circle-fill",error:"bi-x-circle-fill",info:"bi-info-circle-fill"};
  t.className=`um-toast toast-${type}`; ic.className=`bi ${icons[type]||"bi-info-circle-fill"}`; m.textContent=msg;
  t.classList.add("show"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("show"),3500);
}

/* ── Eye Toggle ──────────────────────────────────────── */
function bindEye(btnId, inputId) {
  document.getElementById(btnId)?.addEventListener("click",()=>{
    const i=document.getElementById(inputId), ic=document.querySelector(`#${btnId} i`);
    if(!i||!ic) return;
    const show=i.type==="password"; i.type=show?"text":"password";
    ic.className=show?"bi bi-eye-slash":"bi bi-eye";
  });
}


/* ── Role badge CSS for Public (add to page) ─────────── */
function injectRoleStyles() {
  const style = document.createElement("style");

  style.textContent = `
    .role-public {
      background: var(--rose-soft);
      color: var(--rose);
    }

    .role-veterinarian {
      background: #dff4f1;
      color: #17695f;
    }

    .icon-teal {
      background: #dff4f1;
      color: #17695f;
    }

    .perm-item.perm-readonly {
      cursor: default;
      pointer-events: none;
    }

    .perm-item.perm-readonly:not(.checked) {
      opacity: 0.55;
    }
  `;

  document.head.appendChild(style);
}

/* ── Init ────────────────────────────────────────────── */
async function init() {
  try {
    const session = await protectPageByModule("users");
    currentRole = session.role;
     injectRoleStyles();
    renderTopbarUser();
    loadSidebar();

    bindTabs();

    await loadUsers();


    const addUserButton = document.getElementById("btnAddUser");

if (addUserButton) {
  addUserButton.style.display = can("create") ? "" : "none";

  if (can("create")) {
    addUserButton.addEventListener("click", openAddModal);
  }
}
    document.getElementById("searchUsers")?.addEventListener("input",applyFilters);
    document.getElementById("filterRole")?.addEventListener("change",applyFilters);
    document.getElementById("filterStatus")?.addEventListener("change",applyFilters);
    document.getElementById("fFirstName")?.addEventListener("input",updateAvatarPreview);
    document.getElementById("fLastName")?.addEventListener("input",updateAvatarPreview);
    document.getElementById("fRole")?.addEventListener("change",onRoleChange);
    bindEye("togglePassword","fPassword"); bindEye("toggleConfirm","fConfirmPassword");
    document.getElementById("modalSaveBtn")?.addEventListener("click",saveUser);
    document.getElementById("modalCloseBtn")?.addEventListener("click",()=>closeModal("userModalBackdrop"));
    document.getElementById("modalCancelBtn")?.addEventListener("click",()=>closeModal("userModalBackdrop"));
    document.getElementById("viewModalCloseBtn")?.addEventListener("click",()=>closeModal("viewModalBackdrop"));
    document.getElementById("viewModalClose2")?.addEventListener("click",()=>closeModal("viewModalBackdrop"));
    document.getElementById("deactivateCloseBtn")?.addEventListener("click",()=>closeModal("deactivateModalBackdrop"));
    document.getElementById("deactivateCancelBtn")?.addEventListener("click",()=>closeModal("deactivateModalBackdrop"));
    document.getElementById("deactivateConfirmBtn")?.addEventListener("click",confirmToggle);
    ["userModalBackdrop","viewModalBackdrop","deactivateModalBackdrop"].forEach(id=>{
      document.getElementById(id)?.addEventListener("click",e=>{if(e.target.id===id)closeModal(id);});
    });
    document.addEventListener("keydown",e=>{if(e.key==="Escape")closeAll();});
    document.body.classList.remove("loading");
  } catch (err) {
    console.error("Init failed:",err);
    document.body.classList.remove("loading");
  }
}

window.addEventListener("DOMContentLoaded", init);