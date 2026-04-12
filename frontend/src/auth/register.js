import Swal from "sweetalert2";
import { auth, db } from "../utils/firebase.js";
import { API_BASE_URL } from "../utils/api.js";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

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
      Swal.fire({
        icon: "error",
        title: "Registration Failed",
        text: data.message || "An error occurred during registration.",
        customClass: {
          popup: "animua-popup",
          confirmButton: "animua-confirm"
        },
        buttonsStyling: false
      });
      return;
    }

    // FIREBASE AUTH REGISTER
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // SAVE DISPLAY NAME
    await updateProfile(user, {
      displayName: fullName
    });

    // SEND VERIFICATION EMAIL
 await sendEmailVerification(user, {
  url: `${window.location.origin}/pages/verify-success.html`,
  handleCodeInApp: false
});

    // SAVE TEMP LOGIN INFO FOR AUTO LOGIN AFTER VERIFICATION
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
      text: "Your account has been created successfully. Please check your email and verify your account.",
      timer: 3200,
      showConfirmButton: false,
      timerProgressBar: true,
      customClass: {
        popup: "animua-popup"
      }
    });

    window.location.href = "/pages/verify-success.html";
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