const skeletonLine = (className = "") => `<span class="animua-sk-shape ${className}" aria-hidden="true"></span>`;

export function workspaceSkeletonMarkup() {
  return `
    <div class="animua-skeleton-workspace" aria-hidden="true">
      <div class="animua-sk-topbar">
        <div class="animua-sk-topbar-copy">
          ${skeletonLine("animua-sk-kicker")}
          ${skeletonLine("animua-sk-page-title")}
        </div>
        <div class="animua-sk-profile">
          ${skeletonLine("animua-sk-avatar")}
          <span class="animua-sk-profile-copy">
            ${skeletonLine("animua-sk-name")}
            ${skeletonLine("animua-sk-role")}
          </span>
        </div>
      </div>

      <div class="animua-sk-canvas">
        <section class="animua-sk-hero">
          <div class="animua-sk-hero-copy">
            ${skeletonLine("animua-sk-hero-kicker")}
            ${skeletonLine("animua-sk-hero-title")}
            ${skeletonLine("animua-sk-hero-title animua-sk-hero-title-short")}
            ${skeletonLine("animua-sk-hero-text")}
            ${skeletonLine("animua-sk-hero-text animua-sk-hero-text-short")}
            <div class="animua-sk-chips">
              ${skeletonLine("animua-sk-chip")}
              ${skeletonLine("animua-sk-chip")}
              ${skeletonLine("animua-sk-chip animua-sk-chip-short")}
            </div>
          </div>
          <div class="animua-sk-hero-card">
            ${skeletonLine("animua-sk-card-status")}
            ${skeletonLine("animua-sk-card-rule")}
            <div class="animua-sk-card-detail">
              <span>
                ${skeletonLine("animua-sk-card-label")}
                ${skeletonLine("animua-sk-card-value")}
              </span>
              ${skeletonLine("animua-sk-count")}
            </div>
            ${skeletonLine("animua-sk-card-rule")}
            ${skeletonLine("animua-sk-card-button")}
          </div>
        </section>

        <section class="animua-sk-metrics">
          ${[0, 1, 2, 3, 4].map(() => `
            <div class="animua-sk-metric">
              ${skeletonLine("animua-sk-metric-icon")}
              <span class="animua-sk-metric-copy">
                ${skeletonLine("animua-sk-metric-value")}
                ${skeletonLine("animua-sk-metric-label")}
              </span>
            </div>`).join("")}
        </section>

        <section class="animua-sk-content-grid">
          <div class="animua-sk-panel animua-sk-table-panel">
            <div class="animua-sk-panel-heading">
              <span>
                ${skeletonLine("animua-sk-panel-title")}
                ${skeletonLine("animua-sk-panel-subtitle")}
              </span>
              ${skeletonLine("animua-sk-panel-action")}
            </div>
            <div class="animua-sk-table-head">
              ${[0, 1, 2, 3].map(() => skeletonLine("animua-sk-table-label")).join("")}
            </div>
            ${[0, 1, 2, 3].map(() => `
              <div class="animua-sk-table-row">
                <span class="animua-sk-table-person">
                  ${skeletonLine("animua-sk-row-avatar")}
                  ${skeletonLine("animua-sk-row-primary")}
                </span>
                ${skeletonLine("animua-sk-row-cell")}
                ${skeletonLine("animua-sk-row-cell animua-sk-row-cell-short")}
                ${skeletonLine("animua-sk-row-pill")}
              </div>`).join("")}
          </div>
          <div class="animua-sk-panel animua-sk-side-panel">
            ${skeletonLine("animua-sk-panel-title")}
            ${skeletonLine("animua-sk-panel-subtitle")}
            ${[0, 1, 2].map(() => `
              <div class="animua-sk-side-row">
                ${skeletonLine("animua-sk-side-icon")}
                <span>
                  ${skeletonLine("animua-sk-side-primary")}
                  ${skeletonLine("animua-sk-side-secondary")}
                </span>
              </div>`).join("")}
          </div>
        </section>
      </div>
    </div>`;
}

function sidebarSkeletonMarkup() {
  return `
    <aside class="animua-sk-sidebar" aria-hidden="true">
      <div class="animua-sk-brand">
        ${skeletonLine("animua-sk-brand-mark")}
        <span>
          ${skeletonLine("animua-sk-brand-name")}
          ${skeletonLine("animua-sk-brand-caption")}
        </span>
      </div>
      <div class="animua-sk-nav">
        ${skeletonLine("animua-sk-nav-label")}
        ${[0, 1, 2, 3, 4, 5, 6].map((item) => `
          <div class="animua-sk-nav-row${item === 0 ? " is-active" : ""}">
            ${skeletonLine("animua-sk-nav-icon")}
            ${skeletonLine(`animua-sk-nav-text animua-sk-nav-text-${(item % 3) + 1}`)}
          </div>`).join("")}
      </div>
      <div class="animua-sk-account">
        ${skeletonLine("animua-sk-account-avatar")}
        <span>
          ${skeletonLine("animua-sk-account-name")}
          ${skeletonLine("animua-sk-account-role")}
        </span>
      </div>
    </aside>`;
}

function mountInitialSkeleton() {
  const body = document.body;
  if (!body?.classList.contains("loading")) return;

  const embedded = window.self !== window.top
    && new URLSearchParams(window.location.search).get("animuaShell") === "1";
  if (embedded || document.getElementById("animua-initial-skeleton")) return;

  const loader = document.createElement("div");
  loader.id = "animua-initial-skeleton";
  loader.className = "animua-initial-skeleton";
  loader.setAttribute("role", "status");
  loader.setAttribute("aria-label", "Loading ANIMUA workspace");
  loader.innerHTML = `${sidebarSkeletonMarkup()}${workspaceSkeletonMarkup()}`;
  body.append(loader);

  const observer = new MutationObserver(() => {
    if (body.classList.contains("loading")) return;
    loader.classList.add("is-leaving");
    observer.disconnect();
    window.setTimeout(() => loader.remove(), 220);
  });
  observer.observe(body, { attributes: true, attributeFilter: ["class"] });
}

if (document.body) mountInitialSkeleton();
else document.addEventListener("DOMContentLoaded", mountInitialSkeleton, { once: true });
