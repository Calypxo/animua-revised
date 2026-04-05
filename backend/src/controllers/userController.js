// backend/src/controllers/userController.js
const { db, admin } = require("../config/firebase");
const bcrypt = require("bcryptjs");

const AVATAR_COLORS = [
  "#6f191c","#2558a8","#186534","#b86a00","#0d6e6e",
  "#9b2c4e","#3d2b8a","#1a6b5a","#7a3b00","#1a4e7a",
];

// GET ALL USERS — optional ?role=Admin|Staff|Public
exports.getAllUsers = async (req, res) => {
  try {
    const { role } = req.query;
    let query = db.collection("users");
    if (role && ["Admin","Staff","Public"].includes(role)) {
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
        role:        safe.role        || "Public",
        status:      safe.status      || "Active",
        permissions: safe.permissions || [],
        lastLogin:   safe.lastLogin   || null,
        createdAt:   safe.createdAt   || null,
        color:       safe.color       || "#6f191c",
      };
    });
    const summary = {
      total:    users.length,
      admins:   users.filter(u => u.role === "Admin").length,
      staff:    users.filter(u => u.role === "Staff").length,
      public:   users.filter(u => u.role === "Public").length,
      active:   users.filter(u => u.status === "Active").length,
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
  try {
    const { firstName, lastName, email, password, role, status, permissions, color } = req.body;
    if (!firstName || !lastName || !email || !password || !role) {
      return res.status(400).json({ message: "Required fields missing." });
    }
    if (!["Admin","Staff"].includes(role)) {
      return res.status(400).json({ message: "Admin panel can only create Admin or Staff accounts. Public users self-register." });
    }
    const emailLower = email.trim().toLowerCase();
    const existing = await db.collection("users").doc(emailLower).get();
    if (existing.exists) return res.status(409).json({ message: "Email is already in use." });

    const salt     = await bcrypt.genSalt(12);
    const hashedPw = await bcrypt.hash(password, salt);
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const assigned = color || AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    await db.collection("users").doc(emailLower).set({
      firstName: firstName.trim(), lastName: lastName.trim(), fullName,
      email: emailLower, password: hashedPw, role,
      status: status || "Active", permissions: permissions || [],
      color: assigned, lastLogin: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: req.user?.email || "system",
    });
    await writeAuditLog({ action:"user.created", module:"User Management",
      targetId: emailLower, targetName: fullName,
      performedBy: req.user?.email, performedByName: req.user?.fullName,
      after: { firstName, lastName, email: emailLower, role, status, permissions },
    });
    res.status(201).json({ message: "User created successfully.", id: emailLower });
  } catch (error) {
    console.error("[createUser Error]", error.message);
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

    const before   = userDoc.data();
    const isPublic = before.role === "Public";

    if (isPublic && role && role !== "Public") {
      return res.status(400).json({ message: "Cannot promote a Public user to Admin or Staff." });
    }
    if (!isPublic && role === "Public") {
      return res.status(400).json({ message: "Cannot demote an Admin/Staff account to Public." });
    }

    const updates = {};
    if (!isPublic) {
      if (firstName   !== undefined) updates.firstName   = firstName.trim();
      if (lastName    !== undefined) updates.lastName    = lastName.trim();
      if (firstName && lastName)     updates.fullName    = `${firstName.trim()} ${lastName.trim()}`;
      if (role        !== undefined) updates.role        = role;
      if (permissions !== undefined) updates.permissions = permissions;
      if (color       !== undefined) updates.color       = color;
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
exports.resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }
    const userDoc = await db.collection("users").doc(id).get();
    if (!userDoc.exists) return res.status(404).json({ message: "User not found." });
    const userData = userDoc.data();
    if (userData.role === "Public") {
      return res.status(400).json({ message: "Cannot reset a Public user's password from the admin panel." });
    }
    const salt   = await bcrypt.genSalt(12);
    const hashed = await bcrypt.hash(newPassword, salt);
    await db.collection("users").doc(id).update({
      password: hashed,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.user?.email,
    });
    await writeAuditLog({ action:"user.password_reset", module:"User Management",
      targetId: id, targetName: userData.fullName,
      performedBy: req.user?.email, performedByName: req.user?.fullName,
    });
    res.status(200).json({ message: "Password reset successfully." });
  } catch (error) {
    console.error("[resetPassword Error]", error.message);
    res.status(500).json({ message: "Failed to reset password." });
  }
};

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