// frontend/src/auth/register.js

export async function handleRegistration(event) {
    event.preventDefault();

    const fullNameInput = document.getElementById("reg-name");
    const emailInput = document.getElementById("reg-email");
    const passwordInput = document.getElementById("reg-password");

    const fullName = fullNameInput?.value.trim();
    const email = emailInput?.value.trim().toLowerCase();
    const password = passwordInput?.value;

    if (!fullName || !email || !password) {
        alert("Please fill in all fields.");
        return;
    }

    try {
        const response = await fetch("https://animua.onrender.com/api/auth/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ fullName, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            alert("Registration successful! You are now a Public Member. Please log in.");

            if (fullNameInput) fullNameInput.value = "";
            if (emailInput) emailInput.value = "";
            if (passwordInput) passwordInput.value = "";

            location.reload();
        } else {
            alert("Registration failed: " + (data.message || "Unknown error."));
        }
    } catch (error) {
        console.error("Registration Error:", error);
        alert("Cannot connect to the server. Please make sure the backend is running.");
    }
}

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

        toggleIcon.classList.remove("bi-eye", "bi-eye-slash");
        toggleIcon.classList.add(isHidden ? "bi-eye" : "bi-eye-slash");
    });
});