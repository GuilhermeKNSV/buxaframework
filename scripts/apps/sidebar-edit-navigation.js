import { SIDEBAR_DEFAULT_TABS } from '../core/sidebar-button-layout.js';

// Foundry V14 uses ApplicationV2 for Sidebar. Different V14 builds and
// sidebar mods can put data-tab on the button, the wrapping li, or an inner
// button, so do not assume each direct nav child has data-tab itself.
const SIDEBAR_TAB_NAMES = new Set(SIDEBAR_DEFAULT_TABS);
export function tabId(node) {
  if (!node?.getAttribute) return '';
  const id = node.getAttribute('data-tab')
    || node.getAttribute('data-buxa-special')
    || node.querySelector?.('[data-tab]')?.getAttribute('data-tab')
    || '';
  // Fold legacy spellings into the saved layout vocabulary.
  return id === 'compendiums' ? 'compendium' : id;
}
function tabEntries(nav) {
  if (!nav?.children) return [];
  return [...nav.children].filter(child => {
    if (child.classList?.contains('buxa-sb-folder') || child.classList?.contains('buxa-sb-edit-button')) return false;
    return Boolean(tabId(child)) && !child.classList?.contains('sidebar-tab');
  });
}
export function isCollapse(node) {
  if (!node?.getAttribute || tabId(node)) return false;
  const text = [node.getAttribute('title'), node.getAttribute('aria-label'),
    node.querySelector?.('[title],[aria-label]')?.getAttribute('title'),
    node.querySelector?.('[title],[aria-label]')?.getAttribute('aria-label')].filter(Boolean).join(' ');
  return Boolean(node.matches?.('[data-action*="toggleState"], [data-action*="toggleExpanded"], [data-action*="collapse"], #sidebar-collapse, .sidebar-collapse') ||
    node.querySelector?.('[data-action*="toggleState"], [data-action*="toggleExpanded"], [data-action*="collapse"], #sidebar-collapse, .sidebar-collapse') ||
    /collaps|expand/i.test(text));
}
export function locateSidebarNavigation(root = globalThis.document?.querySelector?.('#sidebar') || globalThis.ui?.sidebar?.element) {
  if (root && !root.querySelectorAll && root[0]?.querySelectorAll) root = root[0];
  if (!root?.querySelectorAll) return null;
  const candidates = new Set(root.querySelectorAll(
    '#sidebar-tabs, .sidebar-tabs, [data-part="tabs"], nav.tabs, [role="tablist"], .sidebar-nav, menu, nav'
  ));
  // Even when the container has no recognizable id/class, the common
  // ancestor of native buttons is a valid candidate. Include the ancestors of
  // distinctive sidebar tabs rather than only their immediate wrappers.
  for (const entry of root.querySelectorAll('[data-tab="settings"], [data-tab="chat"], [data-tab="combat"]')) {
    for (let ancestor = entry.parentElement; ancestor && ancestor !== root; ancestor = ancestor.parentElement)
      candidates.add(ancestor);
  }
  // Unnamed menus are used in some Foundry V14 layouts. Score navigation by
  // the number of recognizable sidebar tab IDs, never by generic [data-tab].
  let winner = null;
  let score = 0;
  for (const node of candidates) {
    const entries = tabEntries(node);
    const ids = entries.map(tabId);
    const known = ids.filter(id => SIDEBAR_TAB_NAMES.has(id));
    if (known.length < 4 || !known.includes('settings')) continue;
    const quality = known.length * 2 + (known.includes('chat') ? 4 : 0) + (known.includes('combat') ? 3 : 0);
    if (quality > score) { score = quality; winner = {root,nav:node,tabs:entries}; }
  }
  if (!winner) return null;
  const collapse = [...winner.nav.children].find(isCollapse);
  if (collapse) {
    collapse.dataset.buxaSpecial = 'collapse';
    winner.tabs.push(collapse);
  }
  return winner;
}
