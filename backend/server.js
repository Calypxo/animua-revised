require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

// Import Routes & Middleware
const authRoutes = require("./src/routes/authRoutes");
const authenticateToken = require("./src/middleware/authMiddleware");
const authorizeRole = require("./src/middleware/roleMiddleware");

// --- UPDATED CORS CONFIGURATION ---
// This allows your Firebase frontend to actually talk to this Render backend.
app.use(cors({
    origin: ["https://animua-angelescity.web.app"], 
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);

app.get("/", (req, res) => {
    res.send("ANIMUA Backend is Live and Running!");
});

// --- PROTECTED ROUTES ---
app.get("/api/protected", authenticateToken, (req, res) => {
    res.json({
        message: "Access Granted!",
        user: req.user
    });
});

app.get("/api/admin-only", authenticateToken, authorizeRole("Admin"), (req, res) => {
    res.json({ message: "Welcome, Admin!" });
});

app.get("/api/staff-only", authenticateToken, authorizeRole("Admin", "Staff"), (req, res) => {
    res.json({ message: "Welcome, Staff or Admin!" });
});

app.get("/api/public-user", authenticateToken, authorizeRole("Public", "Admin", "Staff"), (req, res) => {
    res.json({ message: "Welcome, logged-in user!" });
});

// --- UPDATED PORT LOGIC ---
// Render uses a dynamic port. process.env.PORT is mandatory.
const PORT = process.env.PORT || 10000; 

app.listen(PORT, "0.0.0.0", () => {
    console.log(`ANIMUA Server is active on port ${PORT}`);
});