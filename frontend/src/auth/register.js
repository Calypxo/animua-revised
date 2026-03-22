// frontend/src/auth/register.js
import Swal from 'sweetalert2';

export async function handleRegistration(event) {
    event.preventDefault();

    const fullNameInput = document.getElementById("reg-name");
    const emailInput = document.getElementById("reg-email");
    const passwordInput = document.getElementById("reg-password");

    const fullName = fullNameInput?.value.trim();
    const email = emailInput?.value.trim().toLowerCase();
    const password = passwordInput?.value;

    // 1. Frontend Validation
    if (!fullName || !email || !password) {
        Swal.fire({
            icon: 'warning',
            title: 'Missing Fields',
            text: 'Please fill in all fields to join Animua.'
        });
        return;
    }

    try {
        // 2. API Call (CHANGE THIS TO LOCALHOST FOR WIRESHARK AUDIT)
        // Production: https://animua.onrender.com/api/auth/register
        // Local Audit: http://localhost:5000/api/auth/register
        const response = await fetch("http://localhost:5000/api/auth/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ fullName, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            // 3. Success Feedback
            await Swal.fire({
                icon: 'success',
                title: 'Welcome to the Family!',
                text: 'Registration successful! You can now log in as a Public Member.',
                timer: 3500,
                showConfirmButton: false,
                timerProgressBar: true
            });

            // Clear inputs
            if (fullNameInput) fullNameInput.value = "";
            if (emailInput) emailInput.value = "";
            if (passwordInput) passwordInput.value = "";

            // Refresh to show login section
            location.reload();
        } else {
            // 4. Server-side Error Handling (e.g., Email already exists)
            Swal.fire({
                icon: 'error',
                title: 'Registration Failed',
                text: data.message || "An error occurred during registration."
            });
        }
    } catch (error) {
        console.error("Registration Error:", error);
        Swal.fire({
            icon: 'error',
            title: 'Connection Error',
            text: 'Cannot connect to the backend. Please check your internet or server status.'
        });
    }
}

// 🔐 Password Visibility Toggle Logic
document.addEventListener("DOMContentLoaded", () => {
    const passwordInput = document.getElementById("reg-password");
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

        // Toggle Bootstrap Icons
        toggleIcon.classList.remove("bi-eye", "bi-eye-slash");
        toggleIcon.classList.add(isHidden ? "bi-eye" : "bi-eye-slash");
    });
});