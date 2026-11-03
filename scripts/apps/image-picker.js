import { TEMPLATE_PATHS } from "../core/constants.js";
import { getTokenImage, setFullbodyImage, setTokenImage } from "../core/sync.js";
import { BuxaAssetBrowser } from "./asset-browser.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class BuxaImagePicker extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "buxa-image-picker",
    classes: ["buxa", "buxa-image-picker-app"],
    tag: "form",
    position: { width: 460 },
    window: {
      icon: "fa-solid fa-images",
      resizable: false
    },
    form: {
      handler: BuxaImagePicker.#onSubmit,
      closeOnSubmit: true,
      submitOnChange: false
    },
    actions: {
      browseImage: BuxaImagePicker.#browseImage
    }
  };

  static PARTS = {
    form: {
      template: TEMPLATE_PATHS.IMAGE_PICKER
    }
  };

  constructor({ actor, ...options } = {}) {
    const actorId = actor?.id || foundry.utils.randomID(8);
    super({ id: `buxa-image-picker-${actorId}-${foundry.utils.randomID(5).toLowerCase()}`, ...options });
    this.actor = actor;
  }

  get title() {
    return `Buxa · Imagens · ${this.actor?.name ?? "Actor"}`;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return {
      ...context,
      editable: this.actor?.isOwner ?? false,
      fullbody: this.actor?.img || "icons/svg/mystery-man.svg",
      token: getTokenImage(this.actor)
    };
  }

  static async #browseImage(_event, target) {
    if (!this.actor?.isOwner) return;
    const fieldName = target.dataset.target;
    const input = this.element.querySelector(`[name="${CSS.escape(fieldName)}"]`);
    if (!input) return;

    const picker = new BuxaAssetBrowser({
      type: "image",
      current: input.value,
      title: `Buxa · ${fieldName === "token" ? "Token" : "Fullbody"} Image`,
      onSelect: async (path) => {
        if (!path) return;
        input.value = path;
        const EventClass = input.ownerDocument?.defaultView?.Event ?? Event;
        input.dispatchEvent(new EventClass("input", { bubbles: true }));
        const preview = this.element.querySelector(`[data-preview-for="${CSS.escape(fieldName)}"]`);
        if (preview) preview.src = path;
      }
    });
    await picker.render({ force: true });
  }

  static async #onSubmit(_event, _form, formData) {
    if (!this.actor?.isOwner) return;
    const data = formData.object;
    const fullbody = String(data.fullbody ?? "").trim();
    const token = String(data.token ?? "").trim();

    if (fullbody && fullbody !== this.actor.img) await setFullbodyImage(this.actor, fullbody);
    if (token && token !== getTokenImage(this.actor)) await setTokenImage(this.actor, token);

  }
}
