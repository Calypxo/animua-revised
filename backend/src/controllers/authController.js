const { db, admin } = require("../config/firebase");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// =============================================================================
// 🔬 AUDIT TOGGLE — mirrors the Lab Activity Phases
// IS_INSECURE_MODE = true  → Phase 3 (Vulnerable): plain text + no signature check
// IS_INSECURE_MODE = false → Phase 4 (Secure Fix): Bcrypt + signed JWT
// =============================================================================
const IS_INSECURE_MODE = false;

// ─── REGISTER ────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
    try {
        const fullName = req.body.fullName?.trim();
        const email    = req.body.email?.trim().toLowerCase();
        const password = req.body.password;

        if (!fullName || !email || !password) {
            return res.status(400).json({ message: "All fields are required." });
        }

        const userDoc = await db.collection("users").doc(email).get();
        if (userDoc.exists) {
            return res.status(409).json({ message: "Email already registered." });
        }

        let storedPassword;

        if (IS_INSECURE_MODE) {
            // ⚠️  PHASE 3 (Vulnerable): Plain-text — readable in Firebase & via Wireshark
            storedPassword = password;
            console.log(`[AUDIT - INSECURE] Registering ${email} with PLAIN TEXT password.`);
        } else {
            // ✅  PHASE 4 (Secure Fix): Bcrypt work factor 12
            //     Each additional cost bit doubles the computation time,
            //     making brute-force attacks exponentially slower.
            const salt = await bcrypt.genSalt(12);
            storedPassword = await bcrypt.hash(password, salt);
            console.log(`[AUDIT - SECURE] Registering ${email} with BCRYPT (cost 12) hash.`);
        }

        await db.collection("users").doc(email).set({
            fullName,
            email,
            password: storedPassword,
            role: "Public",
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(201).json({ message: "Registration successful!" });

    } catch (error) {
        console.error("[Register Error]", error.message);
        res.status(500).json({ message: "Internal server error." });
    }
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
    try {
        const email    = req.body.email?.trim().toLowerCase();
        const password = req.body.password;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required." });
        }

        const userDoc = await db.collection("users").doc(email).get();
        if (!userDoc.exists) {
            // Generic message — don't reveal whether the email exists (enumeration attack)
            return res.status(401).json({ message: "Invalid email or password." });
        }

        const userData = userDoc.data();
        let isMatch = false;

        if (IS_INSECURE_MODE) {
            // ⚠️  PHASE 3 (Vulnerable): Direct string comparison
            //     Fast, sniffable, and vulnerable to rainbow-table lookup
            isMatch = (password === userData.password);
            console.log(`[AUDIT - INSECURE] Direct password comparison for ${email}.`);
        } else {
            // ✅  PHASE 4 (Secure Fix): bcrypt.compare() applies the same cost factor
            //     as the stored hash — computationally expensive per attempt
            isMatch = await bcrypt.compare(password, userData.password);
            console.log(`[AUDIT - SECURE] Bcrypt comparison complete for ${email}.`);
        }

        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email or password." });
        }

        // ─── JWT CREATION ─────────────────────────────────────────────────────
        // Structure mirrors the lab: Header (auto) . Payload (claims) . Signature (HMAC-SHA256)
        // The SECRET KEY is what the Packet Tracer lab simplified as "2026"
        // In production, this is a 256-bit random string stored in .env
        const token = jwt.sign(
            {
                email:    userData.email,
                fullName: userData.fullName,
                role:     userData.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn:  "1h",
                algorithm:  "HS256"   // Explicitly set — prevents "Algorithm: None" attack
            }
        );

        console.log(`[JWT ISSUED] Role: ${userData.role} | Expires: 1h`);

        res.status(200).json({
            message:  "Login successful!",
            token,
            role:     userData.role,
            fullName: userData.fullName
        });

    } catch (error) {
        console.error("[Login Error]", error.message);
        res.status(500).json({ message: "Internal server error." });
    }
};