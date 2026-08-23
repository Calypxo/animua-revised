// backend/src/controllers/userController.js
const { db, admin } = require("../config/firebase");
const bcrypt = require("bcryptjs");

const AVATAR_COLORS = [
  "#6f191c","#2558a8","#186534","#b86a00","#0d6e6e",
  "#9b2c4e","#3d2b8a","#1a6b5a","#7a3b00","#1a4e7a",
];

const ROLE_PERMISSIONS = {
  Admin: {
    dashboard: ["view"],
    users: ["view", "create", "edit", "delete"],
    surrender: ["view", "approve", "reject", "convert"],
    intake: ["view", "create", "edit", "approve", "reject", "convert"],
    animals: ["view", "edit_basic", "upload_photo", "send_to_quarantine", "edit_behavioral", "add_medical", "edit_medical", "set_clearance", "mark_ready", "process_adoption", "archive", "restore"],
    quarantine: ["view"],
    inventory: ["view", "create", "edit", "delete", "consume"],
    adoption: ["view", "review", "approve", "reject", "finalize"],
    reports: ["view"],
    archive: ["view", "restore"],
    audit: ["view"],
    announcements: ["view", "create", "edit", "delete", "publish"],
    compatibility: ["view", "manage"],
    contact: ["view", "reply"]
  },
  Staff: {
    dashboard: ["view"],
    animals: ["view", "edit_basic", "upload_photo", "process_adoption"],
    intake: ["view", "create", "edit", "approve", "reject", "convert"],
    surrender: ["view", "approve", "reject", "convert"],
    quarantine: ["view"],
    inventory: ["view", "consume"],
    adoption: ["view", "review", "approve", "reject", "finalize"],
    reports: ["view"],
    archive: ["view"],
    announcements: ["view", "create", "edit", "publish"],
    compatibility: ["view"],
    contact: ["view", "reply"]
  },
  Veterinarian: {
    dashboard: ["view"],
    animals: ["view", "send_to_quarantine", "edit_behavioral", "add_medical", "edit_medical", "set_clearance"],
    quarantine: ["view"],
    inventory: ["view", "consume"],
    reports: ["view"],
    archive: ["view"],
    announcements: ["view", "create", "edit", "publish"],
    compatibility: ["view"]
  },
  Public: {}
};

function getPermissionsForRole(role) {
  return Object.keys(ROLE_PERMISSIONS[role] || {});
}

// GET ALL USERS — optional ?role=Admin|Staff|Public|Veterinarian
exports.getAllUsers = async (req, res) => {
  try {
    const { role } = req.query;
    let query = db.collection("users");
    if (role && ["Admin","Staff","Veterinarian","Public"].includes(role)) {
      query = query.where("role","==",role);
    }
    const snapshot = await query.get();
    const users = snapshot.docs.map((doc) => {
      const { password, ...safe } = doc.data();
      return {
        id:          doc.id,
        email:       safe.email       || doc.id,
        fullName:    safe.fullName    || "",
        firstName:   safe.firstName   || "",
        lastName:    safe.lastName    || "",
        phone:       safe.phone       || "",
        role:        safe.role        || "Public",
        status:      safe.status      || "Active",
        permissions: safe.permissions || [],
        lastLogin:   safe.lastLogin   || null,
        createdAt:   safe.createdAt   || null,
        color:       safe.color       || "#6f191c",
      };
    });
    const summary = {
      total: users.length,
      admins: users.filter(u => u.role === "Admin").length,
      staff: users.filter(u => u.role === "Staff").length,
      veterinarians: users.filter(u => u.role === "Veterinarian").length,
      public: users.filter(u => u.role === "Public").length,
      active: users.filter(u => u.status === "Active").length,
      inactive: users.filter(u => u.status === "Inactive").length,
    };
    res.status(200).json({ users, summary });
  } catch (error) {
    console.error("[getAllUsers Error]", error.message);
    res.status(500).json({ message: "Failed to fetch users." });
  }
};

// GET SINGLE USER
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const userDoc = await db.collection("users").doc(id).get();
    if (!userDoc.exists) return res.status(404).json({ message: "User not found." });
    const { password, ...safeData } = userDoc.data();
    res.status(200).json({ user: { id: userDoc.id, ...safeData } });
  } catch (error) {
    console.error("[getUserById Error]", error.message);
    res.status(500).json({ message: "Failed to fetch user." });
  }
};

// CREATE USER — Admin/Staff only (Public users self-register)
exports.createUser = async (req, res) => {
  let createdAuthUser = null;
  let firestoreCreated = false;
  try {
    const { firstName, lastName, email, password, role, status, permissions, color } = req.body;
    if (!firstName || !lastName || !email || !password || !role) {
      return res.status(400).json({ message: "Required fields missing." });
    }
    if (!["Admin","Staff","Veterinarian"].includes(role)) {
      return res.status(400).json({ message: "Admin panel can only create management accounts. Public users self-register." });
    }
    if (status !== undefined && !["Active", "Inactive"].includes(status)) {
      return res.status(400).json({ message: "Invalid account status." });
    }
    const emailLower = email.trim().toLowerCase();
    const userRef = db.collection("users").doc(emailLower);
    const existing = await userRef.get();
    if (existing.exists) return res.status(409).json({ message: "Email is already in use." });

    try {
      await admin.auth().getUserByEmail(emailLower);
      return res.status(409).json({ message: "Email is already in use." });
    } catch (error) {
      if (error.code !== "auth/user-not-found") throw error;
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPw = await bcrypt.hash(password, salt);
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const assigned = color || AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const computedPermissions = getPermissionsForRole(role);
    const accountStatus = status || "Active";

    createdAuthUser = await admin.auth().createUser({
      email: emailLower,
      password,
      displayName: fullName,
      emailVerified: true,
      disabled: accountStatus === "Inactive",
    });

    await userRef.create({
      firstName: firstName.trim(), lastName: lastName.trim(), fullName,
      email: emailLower, password: hashedPw, role,
      status: accountStatus, permissions: computedPermissions,
      color: assigned, lastLogin: null,
      firebaseUid: createdAuthUser.uid,
      emailVerified: true,
      phoneVerified: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: req.user?.email || "system",
    });
    firestoreCreated = true;
    await writeAuditLog({ action:"user.created", module:"User Management",
      targetId: emailLower, targetName: fullName,
      performedBy: req.user?.email, performedByName: req.user?.fullName,
      after: { firstName, lastName, email: emailLower, role, status: accountStatus, permissions: computedPermissions },
    });
    res.status(201).json({ message: "User created successfully.", id: emailLower });
  } catch (error) {
    if (createdAuthUser && !firestoreCreated) {
      try {
        await admin.auth().deleteUser(createdAuthUser.uid);
      } catch (rollbackError) {
        console.error("[createUser Rollback Error]", rollbackError.message);
      }
    }
    console.error("[createUser Error]", error.message);
    if (error.code === "auth/email-already-exists" || error.code === 6 || error.code === "already-exists") {
      return res.status(409).json({ message: "Email is already in use." });
    }
    if (error.code === "auth/invalid-email" || error.code === "auth/invalid-password") {
      return res.status(400).json({ message: "Invalid email or password format." });
    }
    res.status(500).json({ message: "Failed to create user." });
  }
};

// UPDATE USER
// Admin/Staff: full edit. Public: status only. Role cross-promotion blocked.
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, role, status, permissions, color } = req.body;
    const userDoc = await db.collection("users").doc(id).get();
    if (!userDoc.exists) return res.status(404).json({ message: "User not found." });

    const before = userDoc.data();
    const isPublic = before.role === "Public";
    const targetRole = role || before.role;
    const computedPermissions = getPermissionsForRole(targetRole);

    if (before.role === "Admin" && (role === "Staff" || role === "Veterinarian" || role === "Public" || status === "Inactive")) {
      const activeAdminSnapshot = await db.collection("users")
        .where("role", "==", "Admin")
        .where("status", "==", "Active")
        .get();

      const otherActiveAdmins = activeAdminSnapshot.docs.filter(doc => doc.id !== id);

      if (otherActiveAdmins.length === 0) {
        return res.status(400).json({ message: "Cannot remove the last active Admin." });
      }
    }

    if (isPublic && role && role !== "Public") {
      return res.status(400).json({ message: "Cannot promote a Public user to Admin or Staff." });
    }
    if (!isPublic && role === "Public") {
      return res.status(400).json({ message: "Cannot demote an Admin/Staff account to Public." });
    }

    const updates = {};
    if (!isPublic) {
      if (firstName !== undefined) updates.firstName = firstName.trim();
      if (lastName !== undefined) updates.lastName = lastName.trim();
      if (firstName && lastName) updates.fullName = `${firstName.trim()} ${lastName.trim()}`;
      if (role !== undefined) updates.role = role;
      updates.permissions = computedPermissions;
      if (color !== undefined) updates.color = color;
    }
    if (status !== undefined) updates.status = status;
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    updates.updatedBy = req.user?.email || "system";

    await db.collection("users").doc(id).update(updates);
    await writeAuditLog({ action:"user.updated", module:"User Management",
      targetId: id, targetName: updates.fullName || before.fullName,
      performedBy: req.user?.email, performedByName: req.user?.fullName,
      before: { role: before.role, status: before.status },
      after:  { role: updates.role, status: updates.status },
    });
    res.status(200).json({ message: "User updated successfully." });
  } catch (error) {
    console.error("[updateUser Error]", error.message);
    res.status(500).json({ message: "Failed to update user." });
  }
};

// TOGGLE STATUS — works for ALL roles
exports.toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userDoc = await db.collection("users").doc(id).get();
    if (!userDoc.exists) return res.status(404).json({ message: "User not found." });
    if (id === req.user?.email) {
      return res.status(400).json({ message: "You cannot deactivate your own account." });
    }
    const current   = userDoc.data();
    const newStatus = current.status === "Active" ? "Inactive" : "Active";

    if (id === req.user?.email || id === req.user?.id) {
      return res.status(400).json({ message: "You cannot deactivate your own account." });
    }

    if (current.role === "Admin" && newStatus === "Inactive") {
      const activeAdminSnapshot = await db.collection("users")
        .where("role", "==", "Admin")
        .where("status", "==", "Active")
        .get();

      const otherActiveAdmins = activeAdminSnapshot.docs.filter(doc => doc.id !== id);

      if (otherActiveAdmins.length === 0) {
        return res.status(400).json({ message: "Cannot remove the last active Admin." });
      }
    }

    await db.collection("users").doc(id).update({
      status: newStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.user?.email,
    });
    await writeAuditLog({ action: newStatus === "Active" ? "user.activated" : "user.deactivated",
      module:"User Management", targetId: id, targetName: current.fullName,
      performedBy: req.user?.email, performedByName: req.user?.fullName,
      before: { status: current.status }, after: { status: newStatus },
    });
    res.status(200).json({ message: `User ${newStatus === "Active" ? "activated" : "deactivated"}.`, status: newStatus });
  } catch (error) {
    console.error("[toggleUserStatus Error]", error.message);
    res.status(500).json({ message: "Failed to update status." });
  }
};

// RESET PASSWORD — Admin/Staff only, Public users use public portal
// UPDATE LAST LOGIN (internal helper)
exports.updateLastLogin = async (email) => {
  try {
    await db.collection("users").doc(email).update({
      lastLogin: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn("[updateLastLogin]", err.message);
  }
};

// AUDIT LOG HELPER
async function writeAuditLog({ action, module, targetId, targetName, performedBy, performedByName, before = {}, after = {} }) {
  try {
    await db.collection("auditLogs").add({
      action, module,
      targetId: targetId || "", targetName: targetName || "",
      performedBy: performedBy || "system",
      performedByName: performedByName || "System",
      before, after,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn("[auditLog] Failed to write:", err.message);
  }
}
