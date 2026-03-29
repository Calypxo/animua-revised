const menuToggle = document.getElementById("menuToggle");
const navbar = document.getElementById("navbar");
const body = document.body;
const header = document.querySelector(".header");

if (menuToggle && navbar) {
  menuToggle.addEventListener("click", () => {
    navbar.classList.toggle("show");
    body.classList.toggle("menu-open");
  });
}

document.querySelectorAll(".navbar a").forEach((link) => {
  link.addEventListener("click", () => {
    if (navbar) {
      navbar.classList.remove("show");
    }
    body.classList.remove("menu-open");
  });
});

if (header) {
  window.addEventListener("scroll", () => {
    if (window.scrollY > 20) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }
  });
}

const revealElements = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window && revealElements.length) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("show");
        }
      });
    },
    {
      threshold: 0.15
    }
  );

  revealElements.forEach((element) => observer.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add("show"));
}

const notificationBtn = document.getElementById("notificationBtn");
const notificationPopup = document.getElementById("notificationPopup");

if (notificationBtn && notificationPopup) {
  notificationBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    notificationPopup.classList.toggle("show");
  });

  document.addEventListener("click", (event) => {
    if (
      !notificationPopup.contains(event.target) &&
      !notificationBtn.contains(event.target)
    ) {
      notificationPopup.classList.remove("show");
    }
  });
}
