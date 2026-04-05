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
      text: "Please enter your email.",
      customClass: {
        popup: "animua-popup",
        confirmButton: "animua-confirm"
      },
      buttonsStyling: false
    });
    return;
  }

  if (!isValidEmail(email)) {
    closeModal(authModal);
    Swal.fire({
      icon: "warning",
      title: "Invalid Email",
      text: "Please enter a valid email address.",
      customClass: {
        popup: "animua-popup",
        confirmButton: "animua-confirm"
      },
      buttonsStyling: false
    });
    return;
  }

  if (!password) {
    closeModal(authModal);
    Swal.fire({
      icon: "warning",
      title: "Missing Password",
      text: "Please enter your password.",
      customClass: {
        popup: "animua-popup",
        confirmButton: "animua-confirm"
      },
      buttonsStyling: false
    });
    return;
  }

  if (password.length < 6) {
    closeModal(authModal);
    Swal.fire({
      icon: "warning",
      title: "Invalid Password",
      text: "Password must be at least 6 characters.",
      customClass: {
        popup: "animua-popup",
        confirmButton: "animua-confirm"
      },
      buttonsStyling: false
    });
    return;
  }

  try {
    const loginUrl = `${API_BASE_URL}/auth/login`;
    console.log("API_BASE_URL:", API_BASE_URL);
    console.log("Login URL:", loginUrl);

    const response = await fetch(loginUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    console.log("Response status:", response.status);

    const rawText = await response.text();
    console.log("Raw response text:", rawText);

    let data = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      data = {
        message: rawText || "Server returned a non-JSON response."
      };
    }

    if (!response.ok) {
      closeModal(authModal);
      Swal.fire({
        icon: "error",
        title: "Login Failed",
        text: data.message || `Request failed with status ${response.status}.`,
        customClass: {
          popup: "animua-popup",
          confirmButton: "animua-confirm"
        },
        buttonsStyling: false
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
      timerProgressBar: true,
      customClass: {
        popup: "animua-popup"
      }
    });

    if (userRole === "Admin" || userRole === "Staff") {
      window.location.replace("/pages/dashboard.html");
    } else {
      window.location.replace("/pages/public/home.html");
    }
  } catch (error) {
    console.error("[Login Error]", error);
    closeModal(authModal);
    Swal.fire({
      icon: "error",
      title: "Login Error",
      text: error.message || "Something went wrong while trying to log in.",
      customClass: {
        popup: "animua-popup",
        confirmButton: "animua-confirm"
      },
      buttonsStyling: false
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