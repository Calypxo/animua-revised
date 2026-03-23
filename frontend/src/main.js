import { handleRegistration } from "./auth/register.js";
import { handleLogin }        from "./auth/login.js";

// =============================================================================
// SECURITY TOGGLE — mirrors IS_INSECURE_MODE in the backend
// false = SECURE (Phase 4): Role integrity check is enforced
// true  = INSECURE (Phase 3): Role check skipped — spoofable via DevTools
// render: https://animua.onrender.com to see the secure version in action
// local:   http://localhost:5000 to test the insecure version (Wireshark-friendly)
// =============================================================================
const IS_FRONTEND_INSECURE = false;
// =============================================================================
const API_URL = "https://animua.onrender.com";

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

// ─── JWT VERIFICATION ENGINE ──────────────────────────────────────────────────
/**
 * checkAuthStatus
 *
 * On every page load:
 *  1. Reads the stored JWT from localStorage
 *  2. Sends it to /api/protected — the server verifies the HMAC-SHA256 signature
 *  3. Compares the server-returned role with localStorage (tamper detection)
 *  4. Redirects based on role and current path
 *
 * This is the real-world equivalent of the lab's Phase 4 "Security Fix" —
 * the server, not the client, decides who is authorized.
 */
async function checkAuthStatus() {
    const token       = localStorage.getItem("animua_token");
    const role        = localStorage.getItem("user_role");
    const currentPath = window.location.pathname;

    if (!token || !role) return; // Not logged in — nothing to check

    try {
        const response = await fetch(`${API_URL}/api/protected`, {
            method:  "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type":  "application/json"
            }
        });

        if (!response.ok) {
            // Token expired or tampered — boot the user
            console.warn("[Auth] Token rejected by server. Clearing session.");
            localStorage.clear();
            if (currentPath.includes("/pages/management/")) {
                window.location.href = "/";
            }
            return;
        }

        const data = await response.json();

        // INTEGRITY CHECK — detects DevTools role tampering in localStorage
        // (mirrors the lab's "Algorithm: None" check — trust the server, not the client)
        if (!IS_FRONTEND_INSECURE && data.user.role !== role) {
            console.error("[Auth] Role mismatch! Possible localStorage tampering.");
            localStorage.clear();
            window.location.href = "/";
            return;
        }

        // ROUTING LOGIC
        const isManagementPath = currentPath.includes("/pages/management/");
        const isLoginOrIndex   = currentPath === "/"
                               || currentPath.endsWith("index.html")
                               || currentPath.includes("admin-login.html");

        if (role === "Admin" || role === "Staff") {
            if (isLoginOrIndex) {
                window.location.href = "/pages/management/dashboard.html";
            }
            return;
        }

        if (role === "Public" && isManagementPath) {
            window.location.href = "/";
        }

    } catch (error) {
        // Backend cold start (Render free tier) — fail silently, don't boot the user
        console.warn("[Auth] Backend connection pending...", error.message);
    }
}