const MOBILE_FILTER_QUERY = "(max-width: 599px)";

const FILTER_WORKSPACES = [
  { key: "intake", search: "#searchIntake", container: ".filter-toolbar", clear: "#clearIntakeFilters", title: "Intake filters" },
  { key: "adoptions", search: "#searchApps", container: ".aa-filter-toolbar", clear: "#clearAdoptionFilters", title: "Application filters" },
  { key: "surrenders", search: "#searchSR", container: ".surrender-filter-grid", clear: "#clearSurrenderFilters", title: "Surrender filters" },
  { key: "inventory", search: "#searchInventory", container: ".inventory-filter-controls", clear: "#clearInventoryFilters", title: "Inventory filters" },
  { key: "reports", search: "#reportSearch", container: ".report-filter-grid", clear: "#btnClear", apply: "#btnApply", title: "Report filters" },
  { key: "audit", search: "#searchAudit", container: ".audit-filter-grid", clear: "#clearAuditFilters", title: "Activity filters" },
  { key: "archive", search: "#searchArchive", container: ".archive-filter-grid", title: "Archive filters" },
  { key: "compatibility", search: "#resultSearch", container: ".cq-toolbar", clear: "#clearFilters", title: "Compatibility filters" },
  { key: "users", search: "#searchUsers", container: ".um-filter-bar", clear: "#clearUserFilters", ignore: ["#pageSize"], title: "User filters" },
  { key: "animals", search: "#searchAnimals", container: ".ap-filter-toolbar", clear: "#clearAnimalFilters", title: "Animal filters" },
  { key: "messages", search: "#messageSearch", container: ".cm-filter-toolbar", clear: "#clearMessageFilters", title: "Message filters" },
  { key: "announcements", search: "#searchAnnouncement", container: ".feed-filters", title: "Announcement filters" },
];

function fieldForControl(control) {
  return control.closest("label") || control.parentElement;
}

function fieldLabel(control) {
  const field = fieldForControl(control);
  const visibleLabel = [...(field?.querySelectorAll(":scope > span") || [])]
    .find((item) => item.textContent.trim());
  return visibleLabel?.textContent.trim()
    || control.getAttribute("aria-label")?.replace(/^Filter (?:by )?/i, "")
    || control.name
    || "Filter";
}

function defaultValue(control) {
  if (control instanceof HTMLSelectElement) return control.options[0]?.value ?? "";
  if (control instanceof HTMLInputElement && ["checkbox", "radio"].includes(control.type)) {
    return control.defaultChecked;
  }
  return control.defaultValue ?? "";
}

function isActiveControl(control) {
  if (control instanceof HTMLInputElement && ["checkbox", "radio"].includes(control.type)) {
    return control.checked !== defaultValue(control);
  }
  return String(control.value ?? "").trim() !== String(defaultValue(control) ?? "").trim();
}

function activeValue(control) {
  if (control instanceof HTMLSelectElement) {
    return control.selectedOptions[0]?.textContent?.trim() || control.value;
  }
  if (control instanceof HTMLInputElement && control.type === "date" && control.value) {
    const parsed = new Date(`${control.value}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
    }
  }
  if (control instanceof HTMLInputElement && ["checkbox", "radio"].includes(control.type)) {
    return control.checked ? "On" : "Off";
  }
  return String(control.value ?? "").trim();
}

function resetControl(control) {
  if (control instanceof HTMLInputElement && ["checkbox", "radio"].includes(control.type)) {
    control.checked = Boolean(defaultValue(control));
  } else {
    control.value = defaultValue(control);
  }
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

function trackedControls(container, search, ignoredSelectors = []) {
  return [...container.querySelectorAll("input, select, textarea")]
    .filter((control) => control !== search)
    .filter((control) => control.type !== "hidden")
    .filter((control) => !ignoredSelectors.some((selector) => control.matches(selector)));
}

function createButton(className, label, icon) {
  const button = document.createElement("button");
  button.className = className;
  button.type = "button";
  button.innerHTML = `<i class="bi ${icon}" aria-hidden="true"></i><span>${label}</span>`;
  return button;
}

function enhanceWorkspace(config, search) {
  const container = search.closest(config.container);
  if (!container || container.dataset.mobileFiltersEnhanced === "true") return;

  const searchField = fieldForControl(search);
  if (!searchField || !container.contains(searchField)) return;
  const originalParent = container.parentElement;

  container.dataset.mobileFiltersEnhanced = "true";
  container.classList.add("mrf-fields");
  [...container.querySelectorAll("input, select, textarea")].forEach((control) => {
    if (control === search) return;
    const field = fieldForControl(control);
    if (!(field instanceof HTMLLabelElement)) return;
    const directLabels = [...field.querySelectorAll(":scope > span")];
    if (directLabels.some((label) => !label.classList.contains("sr-only") && label.textContent.trim())) return;
    const generatedLabel = document.createElement("span");
    generatedLabel.className = "mrf-generated-field-label";
    generatedLabel.textContent = fieldLabel(control);
    field.prepend(generatedLabel);
  });

  const workspace = document.createElement("div");
  workspace.className = `mrf-workspace mrf-workspace-${config.key}`;
  workspace.dataset.mobileFilterWorkspace = config.key;

  const searchSlot = document.createElement("div");
  searchSlot.className = "mrf-search-slot";
  searchSlot.append(searchField);

  const actions = document.createElement("div");
  actions.className = "mrf-actions";
  const trigger = createButton("mrf-trigger", "Filters", "bi-sliders2");
  const badge = document.createElement("span");
  badge.className = "mrf-count";
  badge.setAttribute("aria-hidden", "true");
  trigger.append(badge);
  const quickClear = createButton("mrf-quick-clear", "Clear", "bi-x-circle");
  actions.append(trigger, quickClear);

  const chips = document.createElement("div");
  chips.className = "mrf-chips";
  chips.setAttribute("aria-label", "Active filters");
  chips.setAttribute("aria-live", "polite");

  const backdrop = document.createElement("div");
  backdrop.className = "mrf-panel-backdrop";
  const panel = document.createElement("section");
  panel.className = "mrf-panel";
  panel.id = `mrf-panel-${config.key}`;
  const titleId = `mrf-title-${config.key}`;
  const panelHeader = document.createElement("header");
  panelHeader.className = "mrf-panel-header";
  panelHeader.innerHTML = `<div><span>Refine records</span><h2 id="${titleId}">${config.title}</h2></div>`;
  const closeButton = createButton("mrf-close", "", "bi-x-lg");
  closeButton.setAttribute("aria-label", `Close ${config.title.toLowerCase()}`);
  panelHeader.append(closeButton);

  const panelBody = document.createElement("div");
  panelBody.className = "mrf-panel-body";

  const panelFooter = document.createElement("footer");
  panelFooter.className = "mrf-panel-footer";
  const doneButton = config.apply
    ? createButton("mrf-done", "Apply filters", "bi-funnel-fill")
    : createButton("mrf-done", "Show results", "bi-check2");
  panelFooter.append(doneButton);
  panel.append(panelHeader, panelBody, panelFooter);
  backdrop.append(panel);

  originalParent.insertBefore(workspace, container);
  panelBody.append(container);
  workspace.append(searchSlot, actions, chips, backdrop);

  const mobileQuery = window.matchMedia(MOBILE_FILTER_QUERY);
  let lastFocused = null;
  let generatedReset = null;
  const controls = () => trackedControls(container, search, config.ignore || []);
  const existingClear = config.clear ? document.querySelector(config.clear) : null;
  const applyAction = config.apply ? document.querySelector(config.apply) : null;

  if (!existingClear) {
    generatedReset = createButton("mrf-generated-reset", "Clear", "bi-arrow-counterclockwise");
    generatedReset.addEventListener("click", () => controls().forEach(resetControl));
    container.append(generatedReset);
  }

  const close = ({ restoreFocus = false } = {}) => {
    const wasOpen = backdrop.classList.contains("is-open");
    backdrop.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
    panel.removeAttribute("role");
    panel.removeAttribute("aria-modal");
    panel.removeAttribute("aria-labelledby");
    document.body.classList.remove("mrf-sheet-open");
    if (mobileQuery.matches) backdrop.setAttribute("aria-hidden", "true");
    else backdrop.removeAttribute("aria-hidden");
    if (restoreFocus && wasOpen) lastFocused?.focus();
  };

  const open = () => {
    if (!mobileQuery.matches) return;
    lastFocused = document.activeElement;
    backdrop.classList.add("is-open");
    backdrop.setAttribute("aria-hidden", "false");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", titleId);
    trigger.setAttribute("aria-expanded", "true");
    document.body.classList.add("mrf-sheet-open");
    requestAnimationFrame(() => controls().find((control) => !control.disabled)?.focus());
  };

  const update = () => {
    const active = controls().filter(isActiveControl);
    badge.textContent = String(active.length);
    badge.hidden = active.length === 0;
    quickClear.hidden = active.length === 0;
    trigger.setAttribute("aria-label", active.length
      ? `Open ${config.title.toLowerCase()}, ${active.length} active`
      : `Open ${config.title.toLowerCase()}`);
    chips.replaceChildren(...active.map((control) => {
      const label = fieldLabel(control);
      const value = activeValue(control);
      const chip = createButton("mrf-chip", `${label}: ${value}`, "bi-x");
      chip.setAttribute("aria-label", `Remove ${label} filter: ${value}`);
      chip.addEventListener("click", () => resetControl(control));
      return chip;
    }));
    chips.hidden = active.length === 0;
  };

  trigger.setAttribute("aria-controls", panel.id);
  trigger.setAttribute("aria-expanded", "false");
  trigger.addEventListener("click", open);
  closeButton.addEventListener("click", () => close({ restoreFocus: true }));
  doneButton.addEventListener("click", () => {
    if (applyAction) applyAction.click();
    close({ restoreFocus: true });
  });
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close({ restoreFocus: true });
  });
  backdrop.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close({ restoreFocus: true });
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...panel.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")]
      .filter((element) => !element.hidden && element.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  const clearAction = existingClear || generatedReset;
  quickClear.addEventListener("click", () => clearAction?.click());
  clearAction?.addEventListener("click", () => requestAnimationFrame(update));
  applyAction?.addEventListener("click", () => close());
  container.addEventListener("input", () => requestAnimationFrame(update));
  container.addEventListener("change", () => requestAnimationFrame(update));
  mobileQuery.addEventListener("change", () => close());

  update();
  close();
}

export function enhanceResponsiveFilters(root = document) {
  FILTER_WORKSPACES.forEach((config) => {
    const search = root.querySelector?.(config.search) || document.querySelector(config.search);
    if (search) enhanceWorkspace(config, search);
  });
}
