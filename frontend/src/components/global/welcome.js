document.addEventListener("DOMContentLoaded", () => {
    // Check if the login flag exists
    const showToast = localStorage.getItem("show_welcome_toast");
    const userName = localStorage.getItem("user_name");

    if (showToast === "true" && userName) {
        // Trigger the professional SweetAlert2 Toast
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3500, // Longer timer so the panel can read the name
            timerProgressBar: true
        });

        Toast.fire({
            icon: 'success',
            title: `Welcome back, ${userName}!`
        });

        // CRITICAL: Remove the flag so it doesn't repeat on every refresh
        localStorage.removeItem("show_welcome_toast");
    }
});