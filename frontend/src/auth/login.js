// frontend/src/auth/login.js 

export async function handleLogin(event) {
    event.preventDefault();

    const emailInput = document.getElementById("login-email");
    const passwordInput = document.getElementById("login-password");

    const email = emailInput?.value.trim().toLowerCase();
    const password = passwordInput?.value;

    if (!email || !password) {
        alert("Please enter both email and password.");
        return;
    }

    try {
        // Ensure this URL exactly matches your Render External URL
        const response = await fetch("https://animua.onrender.com/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            const currentPath = window.location.pathname;

            // Detection logic for Admin vs Public portals
            const isAdminPage = currentPath.includes("admin-login.html");
            const isPublicPage = currentPath === "/" || currentPath.includes("index.html");

            const isAuthorizedStaff = data.role === "Admin" || data.role === "Staff";

            // Guard: Prevent Public users from entering Admin portal
            if (isAdminPage && !isAuthorizedStaff) {
                alert("Access Denied: Management credentials required.");
                return;
            }

            // Guard: Prevent Staff from using the standard Public login
            if (isPublicPage && isAuthorizedStaff) {
                alert("Staff detected: Please use the Management Portal.");
                return;
            }

            // --- SAVE SESSION DATA ---
            localStorage.setItem("animua_token", data.token);
            localStorage.setItem("user_role", data.role);
            localStorage.setItem("user_name", data.fullName);
            localStorage.setItem("user_email", email);

            alert(`Login Successful! Welcome, ${data.fullName}`);

            // --- REDIRECT LOGIC ---
            // We use window.location.replace to prevent users from clicking "Back" to the login form
            if (isAuthorizedStaff) {
                // Ensure this matches your Vite config input name
                window.location.replace("/pages/management/dashboard.html");
            } else {
                window.location.replace("/pages/public/home.html");
            }

        } else {
            alert(data.message || "Invalid email or password.");
        }

    } catch (error) {
        console.error("Login Error:", error);
        alert("Unable to connect to the server. Please check your internet or try again later.");
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