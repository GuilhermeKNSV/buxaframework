/** Compact hotbar attribute tray. Roll logic is shared with character sheets. */
import { getSheetConfig } from '../core/config.js';
import { getAttributeValue, getAttributeModifier, getAttributeDice, getAttributeRebirths, getAttributeVisual } from '../core/attributes.js';
import { rollAttribute } from './attribute-roll.js';

let activeMenu = null;
export function closeHotbarAttributeMenu() {
  activeMenu?.();
  activeMenu = null;
}

export function hotbarAttributeAbbreviation(label) {
  const words = String(label || '').trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return words.map(word => word[0]).join('').slice(0, 4).toUpperCase();
  return (words[0] || '?').slice(0, 3).toUpperCase();
}

/** Use the world's rebirth palette, including its neutral (R0) tier.
 * Reject malformed legacy colors rather than flashing an invalid CSS value. */
export function hotbarAttributeRarityColor(attribute, tier, config) {
  const candidate = String(attribute?.rebirth?.enabled
    ? getAttributeVisual(attribute, tier, config)?.color
    : (config?.rebirthStyles?.[0]?.color ?? '#8b93a1')).trim();
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(candidate) ? candidate : '#8b93a1';
}

/** Keep the drawer control in the color of the strongest displayed rebirth. */
export function hotbarAttributeDrawerColor(actor, config = getSheetConfig()) {
  const attributes = (config.attributes?.entries ?? []).filter(entry => entry?.id && entry.rebirth?.enabled);
  if (!attributes.length) return '#8b93a1';
  const strongest = attributes.map(attribute => ({
    attribute, tier: actor ? getAttributeRebirths(actor, attribute.id, config) : 0
  })).sort((a, b) => b.tier - a.tier)[0];
  return hotbarAttributeRarityColor(strongest.attribute, strongest.tier, config);
}

/** Balance large attribute sets into similarly sized rows (never a long, mostly empty shelf). */
export function hotbarAttributeColumns(count) {
  const n = Math.max(0, Math.trunc(Number(count) || 0));
  return Math.max(1, Math.ceil(n / Math.ceil(Math.max(1, n) / 8)));
}

export function buildHotbarAttributeTray(doc, actor) {
  const tray = doc.createElement('div');
  tray.className = 'buxa-hb-attributes';
  tray.setAttribute('aria-label', 'Attribute rolls');
  const list = doc.createElement('div');
  list.className = 'buxa-hb-attribute-list';
  const config = getSheetConfig();
  const attributes = (config.attributes?.entries ?? []).filter(entry => Boolean(entry?.id));
  const columns = hotbarAttributeColumns(attributes.length);
  tray.style.setProperty('--buxa-hb-roll-columns', String(columns));
  for (const attribute of attributes) {
    if (!attribute?.id) continue;
    const value = actor ? getAttributeValue(actor, attribute, config) : 0;
    const rebirths = actor ? getAttributeRebirths(actor, attribute.id, config) : 0;
    const dice = actor ? getAttributeDice(attribute, rebirths, actor, config) : 1;
    const modifier = actor ? getAttributeModifier(attribute, value, rebirths, actor, config) : null;
    const modText = (Number(modifier ?? 0) >= 0 ? `+${Number(modifier ?? 0)}` : String(modifier));
    const tile = doc.createElement('button');
    tile.type = 'button';
    tile.className = dice > 1 ? 'buxa-hb-attribute has-extra-dice' : 'buxa-hb-attribute';
    tile.dataset.hbAttribute = attribute.id;
    tile.style.setProperty('--buxa-hb-attr-color', hotbarAttributeRarityColor(attribute, rebirths, config));
    tile.dataset.hbRebirth = String(rebirths);
    tile.title = `${attribute.label}: ${dice}d20 · Modifier ${modText} · Left-click to roll · Right-click for advantage/disadvantage`;
    tile.setAttribute('aria-label', `${attribute.label}, ${modText}. Click to roll. Right click for advantage or disadvantage.`);
    tile.setAttribute('aria-haspopup', 'menu');
    tile.disabled = !actor?.isOwner;
    const name = doc.createElement('span'); name.className = 'buxa-hb-attr-name';
    name.textContent = hotbarAttributeAbbreviation(attribute.label);
    const amount = doc.createElement('strong'); amount.className = 'buxa-hb-attr-mod'; amount.textContent = modText;
    const count = doc.createElement('small'); count.className = 'buxa-hb-attr-dice'; count.textContent = `${dice}d20`;
    tile.append(name, amount, count);
    list.append(tile);
  }
  if (!list.childElementCount) {
    const empty = doc.createElement('span'); empty.className = 'buxa-hb-attributes-empty';
    empty.textContent = 'No configured attributes'; list.append(empty);
  }
  tray.append(list);
  return tray;
}

export function openHotbarAttributeMenu(actor, attribute, event, doc = globalThis.document) {
  closeHotbarAttributeMenu();
  if (!actor?.isOwner || !attribute || !doc?.body) return false;
  const menu = doc.createElement('div');
  menu.className = 'buxa-hb-attribute-menu';
  menu.setAttribute('role', 'menu');
  for (const [mode, label, symbol] of [['advantage','Advantage','+'], ['disadvantage','Disadvantage','−']]) {
    const option = doc.createElement('button');
    option.type = 'button'; option.dataset.hbRollMode = mode;
    option.setAttribute('role', 'menuitem');
    const mark = doc.createElement('b'); mark.textContent = symbol;
    const text = doc.createElement('span'); text.textContent = label;
    option.append(mark, text);
    option.addEventListener('click', click => {
      click.preventDefault(); click.stopPropagation(); closeHotbarAttributeMenu();
      void rollAttribute({ actor }, attribute, mode);
    });
    menu.append(option);
  }
  doc.body.append(menu);
  const windowRef = doc.defaultView ?? globalThis.window;
  const bounds = menu.getBoundingClientRect();
  const width = windowRef?.innerWidth ?? 1024;
  const height = windowRef?.innerHeight ?? 768;
  menu.style.left = `${Math.max(5, Math.min(event.clientX, width - bounds.width - 5))}px`;
  menu.style.top = `${Math.max(5, Math.min(event.clientY, height - bounds.height - 5))}px`;
  const outside = pointer => { if (!menu.contains(pointer.target)) closeHotbarAttributeMenu(); };
  const keyboard = key => { if (key.key === 'Escape') closeHotbarAttributeMenu(); };
  const cleanup = () => {
    doc.removeEventListener('pointerdown', outside, true);
    doc.removeEventListener('keydown', keyboard, true);
    menu.remove();
  };
  doc.addEventListener('pointerdown', outside, true);
  doc.addEventListener('keydown', keyboard, true);
  activeMenu = cleanup;
  return true;
}

export function bindHotbarAttributeTray(root, actor, doc = globalThis.document) {
  const entries = getSheetConfig().attributes?.entries ?? [];
  for (const tile of root.querySelectorAll('[data-hb-attribute]')) {
    const attribute = entries.find(entry => entry.id === tile.dataset.hbAttribute);
    if (!attribute || !actor?.isOwner) continue;
    tile.addEventListener('click', event => {
      event.preventDefault();
      closeHotbarAttributeMenu();
      tile.classList.add('is-rolling');
      doc.defaultView?.setTimeout?.(() => tile.classList.remove('is-rolling'), 400);
      void rollAttribute({ actor }, attribute, 'normal');
    });
    tile.addEventListener('contextmenu', event => {
      event.preventDefault(); event.stopPropagation();
      openHotbarAttributeMenu(actor, attribute, event, doc);
    });
  }
}
