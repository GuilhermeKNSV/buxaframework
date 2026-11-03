/** Match a folder flyout's button geometry to an actual rendered Foundry
 * sidebar tab. Layout data and native tab handlers are never modified. */
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const rectOf = node => node?.getBoundingClientRect?.();
const visible = (node) => {
  const r=rectOf(node);
  return r && Number.isFinite(r.width) && Number.isFinite(r.height) && r.width >= 20 && r.height >= 20;
};

export function nativeSidebarTabMetrics(tabs, nav) {
  const all = tabs instanceof Map ? [...tabs.entries()] : [...(tabs || [])];
  // Settings cannot be hidden; prefer it as a stable reference even when every
  // other tab has been moved into a folder. Skip Collapse and custom controls.
  const preferred = all.sort(([a],[b]) => (a === 'settings' ? -1 : b === 'settings' ? 1 : 0));
  const navWidth = rectOf(nav)?.width || 0;
  for (const [,entry] of preferred) {
    if (!entry || !visible(entry)) continue;
    // Some V14 themes put data-tab on a full-width wrapper instead of the
    // clickable face. Prefer a nested button/anchor with a usable geometry.
    const inner = entry.querySelectorAll?.('button, a, [role="tab"]') || [];
    const usableInner = [...inner].find(node => visible(node) && rectOf(node).width <= 64 && rectOf(node).height <= 64);
    const face = usableInner || entry;
    const rect = rectOf(face);
    if (!rect || rect.width > 64 || rect.height > 64 || (navWidth && rect.width > navWidth + 2)) continue;
    const icon = face.querySelector?.('i,svg,img') || entry.querySelector?.('i,svg,img');
    let iconSize = 18;
    if (icon) {
      const cs = globalThis.getComputedStyle?.(icon);
      const fontSize = Number.parseFloat(cs?.fontSize);
      const ir=rectOf(icon);
      const measured = icon.matches?.('svg,img') && ir?.width > 0 ? ir.width : fontSize;
      if (Number.isFinite(measured)) iconSize=clamp(Math.round(measured), 12, 30);
    }
    return {
      width: clamp(Math.round(rect.width), 24, 54),
      height: clamp(Math.round(rect.height), 24, 54),
      icon: iconSize
    };
  }
  // In mock/non-rendered environments the fallback matches Foundry's typical
  // sidebar size; the actual runtime always reads a visible native tab.
  return {width:32,height:32,icon:18};
}
