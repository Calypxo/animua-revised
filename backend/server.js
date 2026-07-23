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
const announcementRoutes = require("./src/routes/announcementRoutes");
const predictiveRoutes = require("./src/routes/predictiveRoutes");
const matchRoutes = require("./src/routes/matchRoutes");
const chatbotRoutes = require("./src/routes/chatbotRoutes");
const surrenderRoutes = require("./src/routes/surrenderRoutes");
const auditRoutes = require("./src/routes/auditRoutes");
const reportRoutes = require("./src/routes/reportRoutes");

const authenticateToken = require("./src/middleware/authMiddleware");
const authorizeRole = require("./src/middleware/roleMiddleware");
const { trainInventoryModel } = require("./src/services/predictiveService");

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
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
  "http://127.0.0.1:5179",
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin, like Postman, mobile apps, or server-to-server calls
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow localhost / 127.0.0.1 on any port during development
    if (
      origin.startsWith("http://localhost:") ||
      origin.startsWith("http://127.0.0.1:")
    ) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
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
app.use("/api/announcements", announcementRoutes);
app.use("/api/predictive", predictiveRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/surrenders", surrenderRoutes);
app.use("/api", matchRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/reports", reportRoutes);

app.get("/", (req, res) => {
  res.send("ANIMUA Backend is Live!");
});

// ─── PROTECTED ROUTES (JWT required) ─────────────────────────────────────────
app.get("/api/protected", authenticateToken, (req, res) => {
  res.json({
    message: "Access Granted!",
    user: req.user,
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
