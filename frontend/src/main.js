import { handleRegistration } from "./auth/register.js";
import { handleLogin } from "./auth/login.js";

// ─── CONFIGURATION & AUDIT TOGGLES ───
// Switch this to true to demonstrate the "Broken Auth" vulnerability for Sir Kiko.
const IS_FRONTEND_INSECURE = true; 

// Switch between Localhost (Audit) and Render (Production)
const API_URL = "http://localhost:5000"; 
// const API_URL = "https://animua.onrender.com";

/**
 * Toggle between login and register sections in the UI.
 * Connects to the "Sign Up" / "Back to Login" links on your index page.
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
    // 1. IMMEDIATE SECURITY CHECK
    // Runs before the splash screen finishes to ensure unauthorized users are caught.
    checkAuthStatus();

    // 2. SPLASH SCREEN LOGIC
    const splash = document.getElementById("splash-screen");
    if (splash) {
        setTimeout(() => {
            splash.classList.add("fade-out");
            setTimeout(() => {
                splash.style.display = "none";
            }, 800);
        }, 2000);
    }

    // 3. AUTHENTICATION FORM LISTENERS
    const regForm = document.getElementById("register-form");
    if (regForm) {
        regForm.addEventListener("submit", handleRegistration);
    }

    const loginForm = document.getElementById("login-form");
    if (loginForm) {
        loginForm.addEventListener("submit", handleLogin);
    }

    // 4. CENTRALIZED LOGOUT LOGIC
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async (event) => {
            event.preventDefault();

            // Clear all session data to ensure a clean slate
            localStorage.clear();

            // Professional Feedback using SweetAlert2
            await Swal.fire({
                icon: 'info',
                title: 'Logged Out',
                text: 'Your session has been securely terminated.',
                timer: 2000,
                showConfirmButton: false,
                timerProgressBar: true
            });

            window.location.href = "/";
        });
    }
});

/**
 * RBAC & JWT Verification Logic
 * This is the CORE of your security demo. 
 * It proves JWT effectiveness by validating the cryptographic signature.
 */
async function checkAuthStatus() {
    const token = localStorage.getItem("animua_token");
    const role = localStorage.getItem("user_role");
    const currentPath = window.location.pathname;

    // If no session exists, we stay in Guest Mode (No redirect needed for public pages)
    if (!token || !role) return;

    try {
        // ─── THE JWT EFFECTIVENESS TEST ───
        // We ping the protected route to see if the server accepts this token's signature.
        const response = await fetch(`${API_URL}/api/protected`, {
            method: "GET",
            headers: { 
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        // If the server rejects the token (Expired, Fake, or Tampered)
        if (!response.ok) {
            console.warn("Security Alert: Invalid JWT detected. Terminating session.");
            localStorage.clear();
            
            // If the user was trying to access management pages, kick them to the root
            if (currentPath.includes("/pages/management/")) {
                window.location.href = "/";
            }
            return;
        }

        const data = await response.json();

        // ─── INTEGRITY CHECK (MODIFIED FOR AUDIT) ───
        // In SECURED mode, we check if the role in LocalStorage matches the JWT Payload.
        if (!IS_FRONTEND_INSECURE) {
            if (data.user.role !== role) {
                console.error("Integrity Mismatch: Local role does not match JWT claim.");
                localStorage.clear();
                window.location.href = "/";
                return;
            }
        } else {
            console.warn("AUDIT MODE: Frontend Integrity Check is BYPASSED.");
        }

        // ─── REDIRECT LOGIC (Role-Based Access Control) ───
        const isIndexPage = currentPath === "/" || currentPath.endsWith("/index.html") || currentPath.includes("index.html");
        const isAdminLoginPage = currentPath.includes("/pages/management/admin-login.html");
        const isDashboardPage = currentPath.includes("/pages/management/dashboard.html");

        // Management Personnel (Admin/Staff)
        if (role === "Admin" || role === "Staff") {
            // Push them to the dashboard if they are on landing/login pages
            if (isIndexPage || isAdminLoginPage) {
                window.location.href = "/pages/management/dashboard.html";
                return;
            }
        }

        // Public Users
        if (role === "Public") {
            // Block Public users from accessing the Management Login URL
            if (isAdminLoginPage) {
                alert("Access Denied: Management credentials required.");
                window.location.href = "/";
                return;
            }
        }

    } catch (error) {
        console.error("Auth System Error:", error);
    }
}