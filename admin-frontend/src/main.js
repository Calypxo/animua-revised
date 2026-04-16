import { handleRegistration } from "./auth/register.js";
import { handleLogin }        from "./auth/login.js";

// =============================================================================
// SECURITY TOGGLE — mirrors IS_INSECURE_MODE in the backend
// false = SECURE (Phase 4)
// true  = INSECURE (Phase 3)
// render: https://animua-backend.onrender.com "https://animua-backend.onrender.com/api"
// local:   http://localhost:5000
// =============================================================================
const IS_FRONTEND_INSECURE = false;

const API_URL = "https://animua-backend.onrender.com";

// ─── GLOBAL HELPERS ───────────────────────────────────────────────────────────
window.toggleView = function () {
    document.getElementById("login-section")?.classList.toggle("hidden");
    document.getElementById("register-section")?.classList.toggle("hidden");
};

// ─── BOOT ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    checkAuthStatus();

    // Splash screen
    const splash = document.getElementById("splash-screen");
    if (splash) {
        setTimeout(() => {
            splash.classList.add("fade-out");
            setTimeout(() => { splash.style.display = "none"; }, 800);
        }, 2000);
    }

    // Form listeners
    document.getElementById("register-form")?.addEventListener("submit", handleRegistration);
    document.getElementById("login-form")?.addEventListener("submit", handleLogin);

    // Logout
    document.getElementById("logout-btn")?.addEventListener("click", async (e) => {
        e.preventDefault();
        localStorage.clear();
        await Swal.fire({
            icon:             "info",
            title:            "Logged Out",
            text:             "Your session has been securely terminated.",
            timer:            1500,
            showConfirmButton: false
        });
        window.location.href = "/";
    });
});

// ─── AUTH STATUS CHECK ────────────────────────────────────────────────────────
async function checkAuthStatus() {
    const token = localStorage.getItem("authToken");
    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/api/auth/verify`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.role === "admin" || data.role === "staff") {
                // Redirect to dashboard if already logged in
                window.location.href = "/pages/dashboard.html";
            } else {
                // Not admin, logout
                localStorage.clear();
            }
        } else {
            localStorage.clear();
        }
    } catch (error) {
        console.error("Auth check failed:", error);
        localStorage.clear();
    }
}
