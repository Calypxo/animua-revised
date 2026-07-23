import { getUserName, getUserRole } from "../../utils/storage.js";

export function renderTopbarUser() {
  const name = getUserName() || "Admin User";
  const role = getUserRole() || "Admin";

  const initials = name
    .split(" ")
    .map(w => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  document.getElementById("display-name").textContent = name;
  document.getElementById("display-role").textContent = role;
  document.getElementById("topbar-initials").textContent = initials;

  const chip = document.querySelector(".user-chip");
  if (chip && chip.dataset.accountSettingsBound !== "true") {
    chip.dataset.accountSettingsBound = "true";
    chip.setAttribute("role", "link");
    chip.setAttribute("tabindex", "0");
    chip.setAttribute("title", "Open Account Settings");

    const openAccountSettings = () => {
      window.location.href = "/pages/accountSettings.html";
    };

    chip.addEventListener("click", openAccountSettings);
    chip.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openAccountSettings();
      }
    });
  }
}
