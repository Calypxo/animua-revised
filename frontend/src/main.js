import { handleRegistration } from "./auth/register.js";
import { handleLogin } from "./auth/login.js";

// ─── 1. CONFIGURATION & AUDIT TOGGLES ───
// Set IS_FRONTEND_INSECURE to 'true' to allow the Console Hack.
const IS_FRONTEND_INSECURE = true; 

// Toggle between Localhost and Render
const API_URL = "http://localhost:5000"; 
// const API_URL = "https://animua.onrender.com";

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
    const role = localStorage.getItem("user_role"); // This is your "Console Hack" variable
    const currentPath = window.location.pathname;

    if (!token || !role) return;

    try {
        const response = await fetch(`${API_URL}/api/protected`, {
            method: "GET",
            headers: { 
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        const data = await response.json();

        // STEP A: SECURITY CHECK
        if (!IS_FRONTEND_INSECURE) {
            // SECURED MODE: Check if LocalStorage role matches Server's Signed Role
            if (!response.ok || data.user.role !== role) {
                console.error("JWT Verification Failed.");
                localStorage.clear();
                if (currentPath.includes("/pages/management/")) {
                    window.location.href = "/";
                }
                return;
            }
        } else {
            // INSECURE AUDIT MODE: Allow the fetch to fail or mismatch, but keep the role you set
            console.warn("AUDIT MODE: Bypassing Integrity Check.");
        }

        // STEP B: ROUTING LOGIC
        const isManagementPath = currentPath.includes("/pages/management/");
        const isDashboard = currentPath.includes("dashboard.html");
        const isLoginOrIndex = currentPath === "/" || currentPath.endsWith("index.html") || currentPath.includes("admin-login.html");

        // Logic for Management (Admin/Staff)
        if (role === "Admin" || role === "Staff") {
            // Only redirect if they are NOT already on the dashboard
            if (isLoginOrIndex && !isDashboard) {
                window.location.href = "/pages/management/dashboard.html";
            }
            return; // STOP here. Allow access.
        }

        // Logic for Public Users
        if (role === "Public" && isManagementPath) {
            alert("Access Denied: Management credentials required.");
            window.location.href = "/";
        }

    } catch (error) {
        console.error("Connection error:", error);
    }
}