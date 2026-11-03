/** Shared, dependency-free item previews for the World Item directory and
 * nested folder panels. Presentation only; never mutate Item documents. */
import { MODULE_ID } from "../core/constants.js";
import { itemDisplayLabel } from "../core/item-type-label.js";
import { getItemKind } from "../core/effect-config.js";

const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const hexColor = (color, fallback = "#8797aa") => /^#[a-f\d]{6}$/i.test(String(color)) ? String(color) : fallback;
export const MAIN_FOLDER_COLOR = "#d9434e";
export const folderIdOf = (document) => typeof document?.folder === "string" ? document.folder : document?.folder?.id ?? null;

export function itemCardData(item, rarities = []) {
  const kind = getItemKind(item);
  const flags = kind === 'effect' ? (item?.flags?.[MODULE_ID]?.effect ?? {}) : (item?.flags?.[MODULE_ID]?.item ?? {});
  const rarity = rarities.find((entry) => entry.id === flags.rarityId)
    ?? rarities.find((entry) => entry.id === "common")
    ?? { id: "common", label: "COMMON", color: "#9098a6" };
  const quantityValue = Number(item?.system?.quantity);
  const quantity = Number.isFinite(quantityValue) ? Math.max(0, Math.floor(quantityValue)) : 1;
  const type = itemDisplayLabel(flags);
  const requirement = flags?.levelRequirement?.enabled
    ? `LV ${Math.max(0, Math.floor(Number(flags.levelRequirement.level) || 0))}` : "";
  return {
    id: String(item?.id ?? ""), name: String(item?.name || "Unnamed"),
    image: String(item?.img || "icons/svg/item-bag.svg"),
    rarityId: String(rarity.id || "common"), rarity: String(rarity.label || "COMMON"),
    color: hexColor(rarity.color), type: type.toUpperCase(),
    kind, quantity, requirement, animated: Boolean(rarity.glint || rarity.animated),
    folderId: folderIdOf(item)
  };
}

/** HTML for a single compact card. The button is the real drag and click target. */
export function renderItemCard(item, rarities = [], { panel = false, folderLabel = "" } = {}) {
  const data = itemCardData(item, rarities);
  const classes = ["buxa-world-item-card", panel ? "buxa-folder-entry is-item" : "buxa-world-row", data.animated ? "is-glint" : ""].filter(Boolean).join(" ");
  return `<button type="button" class="${classes}" draggable="true" data-buxa-item="${escape(data.id)}" ${panel ? "" : `data-buxa-dir-item="${escape(data.id)}"`} style="--buxa-card-accent:${data.color}" title="${escape(data.name)}">
    <span class="buxa-world-art"><img loading="lazy" draggable="false" src="${escape(data.image)}" alt="" /></span>
    <span class="buxa-world-details"><span class="buxa-world-item-name">${escape(data.name)}</span>
      <span class="buxa-world-meta"><span class="buxa-world-rarity">${escape(data.rarity)}</span>${data.kind !== 'item' ? `<span class="bfx-directory-kind" title="${escape(data.kind)}"><i class="fa-solid ${data.kind === 'effect' ? 'fa-bolt' : 'fa-wand-sparkles'}"></i> ${escape(data.kind.toUpperCase())}</span>` : ''}${data.type ? `<span class="buxa-world-meta-sep"></span><span class="buxa-world-type">${escape(data.type)}</span>` : ""}${data.requirement ? `<span class="buxa-world-level">${escape(data.requirement)}</span>` : ""}${folderLabel ? `<span class="buxa-world-path">${escape(folderLabel)}</span>` : ""}</span>
    </span>${data.quantity > 1 ? `<span class="buxa-world-quantity">×${data.quantity}</span>` : ""}
  </button>`;
}

export function renderFolderCard(folder, { panel = false, count = 0, expanded = false, left = false, main = false } = {}) {
  const id = escape(folder.id);
  const name = escape(folder.name);
  const color = main ? MAIN_FOLDER_COLOR : hexColor(folder.color, "#819bb3");
  const tabRoot = folder.flags?.[MODULE_ID]?.directoryTab === folder.type;
  const movable = !main && !tabRoot;
  return `<button type="button" class="buxa-world-folder-card ${main ? "is-main" : ""} ${tabRoot ? "is-tab-root" : ""} ${panel ? "buxa-folder-entry is-folder" : "buxa-world-row"}" ${panel ? `data-buxa-folder="${id}" draggable="${movable}"` : `data-buxa-dir-folder="${id}" draggable="${movable}" aria-expanded="${Boolean(expanded)}"`} style="--buxa-folder-accent:${color}" title="${name}">
    <span class="buxa-world-folder-art"><i class="fa-solid fa-folder${expanded ? "-open" : ""}"></i></span>
    <span class="buxa-world-details"><span class="buxa-world-item-name">${name}</span><span class="buxa-world-folder-caption">${count} ${count === 1 ? "ENTRY" : "ENTRIES"}</span></span>
    <i class="buxa-world-folder-chevron fa-solid fa-chevron-${left ? "left" : expanded ? "down" : "right"}"></i>
  </button>`;
}
