/** Per-Actor Player Settings: access and individual token HUD resource designs. */
import { MODULE_ID } from "../core/constants.js";
import { getSheetConfig } from "../core/config.js";
import { getResourceHud, saveResourceHudBatch } from "../core/resource-hud.js";
import { getLinkedUserIds, setLinkedUsers } from "../core/permissions.js";
import { notifyError } from "../core/notifications.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const STYLES = [
  { value: "sao", label: "SAO", description: "Aincrad / Sword Art Online · angular overhead" },
  { value: "classic", label: "Classic", description: "Classic · horizontal bar" },
  { value: "vertical", label: "Vertical", description: "Vertical · side gauge" }
];
const positions = ["top", "bottom", "left", "right"].map(v => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }));
const values = ["inside", "above", "below", "left", "right"].map(v => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }));
const visibility = [
  { value: "everyone", label: "Everyone", description: "Everyone who can see the token" },
  { value: "owner", label: "Owners", description: "Actor owners only" },
  { value: "selected", label: "Selected", description: "Only selected players" }
];
const selectOptions = (items, selected) => items.map(item => ({ ...item, selected: item.value === selected }));

export class BuxaPlayerSettings extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ["buxa", "buxa-player-settings-app"],
    // Controls are read explicitly from data-hud-field; do not use a native
    // form which rejects unnamed inputs and blocks the Save action.
    tag: "div",
    position: { width: 860, height: 760 },
    window: { icon: "fa-solid fa-sliders", resizable: true },
    actions: {}
  };
  static PARTS = { main: { template: `modules/${MODULE_ID}/templates/player-settings.hbs`, scrollable: [".buxa-player-settings-body"] } };

  constructor({ actor, ...options } = {}) {
    super({ id: `buxa-player-settings-${actor?.id ?? "unknown"}`, ...options });
    this.actor = actor;
  }
  get title() { return `Buxa · Player Settings · ${this.actor?.name ?? "Actor"}`; }

  async _prepareContext(options) {
    const base = await super._prepareContext(options);
    const resources = getSheetConfig().resources.map(resource => {
      const settings = getResourceHud(this.actor, resource);
      return {
        id: resource.id, label: resource.label, indicator: resource.color,
        ...settings, styles: selectOptions(STYLES, settings.style),
        positions: selectOptions(positions, settings.position),
        values: selectOptions(values, settings.valuePosition),
        visibilities: selectOptions(visibility, settings.visibility),
        viewers: [...(game.users ?? [])].filter(u => !u.isGM).map(u => ({
          id: u.id, name: u.name, checked: settings.viewers.includes(u.id)
        }))
      };
    });
    const linked = new Set(getLinkedUserIds(this.actor));
    const users = [...(game.users ?? [])]
      .sort((a,b) => Number(b.id === game.user.id) - Number(a.id === game.user.id))
      .map(u => ({ id: u.id, name: u.name, checked: linked.has(u.id), active: u.active, isGM: u.isGM }));
    return { ...base, actor: this.actor, editable: Boolean(this.actor?.isOwner), isGM: game.user.isGM, resources, users };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const resources = [...this.element.querySelectorAll("[data-hud-resource]")];
    const syncViewers = section => {
      const select = section?.querySelector("[data-hud-visibility]");
      const list = section?.querySelector("[data-hud-viewers]");
      if (select && list) list.hidden = select.value !== "selected";
    };
    const syncSummaryState = section => {
      const checkbox = section?.querySelector('[data-hud-field="enabled"]');
      const state = section?.querySelector('[data-hud-state]');
      if (!checkbox || !state) return;
      const on = Boolean(checkbox.checked);
      state.textContent = on ? 'LIVE' : 'OFF';
      state.classList.toggle('is-live', on);
      state.classList.toggle('is-off', !on);
    };
    const syncSegmented = section => {
      section?.querySelectorAll('[data-choice-group]').forEach(group => {
        const target = group.dataset.target;
        const field = section.querySelector(`[data-hud-field="${target}"]`);
        if (!field) return;
        const vertical = target === 'position' && section.querySelector('[data-hud-style]')?.value === 'vertical';
        group.querySelectorAll('[data-choice-value]').forEach(button => {
          const active = button.dataset.choiceValue === field.value;
          button.classList.toggle('is-active', active);
          if (target === 'position') {
            const disabled = vertical && !['left', 'right'].includes(button.dataset.choiceValue);
            button.disabled = disabled;
            button.hidden = false;
          }
        });
      });
    };
    const ensureStyleRules = section => {
      const style = section?.querySelector('[data-hud-style]');
      const position = section?.querySelector('[data-hud-position]');
      if (style && position && style.value === 'vertical' && !['left', 'right'].includes(position.value)) position.value = 'right';
      syncSegmented(section);
    };
    const bindChoiceGroups = section => {
      section.querySelectorAll('[data-choice-group]').forEach(group => {
        group.addEventListener('click', event => {
          const button = event.target.closest('[data-choice-value]');
          if (!button || button.disabled) return;
          const target = group.dataset.target;
          const field = section.querySelector(`[data-hud-field="${target}"]`);
          if (!field) return;
          field.value = button.dataset.choiceValue;
          if (target === 'style') ensureStyleRules(section);
          syncSegmented(section);
          syncViewers(section);
        });
      });
    };
    const bindRanges = section => {
      const pairs = new Set([
        ...[...section.querySelectorAll('[data-range-for]')].map(input => input.dataset.rangeFor),
        ...[...section.querySelectorAll('[data-number-for]')].map(input => input.dataset.numberFor)
      ]);
      for (const key of pairs) {
        const range = section.querySelector(`[data-range-for="${key}"]`);
        const number = section.querySelector(`[data-number-for="${key}"]`);
        const syncFrom = source => {
          const value = source.value;
          if (range && source !== range) range.value = value;
          if (number && source !== number) number.value = value;
        };
        range?.addEventListener('input', () => syncFrom(range));
        number?.addEventListener('input', () => syncFrom(number));
      }
    };
    resources.forEach(section => {
      bindChoiceGroups(section);
      bindRanges(section);
      section.querySelectorAll('[data-hud-visibility], [data-hud-style]').forEach(field => field.addEventListener('change', () => {
        ensureStyleRules(section);
        syncViewers(section);
      }));
      const enabledField = section.querySelector('[data-hud-field="enabled"]');
      enabledField?.addEventListener?.('change', () => syncSummaryState(section));
      const colorField = section.querySelector('[data-hud-field="color"]');
      colorField?.addEventListener?.('input', event => {
        const text = event.currentTarget.closest?.('.buxa-ps-color-field')?.querySelector?.('span');
        if (text) text.textContent = event.currentTarget.value;
      });
      ensureStyleRules(section);
      syncViewers(section);
      syncSummaryState(section);
    });
    this.element.querySelector("[data-player-settings-close]")?.addEventListener("click", () => this.close());
    this.element.querySelector("[data-player-settings-save]")?.addEventListener("click", () => void this._saveSettings());
  }

  async _saveSettings() {
    if (!this.actor?.isOwner || this._saving) return false;
    this._saving = true;
    const button = this.element.querySelector("[data-player-settings-save]");
    if (button) button.disabled = true;
    try {
      const resources = getSheetConfig().resources;
      const updates = {};
      for (const resource of resources) {
        const row = [...this.element.querySelectorAll("[data-hud-resource]")]
          .find(node => node.dataset.hudResource === resource.id);
        if (!row) continue;
        const get = key => row.querySelector(`[data-hud-field="${key}"]`);
        const checked = key => Boolean(get(key)?.checked);
        updates[resource.id] = {
          enabled: checked("enabled"),
          style: get("style")?.value,
          position: get("position")?.value,
          visibility: get("visibility")?.value,
          viewers: [...row.querySelectorAll("[data-hud-viewer]:checked")].map(input => input.value),
          showValue: checked("showValue"), showMax: checked("showMax"), showLabel: checked("showLabel"),
          valuePosition: get("valuePosition")?.value,
          scale: get("scale")?.value, thickness: get("thickness")?.value,
          opacity: get("opacity")?.value, offsetX: get("offsetX")?.value,
          offsetY: get("offsetY")?.value, color: get("color")?.value
        };
      }
      if (!await saveResourceHudBatch(this.actor, updates, resources)) throw new Error("Resource settings were not saved");
      if (game.user.isGM) {
        const linked = [...this.element.querySelectorAll("[data-link-user]:checked")].map(input => input.value);
        if (JSON.stringify([...getLinkedUserIds(this.actor)].sort()) !== JSON.stringify(linked.sort())) {
          if (!await setLinkedUsers(this.actor, linked)) throw new Error("Player links were not saved");
        }
      }
      await this.close();
      return true;
    } catch (error) {
      console.error(`${MODULE_ID} | Failed saving Player Settings`, error);
      notifyError("Could not save Player Settings. Check console for details.");
      return false;
    } finally {
      this._saving = false;
      if (button?.isConnected) button.disabled = false;
    }
  }
}
