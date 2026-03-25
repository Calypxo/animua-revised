require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

const authRoutes = require("./src/routes/authRoutes");
const petRoutes = require("./src/routes/petRoutes");
const authenticateToken = require("./src/middleware/authMiddleware");
const authorizeRole = require("./src/middleware/roleMiddleware");

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    "https://animua-angelescity.web.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173"
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

app.use(express.json());

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/pets", petRoutes);

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

// Role-gated routes
app.get("/api/admin-only",
  authenticateToken,
  authorizeRole("Admin"),
  (req, res) => res.json({ message: "Welcome, Admin!" })
);

app.get("/api/staff-only",
  authenticateToken,
  authorizeRole("Admin", "Staff"),
  (req, res) => res.json({ message: "Welcome, Staff or Admin!" })
);

app.get("/api/public-user",
  authenticateToken,
  authorizeRole("Public", "Admin", "Staff"),
  (req, res) => res.json({ message: "Welcome, logged-in user!" })
);

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`ANIMUA Server active on port ${PORT}`);
});