// frontend/src/utils/authGuard.js

export function checkAuth(requiredRole = null) {
    const token = localStorage.getItem("animua_token");
    const userRole = localStorage.getItem("user_role");

    // 1. If no token, kick them to login
    if (!token) {
        alert("Session expired. Please log in.");
        window.location.replace("/index.html");
        return;
    }

    // 2. If a specific role is required (like Admin), check it
    if (requiredRole && userRole !== requiredRole && userRole !== "Admin") {
        alert("Access Denied: You do not have permission to view this page.");
        window.location.replace("/pages/public/home.html");
        return;
    }
}