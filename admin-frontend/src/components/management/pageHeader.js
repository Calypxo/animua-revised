import "../../css/managementRefresh.css";
import "../../css/pageHeader.css";

const escapeHtml = value => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const iconClass = value => String(value || "bi-grid-fill").replace(/[^a-zA-Z0-9\s-]/g, "");

function renderAction(action = {}, index = 0) {
  const id = action.id ? ` id="${escapeHtml(action.id)}"` : "";
  const variant = action.variant === "secondary" ? " is-secondary" : "";
  const icon = `<i class="bi ${iconClass(action.icon || "bi-arrow-right")}" aria-hidden="true"></i>`;
  const label = `<span>${escapeHtml(action.label || "Open")}</span>`;

  if (action.href) {
    return `<a class="system-header-action${variant}"${id} href="${escapeHtml(action.href)}" data-header-action="${index}">${icon}${label}</a>`;
  }

  return `<button class="system-header-action${variant}"${id} type="button" data-header-action="${index}">${icon}${label}</button>`;
}

function renderMetric(metric = {}, index = 0) {
  const tone = ["clay", "amber", "blue", "green", "rose", "stone"][index % 6];
  const id = metric.id ? ` id="${escapeHtml(metric.id)}"` : "";
  const value = metric.value ?? 0;

  return `
    <article class="system-summary-metric" data-tone="${escapeHtml(metric.tone || tone)}">
      <span class="system-summary-icon"><i class="bi ${iconClass(metric.icon)}" aria-hidden="true"></i></span>
      <span class="system-summary-copy"><strong${id}>${escapeHtml(value)}</strong><small>${escapeHtml(metric.label)}</small></span>
    </article>`;
}

export function renderPageHeader(config = {}, target = "#pageHeaderMount") {
  const mount = typeof target === "string" ? document.querySelector(target) : target;

  if (!mount) {
    console.warn("[pageHeader] Mount target not found:", target);
    return null;
  }

  const headingId = config.headingId || "systemPageTitle";
  const highlights = Array.isArray(config.highlights) ? config.highlights : [];
  const actions = Array.isArray(config.actions) ? config.actions : [];
  const metrics = Array.isArray(config.metrics) ? config.metrics : [];
  const queue = config.queue || {};

  mount.className = "system-page-header";
  mount.innerHTML = `
    <section class="system-page-hero" aria-labelledby="${escapeHtml(headingId)}">
      <i class="bi ${iconClass(config.watermarkIcon)} system-hero-watermark" aria-hidden="true"></i>
      <div class="system-hero-copy">
        <span class="system-hero-eyebrow">${escapeHtml(config.eyebrow)}</span>
        <h1 id="${escapeHtml(headingId)}">${escapeHtml(config.title)}</h1>
        <p>${escapeHtml(config.description)}</p>
        <div class="system-hero-highlights" aria-label="${escapeHtml(config.highlightsLabel || "Workspace capabilities")}">
          ${highlights.map(item => `<span><i class="bi ${iconClass(item.icon)}" aria-hidden="true"></i>${escapeHtml(item.label)}</span>`).join("")}
        </div>
      </div>
      <aside class="system-hero-operations" aria-label="${escapeHtml(config.operationsLabel || "Page actions")}">
        <div class="system-hero-live"><span aria-hidden="true"></span>${escapeHtml(queue.liveLabel || "Workspace active")}</div>
        <div class="system-hero-queue">
          <div><small>${escapeHtml(queue.label || "Priority queue")}</small><strong>${escapeHtml(queue.title || "Records awaiting review")}</strong></div>
          <div class="system-queue-badge"><strong${queue.valueId ? ` id="${escapeHtml(queue.valueId)}"` : ""}>${escapeHtml(queue.value ?? 0)}</strong><span>${escapeHtml(queue.unit || "pending")}</span></div>
        </div>
        <div class="system-header-actions">${actions.map(renderAction).join("")}</div>
      </aside>
    </section>
    ${metrics.length ? `
      <section class="system-summary" data-count="${metrics.length}" style="--summary-count:${metrics.length}" aria-label="${escapeHtml(config.summaryLabel || `${config.title || "Page"} summary`)}">
        <span class="system-summary-label">${escapeHtml(config.summaryLabel || "Summary")}</span>
        ${metrics.map(renderMetric).join("")}
      </section>` : ""}`;

  return mount;
}
