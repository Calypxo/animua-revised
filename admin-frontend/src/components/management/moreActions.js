// Desktop hides the disclosure label, so its contents must be open.
// CSS alone (display: contents) does not expand a native <details> element.
const desktopActions = window.matchMedia("(min-width: 600px)");

export function syncMoreActions(root = document) {
  root.querySelectorAll("details.management-more-actions").forEach(details => {
    details.open = desktopActions.matches;
  });
}

desktopActions.addEventListener("change", () => syncMoreActions());
