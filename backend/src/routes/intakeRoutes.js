// backend/src/routes/intakeRoutes.js
const express    = require("express");
const router     = express.Router();
const ctrl       = require("../controllers/intakeController");

const auth       = require("../middleware/authMiddleware");
const authorize  = require("../middleware/roleMiddleware");

// All routes require a valid JWT
router.use(auth);

// Admin + Staff can view and create
// Only Admin can approve, reject, convert

// GET  /api/intake           → list all (with optional ?status= ?source= ?species=)
router.get("/",                    authorize("Admin","Staff"), ctrl.getAllIntake);

// GET  /api/intake/:id       → single record
router.get("/:id",                 authorize("Admin","Staff"), ctrl.getIntakeById);

// POST /api/intake           → create new intake record (Pending or Draft)
router.post("/",                   authorize("Admin","Staff"), ctrl.createIntake);

// PUT  /api/intake/:id       → update (Pending / Draft only)
router.put("/:id",                 authorize("Admin","Staff"), ctrl.updateIntake);

// PATCH /api/intake/:id/approve → approve
router.patch(
  "/:id/approve",
  authorize("Admin", "Staff"),
  ctrl.approveIntake
);

router.patch(
  "/:id/reject",
  authorize("Admin", "Staff"),
  ctrl.rejectIntake
);

// POST /api/intake/:id/convert → convert to Animal Profile
router.post(
  "/:id/convert",
  authorize("Admin", "Staff"),
  ctrl.convertToProfile
);

module.exports = router;