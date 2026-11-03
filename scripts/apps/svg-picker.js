import { notifyWarning } from "../core/notifications.js";
import { TEMPLATE_PATHS } from "../core/constants.js";
import { getSvgPickerIcons } from "../core/icons.js";
import { BuxaAssetBrowser } from "./asset-browser.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

function cleanPath(value) {
  return String(value || "").trim().slice(0, 500);
}

function isSvgPath(path) {
  const clean = cleanPath(path).split(/[?#]/, 1)[0].toLowerCase();
  return clean.endsWith(".svg");
}

export class BuxaSvgPicker extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "buxa-svg-picker",
    classes: ["buxa", "buxa-svg-picker-app"],
    tag: "div",
    position: { width: 650, height: 560 },
    window: {
      title: "Buxa Framework · SVG Picker",
      icon: "fa-solid fa-icons",
      resizable: true
    },
    actions: {
      selectSvg: BuxaSvgPicker.#selectSvg,
      browseSvg: BuxaSvgPicker.#browseSvg,
      clearSvg: BuxaSvgPicker.#clearSvg
    }
  };

  static PARTS = {
    body: { template: TEMPLATE_PATHS.SVG_PICKER }
  };

  constructor({ current = "", onSelect, ...options } = {}) {
    super({ id: `buxa-svg-picker-${foundry.utils.randomID(5).toLowerCase()}`, ...options });
    this._current = cleanPath(current);
    this._onSelect = typeof onSelect === "function" ? onSelect : null;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return {
      ...context,
      current: this._current,
      icons: getSvgPickerIcons().map((entry) => ({
        ...entry,
        selected: entry.path === this._current
      }))
    };
  }

  async #commit(path) {
    this._current = cleanPath(path);
    await this._onSelect?.(this._current);
    await this.close();
  }

  static async #selectSvg(_event, target) {
    await this.#commit(target.dataset.svgPath || "");
  }

  static async #clearSvg() {
    await this.#commit("");
  }

  static async #browseSvg() {
    const picker = new BuxaAssetBrowser({
      type: "image",
      extensions: ["svg"],
      current: this._current,
      title: "Buxa · SVG Browser",
      onSelect: async (path) => {
        if (!isSvgPath(path)) {
          notifyWarning("Choose an SVG file.");
          return;
        }
        await this.#commit(path);
      }
    });
    await picker.render({ force: true });
  }
}
