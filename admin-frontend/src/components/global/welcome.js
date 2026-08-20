import Swal from "sweetalert2";

// frontend/src/components/global/welcome.js

const triggerWelcomeToast = () => {
    const showToast = localStorage.getItem("show_welcome_toast");
    const userName  = localStorage.getItem("user_name");

    if (showToast === "true" && userName) {
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3500,
            timerProgressBar: true,
            background: '#FFFFFF',
            color: '#333',
            didOpen: (toast) => {
                toast.onmouseenter = Swal.stopTimer;
                toast.onmouseleave = Swal.resumeTimer;
            }
        });

        Toast.fire({
            icon: 'success',
            title: `Welcome back, ${userName}!`
        });

        // Remove the flag so it doesn't repeat on every refresh
        localStorage.removeItem("show_welcome_toast");
    }
};

// We wait for the Security Gatekeeper to finish. 
// If the body is still hidden, we wait.
const checkVisibilityAndFire = () => {
    if (document.body.style.display === "block") {
        triggerWelcomeToast();
    } else {
        // Check again in 100ms
        setTimeout(checkVisibilityAndFire, 100);
    }
};

document.addEventListener("DOMContentLoaded", checkVisibilityAndFire);
