import { TEMPLATE_PATHS } from "../core/constants.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class BuxaAttributeSetter extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "buxa-attribute-setter",
    classes: ["buxa", "buxa-attribute-setter-app"],
    tag: "form",
    position: { width: 360, height: "auto" },
    window: {
      icon: "fa-solid fa-sliders",
      resizable: false
    },
    form: {
      handler: BuxaAttributeSetter.#onSubmit,
      closeOnSubmit: true,
      submitOnChange: false
    }
  };

  static PARTS = {
    form: { template: TEMPLATE_PATHS.ATTRIBUTE_SETTER }
  };

  constructor({ actor, attribute, resolve, ...options } = {}) {
    const actorId = actor?.id || "actor";
    const attributeId = attribute?.id || foundry.utils.randomID(8);
    super({ id: `buxa-attribute-setter-${actorId}-${attributeId}-${foundry.utils.randomID(5).toLowerCase()}`, ...options });
    this.actor = actor;
    this.attribute = attribute;
    this._resolve = typeof resolve === "function" ? resolve : null;
  }

  get title() {
    return `Buxa · ${this.attribute?.label ?? "Attribute"}`;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return {
      ...context,
      actor: this.actor,
      attribute: this.attribute,
      accent: this.attribute?.appearance?.color || "#151a24"
    };
  }

  async close(options) {
    if (this._resolve) {
      this._resolve(null);
      this._resolve = null;
    }
    return super.close(options);
  }

  static async #onSubmit(_event, _form, formData) {
    const raw = formData?.object?.value;
    const next = Number(raw);
    if (raw === "" || raw === null || raw === undefined || !Number.isSafeInteger(next) || next <= 0) return;
    if (this._resolve) {
      this._resolve(next);
      this._resolve = null;
    }
  }

  static async prompt({ actor, attribute } = {}) {
    return new Promise((resolve) => {
      const app = new BuxaAttributeSetter({ actor, attribute, resolve });
      Promise.resolve(app.render({ force: true })).catch((error) => {
        console.error("buxaframework | Could not open the attribute editor.", error);
        app._resolve = null;
        resolve(null);
      });
    });
  }
}
