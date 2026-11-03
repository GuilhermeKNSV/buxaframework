/** The dedicated folder insertion slot lives in document.body, not inside the
 * Foundry sidebar's clipped/scrollable navigation. The saved layout is unchanged. */
import { nativeSidebarTabMetrics } from './sidebar-flyout-metrics.js';

const HIT_GAP = 8;
const PADDING = 4;

export function folderDropSlotRect(rect, {width,height}, viewportWidth, viewportHeight, leftSide) {
  if (!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.top)) return null;
  const w = Math.min(54, Math.max(24, width || 32));
  const h = Math.min(54, Math.max(24, height || 32));
  const x = leftSide ? rect.right + HIT_GAP : rect.left - w - HIT_GAP;
  // Never overlap the folder itself or wander outside the viewport.
  if (x < PADDING || x + w > viewportWidth - PADDING) return null;
  const top = Math.min(viewportHeight - h - PADDING, Math.max(PADDING, rect.top + (rect.height - h) / 2));
  if (top < PADDING || top > viewportHeight - h - PADDING) return null;
  return {left:x,top,right:x+w,bottom:top+h,width:w,height:h};
}

export function hitSidebarFolderSlot(point, slots) {
  return slots?.find(({rect}) => rect && point.x >= rect.left && point.x <= rect.right &&
    point.y >= rect.top && point.y <= rect.bottom)?.id || null;
}

export function startSidebarFolderSlots(editor, drag) {
  if (!editor?.nav || !drag || drag.id === 'settings' || drag.id.startsWith('folder-')) return;
  const navRect = editor.nav.getBoundingClientRect();
  const leftSide = navRect.left < window.innerWidth / 2;
  const metrics = nativeSidebarTabMetrics(editor.tabs, editor.nav);
  drag.folderSlots = [];
  for (const folder of editor.nav.querySelectorAll(':scope > .buxa-sb-folder')) {
    if (getComputedStyle(folder).display === 'none') continue;
    const id = folder.dataset.buxaButtonId;
    if (!id || id === drag.id) continue;
    const slot = document.createElement('span');
    slot.className = 'buxa-sb-folder-slot';
    slot.setAttribute('aria-hidden','true');
    slot.innerHTML = '<i class="fa-solid fa-plus" aria-hidden="true"></i>';
    // CSS calc accepts this variable as a signed pixel length.
    slot.style.setProperty('--buxa-sb-slot-slide', `${leftSide ? -(metrics.width + HIT_GAP) : metrics.width + HIT_GAP}px`);
    slot.classList.toggle('from-left-sidebar',leftSide);
    document.body.append(slot);
    drag.folderSlots.push({id,folder,slot,rect:null,leftSide,metrics});
  }
  updateSidebarFolderSlots(editor,drag);
}

export function updateSidebarFolderSlots(editor, drag) {
  if (!drag?.folderSlots?.length) return;
  for (const entry of drag.folderSlots) {
    const rect = entry.folder.isConnected && getComputedStyle(entry.folder).display !== 'none'
      ? folderDropSlotRect(entry.folder.getBoundingClientRect(),entry.metrics,window.innerWidth,window.innerHeight,entry.leftSide)
      : null;
    entry.rect = rect;
    entry.slot.style.display = rect ? 'grid' : 'none';
    if (!rect) continue;
    entry.slot.style.left = `${rect.left}px`;
    entry.slot.style.top = `${rect.top}px`;
    entry.slot.style.width = `${rect.width}px`;
    entry.slot.style.height = `${rect.height}px`;
    entry.slot.classList.toggle('is-armed',drag.into === entry.id);
  }
}

export function removeSidebarFolderSlots(drag) {
  for (const entry of drag?.folderSlots || []) entry.slot.remove();
  if (drag) drag.folderSlots = [];
}
