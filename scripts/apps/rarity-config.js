import { createItemRarity } from "../core/item-config.js";

function esc(value) { return foundry.utils.escapeHTML(String(value ?? "")); }

function rarityRowHtml(rarity) {
  return `<article class="buxa-rarity-config-row" data-rarity-row data-rarity-id="${esc(rarity.id)}" style="--buxa-rarity-preview:${esc(rarity.color)}">
    <div class="buxa-rarity-config-main">
      <span class="buxa-rarity-swatch"></span>
      <label><span>Name</span><input data-rarity-label type="text" value="${esc(rarity.label)}"></label>
      <label><span>Color</span><input data-rarity-color type="color" value="${esc(rarity.color)}"></label>
      <span class="buxa-rarity-config-id">${esc(rarity.id)}</span>
      <button type="button" data-rarity-action="remove" title="Remove rarity">×</button>
    </div>
    <div class="buxa-rarity-config-flags">
      <label><input data-rarity-name-color type="checkbox" ${rarity.nameColor ? "checked" : ""}> Name color</label>
      <label><input data-rarity-animated type="checkbox" ${rarity.animated ? "checked" : ""}> Animated glow</label>
      <label><input data-rarity-ornament type="checkbox" ${rarity.ornament ? "checked" : ""}> Ornament</label>
      <label><input data-rarity-spectrum type="checkbox" ${rarity.spectrum ? "checked" : ""}> Spectrum / RGB</label>
      <label><input data-rarity-glint type="checkbox" ${rarity.glint ? "checked" : ""}> Name glint</label>
    </div>
    <label class="buxa-rarity-beam-opacity"><span>Beam opacity</span><input type="range" data-rarity-beam-opacity-slider min="0" max="100" step="1" value="${esc(rarity.beamOpacity ?? 100)}"><input type="number" data-rarity-beam-opacity-number min="0" max="100" step="1" value="${esc(rarity.beamOpacity ?? 100)}"><small>%</small></label>
    <div class="buxa-rarity-background-config">
      <span>Background</span>
      <div class="buxa-rarity-background-options">
        <label><input data-rarity-background type="radio" name="rarity-background-${esc(rarity.id)}" value="glint" ${rarity.backgroundMode === "full" ? "" : "checked"}><span>GLINT</span></label>
        <label><input data-rarity-background type="radio" name="rarity-background-${esc(rarity.id)}" value="full" ${rarity.backgroundMode === "full" ? "checked" : ""}><span>FULL COLOR</span></label>
      </div>
    </div>
  </article>`;
}

function rowData(row) {
  return {
    id: row.dataset.rarityId,
    label: row.querySelector("[data-rarity-label]")?.value || "RARITY",
    color: row.querySelector("[data-rarity-color]")?.value || "#9098a6",
    nameColor: Boolean(row.querySelector("[data-rarity-name-color]")?.checked),
    animated: Boolean(row.querySelector("[data-rarity-animated]")?.checked),
    ornament: Boolean(row.querySelector("[data-rarity-ornament]")?.checked),
    spectrum: Boolean(row.querySelector("[data-rarity-spectrum]")?.checked),
    glint: Boolean(row.querySelector("[data-rarity-glint]")?.checked),
    beamOpacity: Number(row.querySelector("[data-rarity-beam-opacity-number]")?.value ?? 100),
    backgroundMode: row.querySelector("[data-rarity-background]:checked")?.value === "full" ? "full" : "glint"
  };
}

export function readRarityRows(root) {
  return [...root.querySelectorAll("[data-rarity-row]")].map(rowData);
}

export function bindRarityConfig(app) {
  const root = app?.element;
  if (!root) return;
  const list = root.querySelector("[data-rarity-list]");
  root.querySelector("[data-rarity-add]")?.addEventListener("click", () => {
    if (!list) return;
    const existing = [...list.querySelectorAll("[data-rarity-row]")].map(rowData);
    const rarity = createItemRarity(existing);
    list.insertAdjacentHTML("beforeend", rarityRowHtml(rarity));
  });
  list?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-rarity-action='remove']");
    if (!button) return;
    if (list.querySelectorAll("[data-rarity-row]").length <= 1) return;
    button.closest("[data-rarity-row]")?.remove();
  });
  list?.addEventListener("input", (event) => {
    const row = event.target.closest("[data-rarity-row]");
    if (!row) return;
    if (event.target.matches("[data-rarity-color]")) row.style.setProperty("--buxa-rarity-preview", event.target.value);
    if (event.target.matches("[data-rarity-beam-opacity-slider],[data-rarity-beam-opacity-number]")) {
      const value=Math.max(0,Math.min(100,Number(event.target.value)||0));
      const slider=row.querySelector('[data-rarity-beam-opacity-slider]');
      const input=row.querySelector('[data-rarity-beam-opacity-number]');
      if(slider) slider.value=String(value);
      if(input) input.value=String(value);
    }
  });
  root.querySelector("[data-rarity-global-opacity]")?.addEventListener("input", (event) => {
    const output = root.querySelector("[data-rarity-global-opacity-output]");
    if (output) output.textContent = `${event.target.value}%`;
  });
  root.querySelector("[data-rarity-global-brightness]")?.addEventListener("input", (event) => {
    const output = root.querySelector("[data-rarity-global-brightness-output]");
    if (output) output.textContent = `${event.target.value}%`;
  });
}

export function readRarityBackground(root) {
  return {
    opacity: Number(root?.querySelector("[data-rarity-global-opacity]")?.value ?? 100),
    brightness: Number(root?.querySelector("[data-rarity-global-brightness]")?.value ?? 100)
  };
}
