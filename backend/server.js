require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

const authRoutes = require("./src/routes/authRoutes");
const userRoutes = require("./src/routes/userRoutes");
const intakeRoutes = require("./src/routes/intakeRoutes");
const animalRoutes = require("./src/routes/animalRoutes");
const dashboardRoutes = require("./src/routes/dashboardRoutes");

const publicRoutes = require("./src/routes/publicRoutes");
const adoptionRoutes = require("./src/routes/adoptionRoutes");
const predictiveRoutes = require("./src/routes/predictiveRoutes");
const matchRoutes = require("./src/routes/matchRoutes");
const surrenderRoutes = require("./src/routes/surrenderRoutes");

const authenticateToken = require("./src/middleware/authMiddleware");
const authorizeRole = require("./src/middleware/roleMiddleware");
const { trainInventoryModel } = require("./src/services/predictiveService");

// ─── CORS ─────────────────────────────────────────────────────────────────────
const corsOptions = {
  origin: [
    "https://animua-angelescity.web.app",
    "https://animua-admin.web.app",

    "http://localhost:5173",
    "http://127.0.0.1:5173",

    "http://localhost:5174",
    "http://127.0.0.1:5174",

    "http://localhost:5175",
    "http://127.0.0.1:5175",

    "http://localhost:5176",
    "http://127.0.0.1:5176",

    "http://localhost:5177",
    "http://127.0.0.1:5177",

    "http://localhost:5179",
    "http://127.0.0.1:5179"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(express.json());

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/intake", intakeRoutes);
app.use("/api/animals", animalRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use("/api/public", publicRoutes);
app.use("/api/adoptions", adoptionRoutes);
app.use("/api/predictive", predictiveRoutes);
app.use("/api/surrenders", surrenderRoutes);
app.use("/api", matchRoutes);

app.get("/", (req, res) => {
  res.send("ANIMUA Backend is Live!");
});

// ─── PROTECTED ROUTES (JWT required) ─────────────────────────────────────────
app.get("/api/protected", authenticateToken, (req, res) => {
  res.json({
    message: "Access Granted!",
    user: req.user
  });
});

app.get(
  "/api/admin-only",
  authenticateToken,
  authorizeRole("Admin"),
  (req, res) => res.json({ message: "Welcome, Admin!" })
);

app.get(
  "/api/staff-only",
  authenticateToken,
  authorizeRole("Admin", "Staff"),
  (req, res) => res.json({ message: "Welcome, Staff or Admin!" })
);

app.get(
  "/api/public-user",
  authenticateToken,
  authorizeRole("Public", "Admin", "Staff"),
  (req, res) => res.json({ message: "Welcome, logged-in user!" })
);

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ANIMUA Server active on port ${PORT}`);

  trainInventoryModel()
    .then((summary) => {
      console.log("Predictive model trained on startup.");
      console.log(summary);
    })
    .catch((error) => {
      console.error("Startup training failed:", error.message);
    });
});