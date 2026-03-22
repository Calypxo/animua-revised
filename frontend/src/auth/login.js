// frontend/src/auth/login.js 
import Swal from 'sweetalert2';

export async function handleLogin(event) {
    event.preventDefault();

    const emailInput = document.getElementById("login-email");
    const passwordInput = document.getElementById("login-password");

    const email = emailInput?.value.trim().toLowerCase();
    const password = passwordInput?.value;

    // Basic validation before reaching the server
    if (!email || !password) {
        Swal.fire({ 
            icon: 'warning', 
            title: 'Missing Information', 
            text: 'Please enter both email and password.' 
        });
        return;
    }

    try {

        // LOCAL AUDIT (Use this for Wireshark on your laptop):
        //const response = await fetch("http://localhost:5000/api/auth/login", {

        // PRODUCTION (Use this for the final live demo):
        // Connects to your Render Backend [cite: 75, 107]
        const response = await fetch("https://animua.onrender.com/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            const currentPath = window.location.pathname;
            
            // Detection logic for Admin vs Public portals [cite: 67, 109]
            const isAdminPage = currentPath.includes("admin-login.html");
            const isPublicPage = currentPath === "/" || currentPath.includes("index.html");
            const isAuthorizedStaff = data.role === "Admin" || data.role === "Staff";

            // Guard: Prevent Public users from entering Admin portal [cite: 109]
            if (isAdminPage && !isAuthorizedStaff) {
                Swal.fire({ 
                    icon: 'error', 
                    title: 'Access Denied', 
                    text: 'Management credentials required.' 
                });
                return;
            }

            // Guard: Prevent Staff from using the standard Public login [cite: 109]
            if (isPublicPage && isAuthorizedStaff) {
                Swal.fire({ 
                    icon: 'info', 
                    title: 'Staff Detected', 
                    text: 'Please use the Management Portal.' 
                });
                return;
            }

            // --- SAVE SESSION DATA ---
            // Storing JWT and identity claims for stateless authorization [cite: 20, 21]
            localStorage.setItem("animua_token", data.token);
            localStorage.setItem("user_role", data.role);
            localStorage.setItem("user_name", data.fullName);
            localStorage.setItem("user_email", email);

            // --- SET THE TOAST FLAG ---
            // This flag is picked up by welcome.js on the next page load
            localStorage.setItem("show_welcome_toast", "true");

            // --- REDIRECT LOGIC ---
            // Using replace to prevent the user from clicking "Back" to the login form
            if (isAuthorizedStaff) {
                window.location.replace("/pages/management/dashboard.html"); // [cite: 57]
            } else {
                window.location.replace("/pages/public/home.html"); // [cite: 65]
            }

        } else {
            // Displays error if Bcrypt comparison or user lookup fails [cite: 12, 40]
            Swal.fire({ 
                icon: 'error', 
                title: 'Login Failed', 
                text: data.message || "Invalid email or password." 
            });
        }

    } catch (error) {
        console.error("Login Error:", error);
        Swal.fire({ 
            icon: 'error', 
            title: 'Connection Error', 
            text: 'Unable to connect to the server. Please check your internet.' 
        });
    }
}

// Password Visibility Toggle Logic
document.addEventListener("DOMContentLoaded", () => {
    const passwordInput = document.getElementById("login-password");
    if (!passwordInput) return;

    const inputGroup = passwordInput.closest(".input-group");
    if (!inputGroup) return;

    const toggleButton = inputGroup.querySelector(".input-group-text");
    const toggleIcon = toggleButton?.querySelector("i");

    if (!toggleButton || !toggleIcon) return;

    toggleButton.style.cursor = "pointer";

    toggleButton.addEventListener("click", () => {
        const isHidden = passwordInput.type === "password";
        passwordInput.type = isHidden ? "text" : "password";

        toggleIcon.classList.remove("bi-eye", "bi-eye-slash");
        toggleIcon.classList.add(isHidden ? "bi-eye" : "bi-eye-slash");
    });
});