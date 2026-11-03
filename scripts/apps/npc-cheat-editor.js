/** GM right-click editor. Direct level changes reconcile configured point rewards. */
import { MODULE_ID } from "../core/constants.js";
import { getSheetConfig } from "../core/config.js";
import { getNpcAttributeOverride, saveNpcAttributeOverrides, setNpcProgressionNumber } from "../core/npc-sheet.js";
import { getActorLevel } from "../core/leveling.js";
import { getAttributePoints, getAttributeValue, getAttributeDice, getAttributeModifier, getAttributeRebirths } from "../core/attributes.js";
import { getProficiencyPoints } from "../core/proficiencies.js";
import { notifyError } from "../core/notifications.js";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class BuxaNpcCheatEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ["buxa", "buxa-npc-cheat-app"], tag: "form",
    position: { width: 370, height: "auto" },
    window: { icon: "fa-solid fa-pen-to-square", resizable: false },
    form: { handler: BuxaNpcCheatEditor.onSubmit, submitOnChange: false, closeOnSubmit: false }
  };
  static PARTS = { main: { template: `modules/${MODULE_ID}/templates/npc-cheat-editor.hbs` } };
  constructor({ actor, field, attributeId, ...options } = {}) {
    super({ id: `buxa-npc-cheat-${actor?.id ?? "unknown"}-${field}-${attributeId || ""}`, ...options });
    this.actor = actor;
    this.field = field;
    this.attributeId = attributeId;
  }
  get title() { return `NPC Quick Edit · ${this.actor?.name ?? "NPC"}`; }
  async _prepareContext(options) {
    const base = await super._prepareContext(options);
    const cfg = getSheetConfig();
    const attribute = cfg.attributes.entries.find(entry => entry.id === this.attributeId);
    if (this.field === "attribute" && attribute) {
      const value = getAttributeValue(this.actor, attribute, cfg);
      const rebirths = getAttributeRebirths(this.actor, attribute.id, cfg);
      const modifier = getAttributeModifier(attribute, value, rebirths, this.actor, cfg);
      const dice = getAttributeDice(attribute, rebirths, this.actor, cfg);
      return { ...base, attributeMode: true, heading: attribute.label,
        editable: Boolean(game.user?.isGM && this.actor?.isOwner),
        entries: [
          { key: "value", label: "Value", current: value, saved: getNpcAttributeOverride(this.actor, attribute.id, "value"), hint: "0 or more" },
          { key: "modifier", label: "Modifier", current: modifier ?? 0, saved: getNpcAttributeOverride(this.actor, attribute.id, "modifier"), hint: "May be negative" },
          { key: "dice", label: "Dice", current: dice, saved: getNpcAttributeOverride(this.actor, attribute.id, "dice"), hint: "1–100" }
        ].map(entry => ({ ...entry, hasSaved: entry.saved !== null })) };
    }
    const names = { level: "Level", attributePoints: "Attribute Points", proficiencyPoints: "Proficiency Points" };
    const values = { level: getActorLevel(this.actor, cfg), attributePoints: getAttributePoints(this.actor, cfg),
      proficiencyPoints: getProficiencyPoints(this.actor, cfg) };
    return { ...base, attributeMode: false, heading: names[this.field] || "Value", current: values[this.field] ?? 0,
      editable: Boolean(game.user?.isGM && this.actor?.isOwner) };
  }
  static async onSubmit(_event, _form, data) {
    if (!game.user?.isGM || !this.actor?.isOwner) return;
    const values = data?.object ?? {};
    try {
      const ok = this.field === "attribute"
        ? await saveNpcAttributeOverrides(this.actor, this.attributeId, values)
        : await setNpcProgressionNumber(this.actor, this.field, values.value);
      if (!ok) { notifyError("Invalid NPC value. Use whole numbers within the allowed range."); return; }
      await this.actor.sheet?.render?.({ force: true });
      await this.close();
    } catch (error) {
      console.error(`${MODULE_ID} | NPC direct edit failed.`, error);
      notifyError("Unable to save the NPC value.");
    }
  }
}

export function bindNpcCheatControls(sheet) {
  if (sheet.actor?.type !== "npc" || !game.user?.isGM || !sheet.actor.isOwner) return;
  sheet.element?.addEventListener("contextmenu", (event) => {
    const target = event.target;
    const attribute = target?.closest?.("[data-attribute-card]");
    const level = target?.closest?.("[data-buxa-level]");
    const points = target?.closest?.("[data-buxa-points]");
    const profPoints = target?.closest?.("[data-buxa-proficiency-points]");
    let field, attributeId;
    if (attribute) { field = "attribute"; attributeId = attribute.dataset.attributeCard; }
    else if (level) field = "level";
    else if (points) field = "attributePoints";
    else if (profPoints) field = "proficiencyPoints";
    else return;
    event.preventDefault();
    event.stopImmediatePropagation?.();
    event.stopPropagation();
    new BuxaNpcCheatEditor({ actor: sheet.actor, field, attributeId }).render({ force: true });
  }, { capture: true });
}
