import { handleRegistration } from "./auth/register.js";
import { handleLogin } from "./auth/login.js";

// Toggle between login and register sections
window.toggleView = function () {
    const loginSection = document.getElementById("login-section");
    const registerSection = document.getElementById("register-section");

    if (loginSection && registerSection) {
        loginSection.classList.toggle("hidden");
        registerSection.classList.toggle("hidden");
    }
};

document.addEventListener("DOMContentLoaded", () => {
    checkAuthStatus();

    // Splash screen
    const splash = document.getElementById("splash-screen");
    if (splash) {
        setTimeout(() => {
            splash.classList.add("fade-out");
            setTimeout(() => {
                splash.style.display = "none";
            }, 800);
        }, 2000);
    }

    // Register form
    const regForm = document.getElementById("register-form");
    if (regForm) {
        regForm.addEventListener("submit", handleRegistration);
    }

    // Login form
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
        loginForm.addEventListener("submit", handleLogin);
    }

    // Logout button
  // Logout button
const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", async (event) => {
        event.preventDefault();

        // Clear session data 
        localStorage.removeItem("animua_token");
        localStorage.removeItem("user_role");
        localStorage.removeItem("user_name");
        localStorage.removeItem("user_email");
        localStorage.removeItem("show_welcome_toast");

        // Professional Goodbye
        await Swal.fire({
            icon: 'info',
            title: 'Logged Out',
            text: 'You have been safely logged out.',
            timer: 2000,
            showConfirmButton: false,
            timerProgressBar: true
        });

        window.location.href = "/";
    });
}
});

// Auto-redirect users if already logged in
function checkAuthStatus() {
    const token = localStorage.getItem("animua_token");
    const role = localStorage.getItem("user_role");
    const currentPath = window.location.pathname;

    if (!token || !role) return;

    const isIndexPage =
        currentPath === "/" ||
        currentPath.endsWith("/index.html") ||
        currentPath.includes("index.html");

    const isAdminLoginPage = currentPath.includes("/pages/management/admin-login.html");
    const isDashboardPage = currentPath.includes("/pages/management/dashboard.html");
    const isHomePage = currentPath.includes("/pages/public/home.html");

    // Admin or Staff
    if (role === "Admin" || role === "Staff") {
        if (isIndexPage) {
            alert("You are already logged in. Please use the Staff Portal.");
            window.location.href = "/pages/management/dashboard.html";
            return;
        }

        if (isAdminLoginPage) {
            window.location.href = "/pages/management/dashboard.html";
            return;
        }

        if (!isDashboardPage && !isAdminLoginPage) {
            window.location.href = "/pages/management/dashboard.html";
            return;
        }
    }

    // Public
    if (role === "Public") {
        if (isHomePage) return;

        if (isAdminLoginPage) {
            alert("Access Denied: Management credentials required.");
            window.location.href = "/";
            return;
        }

        if (isIndexPage) return;
    }
}