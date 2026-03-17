require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

const authRoutes = require("./src/routes/authRoutes");
const authenticateToken = require("./src/middleware/authMiddleware");
const authorizeRole = require("./src/middleware/roleMiddleware");

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);

app.get("/", (req, res) => {
    res.send("ANIMUA Backend Running");
});

app.get("/api/protected", authenticateToken, (req, res) => {
    res.json({
        message: "You accessed a protected route!",
        user: req.user
    });
});

app.get("/api/admin-only", authenticateToken, authorizeRole("Admin"), (req, res) => {
    res.json({ message: "Welcome Admin!" });
});

app.get("/api/staff-only", authenticateToken, authorizeRole("Admin", "Staff"), (req, res) => {
    res.json({ message: "Welcome Staff or Admin!" });
});

app.get("/api/public-user", authenticateToken, authorizeRole("Public", "Admin", "Staff"), (req, res) => {
    res.json({ message: "Welcome logged-in user!" });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});
