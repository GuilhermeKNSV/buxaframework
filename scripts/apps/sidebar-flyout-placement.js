/** Keep folder buttons on the BOARD side of the *visible* Foundry sidebar,
 * not inside a newly expanded directory. These helpers are layout-only and
 * never change Foundry's own position, navigation or saved button layout. */
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const validRect = (rect, width) => rect && Number.isFinite(rect.left) &&
  Number.isFinite(rect.right) && rect.width >= 96 && rect.width < width - 12;

/** The #sidebar root may be a viewport-wide wrapper in themed Foundry builds.
 * Prefer the visible directory content when that wrapper is not useful. */
export function visibleSidebarPane(root, {viewportWidth = globalThis.innerWidth || 1280, getStyle = globalThis.getComputedStyle} = {}) {
  if (!root?.getBoundingClientRect) return null;
  const panes = root.querySelectorAll?.(
    '.sidebar-tab, .sidebar-content, [data-part="content"], [data-part="sidebar-content"]'
  ) || [];
  for (const node of panes) {
    if (node.hidden || !node.getBoundingClientRect) continue;
    const style = typeof getStyle === 'function' ? getStyle(node) : null;
    if (style?.display === 'none' || style?.visibility === 'hidden' || Number(style?.opacity ?? 1) === 0) continue;
    const rect = node.getBoundingClientRect();
    if (validRect(rect, viewportWidth) && rect.height > 100) return rect;
  }
  const rootRect = root.getBoundingClientRect();
  return validRect(rootRect, viewportWidth) ? rootRect : null;
}

/** The preferred direction is the side with room OUTSIDE both rail and
 * expanded content. If the viewport is very narrow, the caller switches to
 * a compact vertical strip rather than overlapping the directory. */
export function sidebarFlyoutLane({viewportWidth, navRect, sourceRect, sidebarRect, paneRect, rightSidebar}) {
  const margin = 6;
  const panel = validRect(paneRect, viewportWidth) ? paneRect
    : validRect(sidebarRect, viewportWidth) ? sidebarRect : null;
  const leftEdge = Math.min(sourceRect.left, navRect.left, panel?.left ?? Infinity);
  const rightEdge = Math.max(sourceRect.right, navRect.right, panel?.right ?? -Infinity);
  const leftRoom = Math.max(0, leftEdge - margin * 2 - 9);
  const rightRoom = Math.max(0, viewportWidth - rightEdge - margin * 2 - 9);
  // If a real directory panel is visible, using the rail's screen half to
  // choose the side is wrong: in a narrow Foundry window the pane can fill
  // the entire right side while its tab rail remains on the left.
  const towardLeft = panel
    ? leftRoom > rightRoom || (leftRoom === rightRoom && Boolean(rightSidebar))
    : Boolean(rightSidebar);
  return {edge: towardLeft ? leftEdge : rightEdge,
    room: Math.max(0, towardLeft ? leftRoom : rightRoom), margin,
    rightSidebar: towardLeft};
}
export function sidebarFlyoutX({viewportWidth, width, lane, rightSidebar = lane.rightSidebar}) {
  return clamp(rightSidebar ? lane.edge - width - 9 : lane.edge + 9,
    lane.margin, Math.max(lane.margin, viewportWidth - width - lane.margin));
}
