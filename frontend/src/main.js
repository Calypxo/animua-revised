import { handleRegistration } from "./auth/register.js";
import { handleLogin } from "./auth/login.js";

/**
 * Toggle between login and register sections in the UI.
 * Ensure your index/login page has elements with these IDs.
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
    // This runs before the splash screen finishes to ensure unauthorized users are redirected.
    checkAuthStatus();

    // 2. SPLASH SCREEN LOGIC
    // Matches the ID in your home.html
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
    // This works for both home.html and dashboard.html
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async (event) => {
            event.preventDefault();

            // Completely wipe the session to prevent lingering data
            localStorage.clear();

            // Professional Feedback
            await Swal.fire({
                icon: 'info',
                title: 'Logged Out',
                text: 'Your session has been securely terminated.',
                timer: 2000,
                showConfirmButton: false,
                timerProgressBar: true
            });

            // Redirect to the landing page
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
        // This stops hackers from manually editing their role in the browser console.
        // use this if local: http://localhost:5000/api/protected
        const response = await fetch("http://localhost:5000/api/protected", {
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
            
            // If the user was trying to be in a management page, kick them to the root
            if (currentPath.includes("/pages/management/")) {
                window.location.href = "/";
            }
            return;
        }

        const data = await response.json();

        // ─── INTEGRITY CHECK ───
        // Verify that the role in LocalStorage matches the role INSIDE the signed JWT payload.
        if (data.user.role !== role) {
            console.error("Integrity Mismatch: Local role does not match JWT claim.");
            localStorage.clear();
            window.location.href = "/";
            return;
        }

        // ─── REDIRECT LOGIC (Role-Based Access Control) ───
        const isIndexPage = currentPath === "/" || currentPath.endsWith("/index.html") || currentPath.includes("index.html");
        const isAdminLoginPage = currentPath.includes("/pages/management/admin-login.html");
        const isDashboardPage = currentPath.includes("/pages/management/dashboard.html");

        // Management Personnel (Admin/Staff)
        if (role === "Admin" || role === "Staff") {
            // Push them to the dashboard if they are lurking on login or landing pages
            if (isIndexPage || isAdminLoginPage) {
                window.location.href = "/pages/management/dashboard.html";
                return;
            }
        }

        // Public Users
        if (role === "Public") {
            // Strictly block Public users from the Admin Login URL
            if (isAdminLoginPage) {
                alert("Access Denied: Management credentials required.");
                window.location.href = "/";
                return;
            }
        }

    } catch (error) {
        console.error("Auth System Error:", error);
        // We don't clear localStorage here to handle temporary internet drops gracefully.
    }
}