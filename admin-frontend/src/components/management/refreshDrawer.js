// Refresh read-only details without jumping back to the top or collapsing an
// action menu the staff member has opened. Confirmation forms live separately.
export function refreshDrawer(root, render) {
  if (!root) return;
  const scrollTop = root.scrollTop;
  const bodyScroll = root.querySelector(".drawer-body")?.scrollTop || 0;
  const focusedId = root.contains(document.activeElement) ? document.activeElement.id : "";
  const actionsOpen = root.querySelector(".management-more-actions")?.open;
  render();
  root.scrollTop = scrollTop;
  const body = root.querySelector(".drawer-body");
  if (body) body.scrollTop = bodyScroll;
  const actions = root.querySelector(".management-more-actions");
  if (actions && actionsOpen !== undefined) actions.open = actionsOpen;
  if (focusedId) document.getElementById(focusedId)?.focus({ preventScroll: true });
}
