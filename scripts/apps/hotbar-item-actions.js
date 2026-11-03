import { getSheetConfig } from '../core/config.js';
import { getItemRules } from '../core/item-config.js';
import { rollItemDice } from '../core/item-dice.js';
import { useItemWithoutDice } from '../core/item-use-runtime.js';
import { isRevealed } from '../core/item-discovery.js';
import { openBuxaItemSheet } from './item-sheet.js';
import { notifyWarning } from '../core/notifications.js';
import { openItemContextMenu, closeItemContextMenu } from './item-context-menu.js';
let lastHotbarContextSheet = null;

export async function activateHotbarItem(actor, item) {
  if (!actor?.isOwner || !item || item.parent !== actor || actor.items?.get?.(item.id) !== item) return false;
  try {
    const config = getSheetConfig();
    const rules = getItemRules(item, config);
    const dice = (rules.dice ?? []).find(entry => entry.chatRoll && isRevealed(entry));
    if (dice) return await rollItemDice(item, dice.id, { actor, config });
    if (rules.resourceEffects?.length || rules.limits?.enabled)
      return Boolean(await useItemWithoutDice(item, { actor, config }));
    return openBuxaItemSheet(item);
  } catch (error) {
    notifyWarning(error?.message || 'Unable to use this item.');
    return false;
  }
}
export function openHotbarItemMenu(actor, item, event, root, onRemove = null, locked = false) {
  if (!actor?.isOwner || !item || item.parent !== actor || actor.items?.get?.(item.id) !== item) return false;
  // Reuse the *same* context menu as inventory: roll, recharge, equip, unstack,
  // storage and drop. No duplicate rules or independent item mutations.
  if (lastHotbarContextSheet) closeItemContextMenu(lastHotbarContextSheet);
  const sheet = { actor, element: root, render: () => actor.sheet?.render?.({ force: true }) };
  lastHotbarContextSheet = sheet;
  openItemContextMenu(sheet, item, event, {
    hotbarRemove: onRemove,
    hotbarContext: true,
    hotbarLocked: locked,
    queueMutation: task => Promise.resolve().then(task).catch(error => notifyWarning(error?.message || 'Item action failed.'))
  });
}
