import Swal from "sweetalert2";
import { API_BASE_URL } from "../utils/api.js";

export async function handleLogin(event) {
  event.preventDefault();

  localStorage.clear();

  const emailInput = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");

  const email = emailInput?.value.trim().toLowerCase();
  const password = passwordInput?.value;

  if (!email || !password) {
    Swal.fire({
      icon: "warning",
      title: "Missing Information",
      text: "Please enter both email and password.",
    });
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    console.log("Login response:", data);

    if (!response.ok) {
      Swal.fire({
        icon: "error",
        title: "Login Failed",
        text: data.message || "Invalid email or password.",
      });
      return;
    }

    const currentPath = window.location.pathname;
    const isAdminPage = currentPath.includes("admin-login.html");
    const isPublicPage =
      currentPath === "/" || currentPath.includes("index.html");
    const isAuthorizedStaff = data.role === "Admin" || data.role === "Staff";

    if (isAdminPage && !isAuthorizedStaff) {
      Swal.fire({
        icon: "error",
        title: "Access Denied",
        text: "You do not have the required permissions for the Management Console.",
      });
      return;
    }

    if (isPublicPage && isAuthorizedStaff) {
      Swal.fire({
        icon: "info",
        title: "Staff Detected",
        text: "Please log in via the Management Portal to access admin tools.",
      });
      return;
    }

    localStorage.setItem("animua_token", data.token);
    localStorage.setItem("user_role", data.role);
    localStorage.setItem("user_name", data.fullName);
    localStorage.setItem("user_email", email);
    localStorage.setItem("show_welcome_toast", "true");

    console.log("Saved token:", localStorage.getItem("animua_token"));
    console.log("Saved role:", localStorage.getItem("user_role"));
    console.log("Saved name:", localStorage.getItem("user_name"));

    if (isAuthorizedStaff) {
      window.location.replace("/pages/management/dashboard.html");
    } else {
      window.location.replace("/pages/public/home.html");
    }
  } catch (error) {
    console.error("[Login Error]", error);
    Swal.fire({
      icon: "error",
      title: "Connection Error",
      text: "The server is unreachable. Please verify your connection or check the backend status.",
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const passwordInput = document.getElementById("login-password");
  if (!passwordInput) return;

  const inputGroup = passwordInput.closest(".input-group");
  const toggleButton = inputGroup?.querySelector(".input-group-text");
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