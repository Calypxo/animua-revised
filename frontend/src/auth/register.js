import Swal from "sweetalert2";
import { API_BASE_URL } from "../utils/api.js";

export async function handleRegistration(event) {
  event.preventDefault();

  const fullNameInput = document.getElementById("reg-name");
  const emailInput = document.getElementById("reg-email");
  const passwordInput = document.getElementById("reg-password");
  const authModal = document.getElementById("authModal");

  const fullName = fullNameInput?.value.trim();
  const email = emailInput?.value.trim().toLowerCase();
  const password = passwordInput?.value;

  if (!fullName) {
    closeModal(authModal);
    Swal.fire({
      icon: "warning",
      title: "Missing Name",
      text: "Please enter your full name.",
      customClass: {
        popup: "animua-popup",
        confirmButton: "animua-confirm"
      },
      buttonsStyling: false
    });
    return;
  }

  if (fullName.length < 2) {
    closeModal(authModal);
    Swal.fire({
      icon: "warning",
      title: "Invalid Name",
      text: "Full name must be at least 2 characters.",
      customClass: {
        popup: "animua-popup",
        confirmButton: "animua-confirm"
      },
      buttonsStyling: false
    });
    return;
  }

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

const passwordError = document.getElementById("reg-password-error");

// clear previous error
if (passwordError) passwordError.textContent = "";

const commonPasswords = [
  "123456",
  "12345678",
  "password",
  "password123",
  "qwerty",
  "admin",
  "111111",
  "abc123"
];

if (commonPasswords.includes(password.toLowerCase())) {
  if (passwordError) {
    passwordError.textContent =
      "This password is too common. Please choose a stronger password.";
  }
  return;
}

const isStrong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password);

if (!isStrong) {
  if (passwordError) {
    passwordError.textContent =
      "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.";
  }
  return;
}

  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fullName, email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      closeModal(authModal);

      let title = "Registration Failed";
      let text = data.message || "An error occurred during registration.";

      if (response.status === 409) {
        title = "Email Already Registered";
        text = "This email is already registered. Please log in instead, or verify your email if you have not completed verification yet.";
      }

      Swal.fire({
        icon: "error",
        title,
        text,
        customClass: {
          popup: "animua-popup",
          confirmButton: "animua-confirm"
        },
        buttonsStyling: false
      });
      return;
    }

    // SAVE TEMP INFO IF YOU STILL WANT TO USE IT LATER
    localStorage.setItem("pending_verify_email", email);
    localStorage.setItem("pending_verify_password", password);
    localStorage.setItem("pending_verify_name", fullName);

    if (fullNameInput) fullNameInput.value = "";
    if (emailInput) emailInput.value = "";
    if (passwordInput) passwordInput.value = "";

    closeModal(authModal);

    await Swal.fire({
      icon: "success",
      title: "Registration Successful",
      text: data.message || "Your account has been created. Please check your email and click the verification button to activate your ANIMUA account.",
      timer: 3500,
      showConfirmButton: false,
      timerProgressBar: true,
      customClass: {
        popup: "animua-popup"
      }
    });

    window.location.href = "/pages/index.html";
  } catch (error) {
    console.error("[Register Error]", error);

    closeModal(authModal);
    Swal.fire({
      icon: "error",
      title: "Connection Error",
      text: error.message || "Cannot connect to the backend. Please check your internet or server status.",
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

function isStrongPassword(password) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/.test(password);
}