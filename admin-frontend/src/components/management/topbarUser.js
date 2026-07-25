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

  document.getElementById("display-name")?.replaceChildren(document.createTextNode(name));
  document.getElementById("display-role")?.replaceChildren(document.createTextNode(role));
  document.getElementById("topbar-initials")?.replaceChildren(document.createTextNode(initials));

  const topbarRight = document.querySelector(".topbar-right");
  const chip = document.querySelector(".user-chip");
  if (topbarRight && chip) {
    topbarRight.querySelectorAll(".topbar-quick-action:not(.notif-btn)").forEach((button) => button.remove());
    const inbox = document.createElement("button");
    inbox.type = "button";
    inbox.className = "topbar-quick-action";
    inbox.setAttribute("aria-label", "Messages");
    inbox.innerHTML = '<i class="bi bi-envelope" aria-hidden="true"></i>';
    const existingNotification = topbarRight.querySelector(".notif-btn");
    if (existingNotification) existingNotification.classList.add("topbar-quick-action");
    else {
      const notification = document.createElement("button");
      notification.type = "button";
      notification.className = "topbar-quick-action notif-btn";
      notification.setAttribute("aria-label", "Notifications");
      notification.innerHTML = '<i class="bi bi-bell-fill" aria-hidden="true"></i><span class="notif-dot"></span>';
      topbarRight.insertBefore(notification, chip);
    }
    topbarRight.insertBefore(inbox, topbarRight.querySelector(".notif-btn") || chip);
    if (!chip.querySelector(".caret")) {
      const caret = document.createElement("i");
      caret.className = "bi bi-chevron-down caret";
      caret.setAttribute("aria-hidden", "true");
      chip.append(caret);
    }
  }

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
