import { actorRarityContext } from '../core/rarity-context.js';
import { applyRarityVisual } from '../core/rarity-visuals.js';
import { getSheetConfig } from '../core/config.js';
import { getEffectiveResourceState } from '../core/resources.js';
import { getItemRarity } from '../core/item-config.js';
import { itemUseState } from '../core/item-use-runtime.js';
import { hotbarSlots } from '../core/hotbar-state.js';
import { buildHotbarAttributeTray, hotbarAttributeColumns } from './hotbar-attributes.js';

const node = (doc, tag, cls, label = '') => {
  const el = doc.createElement(tag); if (cls) el.className = cls; if (label) el.textContent = label; return el;
};
const button = (doc, cls, text, title) => {
  const element = node(doc, 'button', cls, text); element.type = 'button'; if (title) element.title = title; return element;
};
const glyph = (doc, icon) => {
  const i = node(doc, 'i', `fa-solid ${icon}`); i.setAttribute('aria-hidden', 'true'); return i;
};
/** The caption is engraved along the glass's lower rim, not rendered as a pill. */
function appendOrbInscription(doc, shell, label, index) {
  const text = String(label ?? '').trim().slice(0, 22);
  if (!text) return;
  if (typeof doc.createElementNS !== 'function') {
    shell.append(node(doc, 'small', 'buxa-hb-orb-caption', text));
    return;
  }
  const ns = 'http://www.w3.org/2000/svg';
  const svg = doc.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'buxa-hb-orb-inscription');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('aria-hidden', 'true');
  const defs = doc.createElementNS(ns, 'defs');
  const path = doc.createElementNS(ns, 'path');
  const pathId = `buxa-hb-orb-label-${index}`;
  path.setAttribute('id', pathId);
  path.setAttribute('d', 'M 17 78 Q 50 110 83 78');
  defs.append(path);
  const lettering = doc.createElementNS(ns, 'text');
  const textPath = doc.createElementNS(ns, 'textPath');
  textPath.setAttribute('href', `#${pathId}`);
  textPath.setAttribute('startOffset', '50%');
  textPath.setAttribute('text-anchor', 'middle');
  textPath.textContent = text.toUpperCase();
  lettering.append(textPath);
  svg.append(defs, lettering);
  shell.append(svg);
}
function makeOrb(doc, actor, resource, setting, fallbackColor, index) {
  const shell = node(doc, 'div', `buxa-hb-orb buxa-hb-orb-${index}`);
  shell.dataset.hbOrb = String(index);
  const state = actor && resource ? getEffectiveResourceState(actor, resource, getSheetConfig()) : null;
  const percent = state?.max > 0 ? Math.max(0, Math.min(100, 100 * state.current / state.max)) : 0;
  shell.style.setProperty('--buxa-hb-orb-color', resource?.color || fallbackColor);
  shell.style.setProperty('--buxa-hb-orb-fill', `${percent}%`);
  shell.title = resource ? `${resource.label}: ${state?.current ?? 0} / ${state?.max ?? 0}` : 'Configure this resource orb in Hotbar Settings';
  const rim = node(doc, 'div', 'buxa-hb-orb-rim');
  const glass = node(doc, 'div', 'buxa-hb-orb-glass');
  const fluid = node(doc, 'div', 'buxa-hb-orb-fluid');
  fluid.append(node(doc, 'span', 'buxa-hb-wave one'), node(doc, 'span', 'buxa-hb-wave two'));
  fluid.append(node(doc, 'span', 'buxa-hb-bubble bubble-one'), node(doc, 'span', 'buxa-hb-bubble bubble-two'), node(doc, 'span', 'buxa-hb-bubble bubble-three'));
  glass.append(fluid, node(doc, 'span', 'buxa-hb-orb-reflection'));
  if (setting.showNumber && state) glass.append(node(doc, 'strong', 'buxa-hb-orb-value', String(state.current)));
  rim.append(glass); shell.append(rim);
  const seal = node(doc, 'span', 'buxa-hb-orb-seal');
  seal.setAttribute('aria-hidden', 'true');
  shell.append(seal);
  if (resource) appendOrbInscription(doc, shell, resource.label, index);
  return shell;
}
function control(doc, icon, title, action, extra = '') {
  const element = button(doc, `buxa-hb-control ${extra}`, '', title);
  element.dataset.hbAction = action;
  element.append(glyph(doc, icon));
  return element;
}
export function buildHotbarView(doc, state, actor, { isGM = globalThis.game?.user?.isGM === true, selecting = false, attributesOpen = false } = {}) {
  const config = getSheetConfig();
  const root = node(doc, 'section', `buxa-hotbar${selecting ? ' is-selecting' : ''}`);
  applyRarityVisual(root, actorRarityContext(actor, config));
  root.style.setProperty('--buxa-hb-accent', state.color);
  root.style.setProperty('--buxa-hb-columns', String(state.columns));
  root.style.setProperty('--buxa-hb-rows', String(state.rows));
  root.setAttribute('aria-label', 'Buxa custom hotbar');
  const shell = node(doc, 'div', 'buxa-hb-shell');
  const body = node(doc, 'div', 'buxa-hb-body');
  const resources = config.resources ?? [];
  const choice = (orb, i) => resources.find(r => r.id === orb.resourceId) || (!orb.resourceId ? resources[i] : null);
  body.append(makeOrb(doc, actor, choice(state.orbs[0], 0), state.orbs[0], '#d4474f', 0));

  const center = node(doc, 'div', 'buxa-hb-center');
  const rail = node(doc, 'div', 'buxa-hb-rail');
  rail.append(control(doc, 'fa-arrow-left', 'Restore Foundry hotbar', 'toggle', 'buxa-hb-back'));
  const tools = node(doc, 'div', 'buxa-hb-tools');
  tools.append(control(doc, state.locked ? 'fa-lock' : 'fa-lock-open', state.locked ? 'Unlock shortcut editing' : 'Lock shortcut editing', 'lock', state.locked ? 'is-locked' : ''));
  tools.append(control(doc, 'fa-gear', 'Customize hotbar', 'config'));
  rail.append(tools);
  center.append(rail);
  // Keep the drawer mounted while collapsed: moving the same DOM node allows
  // a real closing transition instead of an abrupt remove/recreate.
  const drawer = node(doc, 'div', `buxa-hb-attribute-drawer${attributesOpen ? ' is-open' : ''}`);
  drawer.style.setProperty('--buxa-hb-roll-columns', String(hotbarAttributeColumns((config.attributes?.entries ?? []).filter(entry => entry?.id).length)));
  const tray = buildHotbarAttributeTray(doc, actor);
  tray.id = 'buxa-hotbar-attribute-tray';
  tray.setAttribute('aria-hidden', String(!attributesOpen));
  tray.inert = !attributesOpen;
  const toggle = control(doc, 'fa-chevron-up',
    attributesOpen ? 'Hide attribute rolls' : 'Show attribute rolls', 'attributes', 'buxa-hb-attribute-toggle');
  toggle.setAttribute('aria-expanded', String(attributesOpen));
  toggle.setAttribute('aria-controls', tray.id);
  drawer.append(tray, toggle);
  center.append(drawer);

  const boardFrame = node(doc, 'div', 'buxa-hb-board-frame');
  const board = node(doc, 'div', 'buxa-hb-board');
  board.style.setProperty('--buxa-hb-columns', String(state.columns));
  const slots = hotbarSlots(state, actor?.uuid || actor?.id || '');
  slots.forEach((itemId, index) => {
    const item = actor?.items?.get?.(itemId);
    const slot = button(doc, `buxa-hb-slot ${item ? 'has-item' : ''}`, '', item?.name || `Shortcut ${index + 1}`);
    slot.dataset.hbSlot = String(index);
    slot.dataset.hbTabId = state.activeTab;
    if (item) {
      const rarity = getItemRarity(item, config);
      applyRarityVisual(slot, rarity);
      slot.style.setProperty('--buxa-hb-rarity', rarity?.color || '#93a4b8');
      const art = node(doc, 'img', 'buxa-hb-item-image'); art.src = item.img || 'icons/svg/item-bag.svg'; art.alt = ''; art.draggable = false;
      slot.append(art);
      const quantity = Math.max(0, Number(item.system?.quantity ?? 1));
      if (quantity > 1) slot.append(node(doc, 'small', 'buxa-hb-count', String(quantity)));
      try {
        const usage = itemUseState(item, config);
        if (usage.limits.enabled) {
          slot.append(node(doc, 'small', 'buxa-hb-uses', `${usage.remaining}`));
          if (usage.exhausted) slot.classList.add('is-exhausted');
        }
      } catch { /* malformed legacy item rules must not break hotbar */ }
    } else if (itemId) {
      slot.classList.add('is-missing'); slot.title = 'Item no longer in inventory · right-click to clear';
      slot.append(glyph(doc, 'fa-link-slash'));
    } else if (index < 10 && state.rows === 1) {
      slot.append(node(doc, 'span', 'buxa-hb-slot-index', String((index + 1) % 10)));
    }
    board.append(slot);
  });
  boardFrame.append(board);
  center.append(boardFrame);
  const tabs = node(doc, 'nav', 'buxa-hb-tabs'); tabs.setAttribute('aria-label', 'Hotbar tabs');
  for (const tab of state.tabs) {
    const item = button(doc, `buxa-hb-tab ${tab.id === state.activeTab ? 'is-active' : ''}`, tab.name, `Show ${tab.name}`);
    item.dataset.hbTab = tab.id; item.setAttribute('aria-pressed', String(tab.id === state.activeTab));
    tabs.append(item);
  }
  const lowerRail = node(doc, 'div', 'buxa-hb-lower-rail');
  lowerRail.append(tabs);
  if (isGM) {
    const select = control(doc, 'fa-crosshairs', actor ? `Linked to ${actor.name}. Click to select another token.` : 'Select an Actor on the scene', 'select', `buxa-hb-select ${selecting ? 'is-selecting' : ''}`);
    select.append(node(doc, 'span', 'buxa-hb-select-label', selecting ? 'CLICK TOKEN' : 'SELECT'));
    select.setAttribute('aria-pressed', String(selecting));
    lowerRail.append(select);
  }
  center.append(lowerRail);
  body.append(center);
  body.append(makeOrb(doc, actor, choice(state.orbs[1], 1), state.orbs[1], '#7760b9', 1));
  shell.append(body);
  if (!actor) shell.append(node(doc, 'div', 'buxa-hb-empty-actor', isGM ? 'SELECT A TOKEN TO LINK THIS HOTBAR' : 'ASSIGN YOUR CHARACTER IN USER SETTINGS'));
  root.append(shell);
  return root;
}

/** Toggle in place: never replace the drawer mid-animation. */
export function setHotbarAttributeDrawerState(root, open) {
  const drawer = root?.querySelector?.('.buxa-hb-attribute-drawer');
  if (!drawer) return false;
  drawer.classList.toggle('is-open', Boolean(open));
  const tray = drawer.querySelector('.buxa-hb-attributes');
  if (tray) {
    tray.inert = !open;
    tray.setAttribute('aria-hidden', String(!open));
  }
  const toggle = drawer.querySelector('[data-hb-action="attributes"]');
  if (toggle) {
    toggle.setAttribute('aria-expanded', String(Boolean(open)));
    toggle.title = open ? 'Hide attribute rolls' : 'Show attribute rolls';
  }
  return true;
}
