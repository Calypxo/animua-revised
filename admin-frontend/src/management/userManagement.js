// admin-frontend/src/management/userManagement.js
import "../css/adminDashboard.css";
import "../css/sidebar.css";
import "../css/userManagement.css";

import { protectManagementPage } from "../auth/authGuard.js";
import { renderTopbarUser }      from "../components/management/topbarUser.js";
import { loadSidebar }           from "../components/management/sidebarLoader.js";
import { getUserRole }           from "../utils/storage.js";
import { getAllUsers, createUser, updateUser, toggleUserStatus } from "../services/users.service.js";

/* ── Constants ───────────────────────────────────────── */
const ALL_PERMISSIONS = [
  { key:"dashboard",        label:"Dashboard"          },
  { key:"user_management",  label:"User Management"    },
  { key:"animal_surrender", label:"Animal Surrender"   },
  { key:"intake",           label:"Intake Mgmt"        },
  { key:"animal_profiling", label:"Animal Profiling"   },
  { key:"quarantine",       label:"Quarantine/Medical" },
  { key:"adoption",         label:"Adoption"           },
  { key:"inventory",        label:"Inventory"          },
  { key:"reports",          label:"Reports"            },
  { key:"audit_trail",      label:"Audit Trail"        },
  { key:"archive",          label:"Archive"            },
];

const ADMIN_DEFAULT_PERMS = ALL_PERMISSIONS.map(p => p.key);
const STAFF_DEFAULT_PERMS = ["dashboard","animal_surrender","intake","animal_profiling","quarantine","adoption","inventory","reports"];
const AVATAR_COLORS = ["#6f191c","#2558a8","#186534","#b86a00","#0d6e6e","#9b2c4e","#3d2b8a","#1a6b5a","#7a3b00","#1a4e7a"];
const PAGE_SIZE = 8;

/* ── State ───────────────────────────────────────────── */
let allUsers      = [];
let filteredUsers = [];
let currentPage   = 1;
let activeTab     = "all";   // "all" | "staff" | "public"
let editingId     = null;
let togglingId    = null;
let isLoading     = false;

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

function renderStats(s) {
  if (!s) {
    s = {
      total:    allUsers.length,
      active:   allUsers.filter(u=>u.status==="Active").length,
      inactive: allUsers.filter(u=>u.status==="Inactive").length,
      admins:   allUsers.filter(u=>u.role==="Admin").length,
      staff:    allUsers.filter(u=>u.role==="Staff").length,
      public:   allUsers.filter(u=>u.role==="Public").length,
    };
  }
  const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  set("statTotal",    s.total);
  set("statActive",   s.active);
  set("statInactive", s.inactive);
  set("statAdmins",   s.admins);
  set("statStaff",    s.staff);
  set("statPublic",   s.public);
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
  const q      = (document.getElementById("searchUsers")?.value || "").toLowerCase().trim();
  const role   = document.getElementById("filterRole")?.value   || "";
  const status = document.getElementById("filterStatus")?.value || "";

  filteredUsers = allUsers.filter(u => {
    // Tab filter
    if (activeTab === "staff"  && u.role === "Public")  return false;
    if (activeTab === "public" && u.role !== "Public")  return false;
    // Dropdown filters
    if (role   && u.role   !== role)   return false;
    if (status && u.status !== status) return false;
    // Search
    const name = `${u.firstName||""} ${u.lastName||""} ${u.fullName||""}`.toLowerCase();
    if (q && !name.includes(q) && !u.email?.toLowerCase().includes(q)) return false;
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
    const ini      = initials(u);
    const color    = u.color || rndColor();
    const isPublic = u.role === "Public";
    const isActive = u.status === "Active";
    const dname    = displayName(u);

    // Role badge
    const roleCfg = {
      Admin:  { cls:"role-admin", icon:"bi-shield-fill",       label:"Admin" },
      Staff:  { cls:"role-staff", icon:"bi-person-badge-fill", label:"Staff" },
      Public: { cls:"role-public",icon:"bi-person-fill",       label:"Public" },
    };
    const rc = roleCfg[u.role] || roleCfg.Public;

    // Permissions / info column
    let permCol;
    if (isPublic) {
      permCol = `<span class="public-info-tag"><i class="bi bi-globe me-1"></i>Public portal user</span>`;
    } else {
      const perms = (u.permissions||[]).slice(0,3);
      const extra = (u.permissions||[]).length - 3;
      permCol = perms.map(k=>`<span class="perm-tag">${labelPerm(k)}</span>`).join("")
        + (extra > 0 ? `<span class="perm-tag-more">+${extra}</span>` : "")
        || `<span style="color:var(--stone-2);font-size:0.78rem">None assigned</span>`;
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
function renderPermGrid(selected=[]) {
  const grid = document.getElementById("permGrid");
  if (!grid) return;
  grid.innerHTML = ALL_PERMISSIONS.map(p=>{
    const on = selected.includes(p.key);
    return `<div class="perm-item ${on?"checked":""}" data-perm="${p.key}">
      <div class="perm-checkbox"><i class="bi bi-check"></i></div>
      <span class="perm-name">${p.label}</span>
    </div>`;
  }).join("");
  grid.querySelectorAll(".perm-item").forEach(i=>i.addEventListener("click",()=>i.classList.toggle("checked")));
}
function getCheckedPerms() { return [...document.querySelectorAll(".perm-item.checked")].map(i=>i.dataset.perm); }

/* ── Add Modal ───────────────────────────────────────── */
function openAddModal() {
  editingId = null;
  document.getElementById("modalTitle").textContent = "Add Admin / Staff User";
  document.getElementById("userForm").reset();
  document.getElementById("formUserId").value = "";
  document.getElementById("avatarPreview").textContent = "?";
  document.getElementById("avatarPreview").style.background = "var(--clay)";
  document.getElementById("passwordGroup").style.display        = "";
  document.getElementById("confirmPasswordGroup").style.display = "";
  document.getElementById("fEmail").disabled = false;
  clearFormErrors();
  renderPermGrid(STAFF_DEFAULT_PERMS);
  openModal("userModalBackdrop");
}

/* ── Edit Modal ──────────────────────────────────────── */
function openEditModal(id) {
  const u = allUsers.find(u=>u.id===id);
  if (!u || u.role==="Public") return;
  editingId = id;
  document.getElementById("modalTitle").textContent = "Edit User";
  document.getElementById("formUserId").value  = id;
  document.getElementById("fFirstName").value  = u.firstName || u.fullName?.split(" ")[0] || "";
  document.getElementById("fLastName").value   = u.lastName  || u.fullName?.split(" ").slice(1).join(" ") || "";
  document.getElementById("fEmail").value      = u.email || u.id;
  document.getElementById("fEmail").disabled   = true; // email = doc ID, cannot change
  document.getElementById("fRole").value       = u.role;
  document.getElementById("fStatus").value     = u.status || "Active";
  document.getElementById("passwordGroup").style.display        = "none";
  document.getElementById("confirmPasswordGroup").style.display = "none";
  updateAvatarPreview();
  clearFormErrors();
  renderPermGrid(u.permissions || []);
  openModal("userModalBackdrop");
}

/* ── Save ────────────────────────────────────────────── */
async function saveUser() {
  if (!validateForm()) return;
  const btn = document.getElementById("modalSaveBtn");
  btn.disabled = true; btn.textContent = "Saving…";

  try {
    const firstName   = document.getElementById("fFirstName").value.trim();
    const lastName    = document.getElementById("fLastName").value.trim();
    const email       = document.getElementById("fEmail").value.trim().toLowerCase();
    const role        = document.getElementById("fRole").value;
    const status      = document.getElementById("fStatus").value;
    const permissions = getCheckedPerms();

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
  const u = allUsers.find(u=>u.id===id);
  if (!u) return;
  const ini = initials(u), color = u.color||rndColor();
  const dname = displayName(u);
  const isPublic = u.role==="Public";
  const roleLabel = {Admin:"Administrator",Staff:"Staff",Public:"Public User"}[u.role]||u.role;
  const roleCls   = {Admin:"role-admin",Staff:"role-staff",Public:"role-public"}[u.role]||"role-public";

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
      : `<div class="view-perms-title"><i class="bi bi-key-fill me-1"></i> Permissions (${(u.permissions||[]).length})</div>
         <div class="view-perms-list">${(u.permissions||[]).length
           ? (u.permissions||[]).map(k=>`<span class="perm-tag">${labelPerm(k)}</span>`).join("")
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
  const u = allUsers.find(u=>u.id===id);
  if (!u) return;
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
  if (!fn) { setErr("errFirstName","First name required."); setInvalid("fFirstName"); ok=false; }
  if (!ln) { setErr("errLastName","Last name required.");   setInvalid("fLastName");  ok=false; }
  if (!em) { setErr("errEmail","Email required.");          setInvalid("fEmail");     ok=false; }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setErr("errEmail","Invalid email."); setInvalid("fEmail"); ok=false; }
  if (!ro) { setErr("errRole","Please select a role.");     setInvalid("fRole");      ok=false; }
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
  const r=document.getElementById("fRole")?.value;
  if (r) renderPermGrid(r==="Admin"?ADMIN_DEFAULT_PERMS:STAFF_DEFAULT_PERMS);
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

/* ── Sidebar Toggle ──────────────────────────────────── */
function bindSidebarToggle() {
  document.getElementById("sidebarToggle")?.addEventListener("click",()=>{
    const sb=document.getElementById("sidebar"), ct=document.getElementById("sidebar-container");
    if(window.innerWidth<=768){document.getElementById("mobile-nav-toggle")?.click();return;}
    const c=sb?.classList.toggle("collapsed");
    if(ct){ct.style.width=c?"64px":"";ct.style.minWidth=c?"64px":"";}
  });
}

/* ── Role badge CSS for Public (add to page) ─────────── */
function injectPublicRoleStyle() {
  const s=document.createElement("style");
  s.textContent=`.role-public{background:var(--rose-soft);color:var(--rose);}`;
  document.head.appendChild(s);
}

/* ── Init ────────────────────────────────────────────── */
async function init() {
  try {
    await protectManagementPage();
    if (getUserRole()!=="Admin") {
      showToast("error","Access denied — Administrators only.");
      setTimeout(()=>{window.location.href="/pages/dashboard.html";},1800);
      return;
    }
    injectPublicRoleStyle();
    loadSidebar(); renderTopbarUser(); bindSidebarToggle(); bindTabs();

    await loadUsers();

    document.getElementById("btnAddUser")?.addEventListener("click",openAddModal);
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