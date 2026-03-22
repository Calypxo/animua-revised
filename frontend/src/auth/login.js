// frontend/src/auth/login.js 
import Swal from 'sweetalert2';

/**
 * Handle the login process for both Admin and Public portals.
 * Implements Multi-Layered Guarding to prevent unauthorized access.
 */
export async function handleLogin(event) {
    event.preventDefault();

    // --- SECURITY: SESSION RESET ---
    // Clears any existing data to prevent Session Fixation or data leaking between users.
    localStorage.clear();

    const emailInput = document.getElementById("login-email");
    const passwordInput = document.getElementById("login-password");

    const email = emailInput?.value.trim().toLowerCase();
    const password = passwordInput?.value;

    // 1. Client-Side Validation
    if (!email || !password) {
        Swal.fire({ 
            icon: 'warning', 
            title: 'Missing Information', 
            text: 'Please enter both email and password.' 
        });
        return;
    }

    try {
        // --- API REQUEST ---
        // Switch to http://localhost:5000/api/auth/login for your Wireshark Laptop Audit
        // https://animua.onrender.com/api/auth/login
        const response = await fetch("https://animua.onrender.com/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            const currentPath = window.location.pathname;
            
            // 2. PORTAL DETECTION LOGIC
            const isAdminPage = currentPath.includes("admin-login.html");
            const isPublicPage = currentPath === "/" || currentPath.includes("index.html");
            const isAuthorizedStaff = data.role === "Admin" || data.role === "Staff";

            // --- SECURITY GUARD A: PREVENT PUBLIC USERS FROM ADMIN PORTAL ---
            if (isAdminPage && !isAuthorizedStaff) {
                Swal.fire({ 
                    icon: 'error', 
                    title: 'Access Denied', 
                    text: 'You do not have the required permissions for the Management Console.' 
                });
                return;
            }

            // --- SECURITY GUARD B: PREVENT STAFF FROM PUBLIC LOGIN ---
            if (isPublicPage && isAuthorizedStaff) {
                Swal.fire({ 
                    icon: 'info', 
                    title: 'Staff Detected', 
                    text: 'Please log in via the Management Portal to access admin tools.' 
                });
                return;
            }

            // --- 3. SAVE STATELESS SESSION DATA ---
            // We store the JWT and claims in LocalStorage for persistence across page loads.
            localStorage.setItem("animua_token", data.token);
            localStorage.setItem("user_role", data.role);
            localStorage.setItem("user_name", data.fullName);
            localStorage.setItem("user_email", email);

            // Set the flag for welcome.js to trigger the toast on the next page
            localStorage.setItem("show_welcome_toast", "true");

            // --- 4. SECURE REDIRECT ---
            // 'replace' is used so the login page is removed from the browser's history stack.
            if (isAuthorizedStaff) {
                window.location.replace("/pages/management/dashboard.html");
            } else {
                window.location.replace("/pages/public/home.html");
            }

        } else {
            // Error handling for incorrect credentials (Bcrypt mismatch)
            Swal.fire({ 
                icon: 'error', 
                title: 'Login Failed', 
                text: data.message || "Invalid email or password." 
            });
        }

    } catch (error) {
        console.error("Critical Login Error:", error);
        Swal.fire({ 
            icon: 'error', 
            title: 'Connection Error', 
            text: 'The server is unreachable. Please verify your connection or check the backend status.' 
        });
    }
}

/**
 * Password Visibility Toggle Logic
 * Standard UI security feature to allow users to verify their input.
 */
document.addEventListener("DOMContentLoaded", () => {
    const passwordInput = document.getElementById("login-password");
    if (!passwordInput) return;

    // Find the nearest input group and its associated icon
    const inputGroup = passwordInput.closest(".input-group");
    if (!inputGroup) return;

    const toggleButton = inputGroup.querySelector(".input-group-text");
    const toggleIcon = toggleButton?.querySelector("i");

    if (!toggleButton || !toggleIcon) return;

    toggleButton.style.cursor = "pointer";

    toggleButton.addEventListener("click", () => {
        const isHidden = passwordInput.type === "password";
        passwordInput.type = isHidden ? "text" : "password";

        // Switch Icons (Bootstrap Icons)
        toggleIcon.classList.remove("bi-eye", "bi-eye-slash");
        toggleIcon.classList.add(isHidden ? "bi-eye" : "bi-eye-slash");
    });
});