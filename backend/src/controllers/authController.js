const { db, admin } = require("../config/firebase");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.register = async (req, res) => {
    try {
        const fullName = req.body.fullName?.trim();
        const email = req.body.email?.trim().toLowerCase();
        const password = req.body.password;

        if (!fullName || !email || !password) {
            return res.status(400).json({ message: "All fields are required." });
        }

        const userDoc = await db.collection("users").doc(email).get();

        if (userDoc.exists) {
            return res.status(409).json({ message: "Email already registered." });
        }

        const salt = await bcrypt.genSalt(12); // Increased salt rounds for better security 10 to 12
        const hashedPassword = await bcrypt.hash(password, salt);

        await db.collection("users").doc(email).set({
            fullName,
            email,
            password: hashedPassword,
            role: "Public",
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(201).json({ message: "Registration successful!" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const email = req.body.email?.trim().toLowerCase();
        const password = req.body.password;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required." });
        }

        const userDoc = await db.collection("users").doc(email).get();

        if (!userDoc.exists) {
            return res.status(404).json({ message: "User not found." });
        }

        const userData = userDoc.data();

        const isMatch = await bcrypt.compare(password, userData.password);

        if (!isMatch) {
            return res.status(401).json({ message: "Incorrect password." });
        }

        const token = jwt.sign(
            {
                email: userData.email,
                fullName: userData.fullName,
                role: userData.role
            },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        res.status(200).json({
            message: "Login successful!",
            token,
            role: userData.role,
            fullName: userData.fullName
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};