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
}