import Swal from "sweetalert2";
import { API_BASE_URL } from "../utils/api.js";

export async function handleLogin(event) {
  event.preventDefault();

  const emailInput = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");
  const authModal = document.getElementById("authModal");

  const email = emailInput?.value.trim().toLowerCase();
  const password = passwordInput?.value;

  if (!email) {
    closeModal(authModal);
    Swal.fire({
      icon: "warning",
      title: "Missing Email",
      text: "Please enter your email."
    });
    return;
  }

  if (!isValidEmail(email)) {
    closeModal(authModal);
    Swal.fire({
      icon: "warning",
      title: "Invalid Email",
      text: "Please enter a valid email address."
    });
    return;
  }

  if (!password) {
    closeModal(authModal);
    Swal.fire({
      icon: "warning",
      title: "Missing Password",
      text: "Please enter your password."
    });
    return;
  }

  if (password.length < 6) {
    closeModal(authModal);
    Swal.fire({
      icon: "warning",
      title: "Invalid Password",
      text: "Password must be at least 6 characters."
    });
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      closeModal(authModal);
      Swal.fire({
        icon: "error",
        title: "Login Failed",
        text: data.message || "Incorrect email or password."
      });
      return;
    }

    const userRole = data.role || "Public";
    const userFullName = data.fullName || "User";

    localStorage.setItem("animua_token", data.token || "");
    localStorage.setItem("user_role", userRole);
    localStorage.setItem("user_name", userFullName);
    localStorage.setItem("user_email", email);
    localStorage.setItem("is_logged_in", "true");
    localStorage.setItem("show_welcome_toast", "true");

    closeModal(authModal);

    await Swal.fire({
      icon: "success",
      title: "Login Successful",
      text: `Welcome back, ${userFullName}!`,
      timer: 1800,
      showConfirmButton: false,
      timerProgressBar: true
    });

    if (userRole === "Admin" || userRole === "Staff") {
      window.location.replace("/pages/management/dashboard.html");
    } else {
      window.location.replace("/pages/public/home.html");
    }
  } catch (error) {
    console.error("[Login Error]", error);
    closeModal(authModal);
    Swal.fire({
      icon: "error",
      title: "Connection Error",
      text: "Cannot connect to the backend. Please check your internet or server status."
    });
  }
}

function closeModal(authModal) {
  if (authModal) authModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}