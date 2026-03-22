// frontend/src/components/global/welcome.js
document.addEventListener("DOMContentLoaded", () => {
    const showToast = localStorage.getItem("show_welcome_toast");
    const userName = localStorage.getItem("user_name");

    if (showToast === "true" && userName) {
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3500,
            timerProgressBar: true,
            background: '#ffffff',
            color: '#333'
        });

        Toast.fire({
            icon: 'success',
            title: `Welcome back, ${userName}!`
        });

        // Remove the flag so it doesn't repeat
        localStorage.removeItem("show_welcome_toast");
    }
});