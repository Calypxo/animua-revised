// frontend/src/auth/login.js 

export async function handleLogin(event) {
    event.preventDefault();

    const emailInput = document.getElementById("login-email");
    const passwordInput = document.getElementById("login-password");

    const email = emailInput?.value.trim().toLowerCase();
    const password = passwordInput?.value;

    if (!email || !password) {
        Swal.fire({ icon: 'warning', title: 'Oops...', text: 'Please enter both email and password.' });
        return;
    }

    try {
        const response = await fetch("https://animua.onrender.com/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            const currentPath = window.location.pathname;
            const isAdminPage = currentPath.includes("admin-login.html");
            const isPublicPage = currentPath === "/" || currentPath.includes("index.html");
            const isAuthorizedStaff = data.role === "Admin" || data.role === "Staff";

            // Guard: Admin Portal
            if (isAdminPage && !isAuthorizedStaff) {
                Swal.fire({ icon: 'error', title: 'Access Denied', text: 'Management credentials required.' });
                return;
            }

            // Guard: Public Portal
            if (isPublicPage && isAuthorizedStaff) {
                Swal.fire({ icon: 'info', title: 'Staff Detected', text: 'Please use the Management Portal.' });
                return;
            }

            // --- SAVE SESSION DATA ---
            localStorage.setItem("animua_token", data.token);
            localStorage.setItem("user_role", data.role);
            localStorage.setItem("user_name", data.fullName);
            localStorage.setItem("user_email", email);

            // --- SWEETALERT2 PERSONALIZED TOAST --- [cite: 43]
            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2500,
                timerProgressBar: true,
                didOpen: (toast) => {
                    toast.addEventListener('mouseenter', Swal.stopTimer)
                    toast.addEventListener('mouseleave', Swal.resumeTimer)
                }
            });

            await Toast.fire({
                icon: 'success',
                title: `Welcome back, ${data.fullName}!` // Personalized name from your database
            });

            // --- REDIRECT LOGIC ---
            if (isAuthorizedStaff) {
                window.location.replace("/pages/management/dashboard.html");
            } else {
                window.location.replace("/pages/public/home.html");
            }

        } else {
            Swal.fire({ icon: 'error', title: 'Login Failed', text: data.message || "Invalid email or password." });
        }

    } catch (error) {
        console.error("Login Error:", error);
        Swal.fire({ icon: 'error', title: 'Connection Error', text: 'Unable to connect to the server.' });
    }
}

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