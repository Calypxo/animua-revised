import { handleRegistration } from "./auth/register.js";
import { handleLogin } from "./auth/login.js";

// ─── 1. PRODUCTION CONFIGURATION ───
// Set to FALSE so the hosted site is SECURE by default.
const IS_FRONTEND_INSECURE = false; 

// The live URL of your Render Backend
// const API_URL = "http://localhost:5000";
const API_URL = "https://animua.onrender.com";

window.toggleView = function () {
    const loginSection = document.getElementById("login-section");
    const registerSection = document.getElementById("register-section");
    if (loginSection && registerSection) {
        loginSection.classList.toggle("hidden");
        registerSection.classList.toggle("hidden");
    }
};

document.addEventListener("DOMContentLoaded", () => {
    // 2. SECURITY GATEKEEPER
    checkAuthStatus();

    // 3. SPLASH SCREEN LOGIC
    const splash = document.getElementById("splash-screen");
    if (splash) {
        setTimeout(() => {
            splash.classList.add("fade-out");
            setTimeout(() => {
                splash.style.display = "none";
            }, 800);
        }, 2000); 
    }

    // 4. FORM LISTENERS
    const regForm = document.getElementById("register-form");
    if (regForm) regForm.addEventListener("submit", handleRegistration);

    const loginForm = document.getElementById("login-form");
    if (loginForm) loginForm.addEventListener("submit", handleLogin);

    // 5. LOGOUT HANDLER
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async (event) => {
            event.preventDefault();
            localStorage.clear();
            await Swal.fire({
                icon: 'info',
                title: 'Logged Out',
                text: 'Your session has been securely terminated.',
                timer: 1500,
                showConfirmButton: false
            });
            window.location.href = "/";
        });
    }
});

/**
 * ─── 6. RBAC & JWT VERIFICATION ENGINE ───
 */
async function checkAuthStatus() {
    const token = localStorage.getItem("animua_token");
    const role = localStorage.getItem("user_role");
    const currentPath = window.location.pathname;

    // If no one is logged in, we don't need to ping the server
    if (!token || !role) return;

    try {
        const response = await fetch(`${API_URL}/api/protected`, {
            method: "GET",
            headers: { 
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        // Handle case where server rejects the token
        if (!response.ok) {
            console.error("Session Invalid or Expired.");
            localStorage.clear();
            if (currentPath.includes("/pages/management/")) {
                window.location.href = "/";
            }
            return;
        }

        const data = await response.json();

        // STEP A: INTEGRITY CHECK (Ensures role wasn't tampered with)
        if (!IS_FRONTEND_INSECURE) {
            if (data.user.role !== role) {
                localStorage.clear();
                window.location.href = "/";
                return;
            }
        }

        // STEP B: ROUTING LOGIC
        const isManagementPath = currentPath.includes("/pages/management/");
        const isDashboard = currentPath.includes("dashboard.html");
        const isLoginOrIndex = currentPath === "/" || currentPath.endsWith("index.html") || currentPath.includes("admin-login.html");

        if (role === "Admin" || role === "Staff") {
            if (isLoginOrIndex && !isDashboard) {
                window.location.href = "/pages/management/dashboard.html";
            }
            return;
        }

        if (role === "Public" && isManagementPath) {
            window.location.href = "/";
        }

    } catch (error) {
        // This usually triggers if Render is still "waking up"
        console.warn("Backend connection pending... (Render Cold Start)");
    }
}