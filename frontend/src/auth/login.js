import Swal from "sweetalert2";
import { auth, db } from "../utils/firebase.js";
import { API_BASE_URL } from "../utils/api.js";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";

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
        text: data.message || "Incorrect email or password.",
        customClass: {
          popup: "animua-popup",
          confirmButton: "animua-confirm"
        },
        buttonsStyling: false
      });
      return;
    }

    // FIREBASE AUTH LOGIN
    const firebaseCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = firebaseCredential.user;

    // REFRESH USER DATA TO GET LATEST EMAIL VERIFICATION STATUS
    await firebaseUser.reload();

    if (!firebaseUser.emailVerified) {
      await signOut(auth);

      closeModal(authModal);
      await Swal.fire({
        icon: "warning",
        title: "Email Not Verified",
        text: "Please verify your email first before logging in.",
        customClass: {
          popup: "animua-popup",
          confirmButton: "animua-confirm"
        },
        buttonsStyling: false
      });

      window.location.replace("/pages/verify-success.html");
      return;
    }

    // UPDATE FIRESTORE USER STATUS
    await updateDoc(doc(db, "users", firebaseUser.email.toLowerCase()), {
      emailVerified: true,
      status: "Active"
    });

    const userRole = data.role || "Public";
    const userFullName = data.fullName || "User";

    localStorage.setItem("animua_token", data.token || "");
    localStorage.setItem("user_role", userRole);
    localStorage.setItem("user_name", userFullName);
    localStorage.setItem("user_email", email);
    localStorage.setItem("is_logged_in", "true");
   

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