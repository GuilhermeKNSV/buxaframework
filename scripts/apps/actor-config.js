import { TEMPLATE_PATHS } from "../core/constants.js";
import { getLinkedUserIds, setLinkedUsers } from "../core/permissions.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class BuxaActorConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "buxa-actor-config",
    classes: ["buxa", "buxa-actor-config-app"],
    tag: "form",
    position: { width: 430, height: "auto" },
    window: {
      icon: "fa-solid fa-user-gear",
      resizable: false
    },
    form: {
      handler: BuxaActorConfig.#onSubmit,
      closeOnSubmit: true,
      submitOnChange: false
    }
  };

  static PARTS = {
    form: { template: TEMPLATE_PATHS.ACTOR_CONFIG }
  };

  constructor({ actor, ...options } = {}) {
    const actorId = actor?.id || foundry.utils.randomID(8);
    super({ id: `buxa-actor-config-${actorId}-${foundry.utils.randomID(5).toLowerCase()}`, ...options });
    this.actor = actor;
  }

  get title() {
    return `Buxa · Link Player · ${this.actor?.name ?? "Actor"}`;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const selected = new Set(getLinkedUserIds(this.actor));
    const users = [...(game.users ?? [])]
      .map((user) => ({
        id: user.id,
        name: user.name,
        active: user.active,
        isGM: user.isGM,
        checked: selected.has(user.id)
      }));

    return {
      ...context,
      actor: this.actor,
      users,
      noUsers: users.length === 0
    };
  }

  static async #onSubmit(_event, _form, _formData) {
    if (!game.user.isGM || !this.actor) return;
    const ids = [...this.element.querySelectorAll("[data-link-user]:checked")].map((input) => input.value);
    await setLinkedUsers(this.actor, ids);
  }
}
