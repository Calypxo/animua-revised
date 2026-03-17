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
        const response = await fetch("http://192.168.100.227:5000/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        });

        const data = await response.json();

        if (response.ok) {

            const currentPath = window.location.pathname;

            const isAdminPage = currentPath.includes("admin-login.html");
            const isPublicPage =
                currentPath.includes("index.html") ||
                currentPath === "/" ||
                currentPath.endsWith("/");

            const isAuthorizedStaff =
                data.role === "Admin" || data.role === "Staff";

            // Prevent Public users from logging in through admin portal
            if (isAdminPage && !isAuthorizedStaff) {
                alert("Access Denied: Management credentials required.");
                return;
            }

            // Prevent Admin/Staff from using public login
            if (isPublicPage && isAuthorizedStaff) {
                alert("Access Denied: Please use the Staff Portal to login.");
                return;
            }

            // Save session data
            localStorage.setItem("animua_token", data.token);
            localStorage.setItem("user_role", data.role);
            localStorage.setItem("user_name", data.fullName);
            localStorage.setItem("user_email", data.email || email);

            alert(`Login Successful! Welcome, ${data.fullName}`);

            // Redirect based on role
            if (isAuthorizedStaff) {
                window.location.href = "/pages/management/dashboard.html";
            } else {
                window.location.href = "/pages/public/home.html";
            }

        } else {
            alert(data.message || "Incorrect login credentials.");
        }

    } catch (error) {
        console.error("Login Error:", error);
        alert("Server error. Please check your connection.");
    }
}