import { handleRegistration } from "./auth/register.js";
import { handleLogin } from "./auth/login.js";

// ─── 1. CONFIGURATION & AUDIT TOGGLES ───
// Set IS_FRONTEND_INSECURE to 'true' only during the "Broken Auth" demo for Sir Kiko.
const IS_FRONTEND_INSECURE = true; 

// Toggle between Localhost (for your Laptop Audit) and Render (for Live Production)
const API_URL = "http://localhost:5000"; 
// const API_URL = "https://animua.onrender.com";

/**
 * Global Toggle View
 * Switches between Login and Register forms on index.html
 */
window.toggleView = function () {
    const loginSection = document.getElementById("login-section");
    const registerSection = document.getElementById("register-section");

    if (loginSection && registerSection) {
        loginSection.classList.toggle("hidden");
        registerSection.classList.toggle("hidden");
    }
};

document.addEventListener("DOMContentLoaded", () => {
    // ─── 2. SECURITY GATEKEEPER ───
    // Runs immediately to check if the current user belongs on this page.
    checkAuthStatus();

    // ─── 3. SPLASH SCREEN LOGIC ───
    // This ensures the splash screen fades out after 2 seconds.
    const splash = document.getElementById("splash-screen");
    if (splash) {
        console.log("Animua System Initializing...");
        setTimeout(() => {
            splash.classList.add("fade-out");
            setTimeout(() => {
                splash.style.display = "none";
            }, 800); // Wait for the CSS opacity transition
        }, 2000); 
    }

    // ─── 4. FORM EVENT LISTENERS ───
    const regForm = document.getElementById("register-form");
    if (regForm) {
        regForm.addEventListener("submit", handleRegistration);
    }

    const loginForm = document.getElementById("login-form");
    if (loginForm) {
        loginForm.addEventListener("submit", handleLogin);
    }

    // ─── 5. SECURE LOGOUT HANDLER ───
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async (event) => {
            event.preventDefault();

            // Total Wipeout: Clears Token, Role, Name, and Email
            localStorage.clear();

            await Swal.fire({
                icon: 'info',
                title: 'Logged Out',
                text: 'Your session has been securely terminated.',
                timer: 1500,
                showConfirmButton: false,
                timerProgressBar: true
            });

            // Redirect back to the entry point
            window.location.href = "/";
        });
    }
});

/**
 * ─── 6. RBAC & JWT VERIFICATION ENGINE ───
 * This is the primary proof that your JWT is EFFECTIVE.
 * It performs a cryptographic handshake with the backend on every page load.
 */
async function checkAuthStatus() {
    const token = localStorage.getItem("animua_token");
    const role = localStorage.getItem("user_role");
    const currentPath = window.location.pathname;

    // If no session exists, we treat them as a Guest
    if (!token || !role) return;

    try {
        // --- STEP A: THE SILENT HANDSHAKE ---
        // Verify the token signature against the Server's Secret Key
        const response = await fetch(`${API_URL}/api/protected`, {
            method: "GET",
            headers: { 
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        // --- STEP B: TERMINATION ON FAILURE ---
        // If the server rejects the token (Expired or Fake), wipe the session.
        if (!response.ok) {
            console.error("JWT Verification Failed: Invalid Signature.");
            localStorage.clear();
            if (currentPath.includes("/pages/management/")) {
                window.location.href = "/";
            }
            return;
        }

        const data = await response.json();

        // --- STEP C: INTEGRITY GUARD (THE "HACK" PROTECTOR) ---
        // If the role in LocalStorage was edited in the console, it won't match the signed JWT.
        if (!IS_FRONTEND_INSECURE) {
            if (data.user.role !== role) {
                console.error("Integrity Mismatch: Local role tampered.");
                localStorage.clear();
                window.location.href = "/";
                return;
            }
        } else {
            console.warn("AUDIT MODE ENABLED: Frontend Integrity Check Bypassed.");
        }

        // --- STEP D: ROUTING LOGIC (RBAC) ---
        const isIndexPage = currentPath === "/" || currentPath.endsWith("/index.html") || currentPath.includes("index.html");
        const isAdminLoginPage = currentPath.includes("/pages/management/admin-login.html");
        const isDashboardPage = currentPath.includes("/pages/management/dashboard.html");

        // Logic for Management (Admin/Staff)
        if (role === "Admin" || role === "Staff") {
            if (isIndexPage || isAdminLoginPage) {
                window.location.href = "/pages/management/dashboard.html";
                return;
            }
        }

        // Logic for Public Users
        if (role === "Public") {
            if (isAdminLoginPage || isDashboardPage) {
                alert("Access Denied: High-privilege credentials required.");
                window.location.href = "/";
                return;
            }
        }

    } catch (error) {
        console.error("Auth System Error (Network/Server):", error);
        // We do not clear storage here to prevent kicking users out during 1-second signal drops.
    }
}