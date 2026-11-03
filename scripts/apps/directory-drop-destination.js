/** Shared drop targeting for Item, Actor and Scene directory workspaces.
 * A tab is a view backed by a hidden folder, not the same as the globally
 * shared Main folder. Dropping in empty space on the Main tab moves a document
 * OUT of Main into the ordinary root; only dropping ON Main moves into Main. */
import { folderIdOf } from './item-directory-cards.js';

export function directoryBlankDestination(activeTab = null) {
  return activeTab || null;
}

/** The explicit folder card always wins. Empty workspace means its tab root. */
export function directoryDropDestination({ activeTab = null, folderId = null, targetDocument = null, panelFolderId = null } = {}) {
  if (targetDocument) return folderIdOf(targetDocument);
  if (folderId != null && folderId !== '') return folderId;
  if (panelFolderId != null && panelFolderId !== '') return panelFolderId;
  return directoryBlankDestination(activeTab);
}

/** Allow drops over the full workspace/list, including an empty scroll area,
 * but never steal drops from tab buttons or interactive toolbar/search inputs. */
export function directoryDropSurface(target, shell, { panel = false } = {}) {
  if (!target?.closest || !shell?.contains?.(target)) return false;
  if (target.closest('.buxa-directory-tabs, .buxa-world-toolbar, .buxa-world-searchbar, .buxa-multiedit-toggle')) return false;
  if (panel) return Boolean(target.closest('.buxa-folder-panel'));
  return Boolean(target.closest('.buxa-world-list, .buxa-world-item-directory'));
}
