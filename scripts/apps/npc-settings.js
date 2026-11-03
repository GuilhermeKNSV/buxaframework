/** Lightweight NPC-only sheet mode selector, stored on the Actor document. */
import { getSheetConfig } from "../core/config.js";
import { npcDropCapacity, npcDropResource } from "../core/npc-dropping.js";
import { MODULE_ID } from "../core/constants.js";
import { getNpcSheetMode, isBuxaNpc, saveNpcSheetMode } from "../core/npc-sheet.js";
import { notifyError } from "../core/notifications.js";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class BuxaNpcSettings extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ["buxa", "buxa-npc-settings-app"], tag: "div",
    position: { width: 440, height: "auto" },
    window: { icon: "fa-solid fa-user-gear", resizable: false }
  };
  static PARTS = { main: { template: `modules/${MODULE_ID}/templates/npc-settings.hbs` } };
  constructor({ actor, ...options } = {}) {
    super({ id: `buxa-npc-settings-${actor?.id ?? "unknown"}`, ...options });
    this.actor = actor;
  }
  get title() { return `Buxa · NPC Settings · ${this.actor?.name ?? "NPC"}`; }
  async _prepareContext(options) {
    const base = await super._prepareContext(options);
    const mode = getNpcSheetMode(this.actor);
    return { ...base, mode, quick: mode === "quick", visual: mode === "visual",
      dropCapacity:npcDropCapacity(this.actor,getSheetConfig()),
      hpResource:npcDropResource(this.actor,getSheetConfig())?.id,
      dropResources:getSheetConfig().resources.map(r=>({id:r.id,label:r.label,selected:r.id===npcDropResource(this.actor,getSheetConfig())?.id})),
      editable: isBuxaNpc(this.actor) && Boolean(game.user?.isGM && this.actor?.isOwner) };
  }
  _onRender(context, options) {
    super._onRender(context, options);
    const capacityNumber=this.element.querySelector('[data-npc-drop-capacity]');
    const capacitySlider=this.element.querySelector('[data-npc-drop-capacity-slider]');
    capacitySlider?.addEventListener('input',()=>{if(capacityNumber)capacityNumber.value=capacitySlider.value;});
    capacityNumber?.addEventListener('input',()=>{if(capacitySlider&&capacityNumber.validity.valid)capacitySlider.value=capacityNumber.value;});
    const saveCapacity=async (event)=>{ 
      if(!game.user?.isGM || !this.actor?.isOwner)return;
      const n=Number(event.target.value);
      const previous=npcDropCapacity(this.actor,getSheetConfig());
      if(!Number.isSafeInteger(n)||n<1||n>200){
        capacityNumber.value=String(previous);capacitySlider.value=String(previous);return;
      }
      if((this.actor.getFlag?.(MODULE_ID,'npc.dropTable')?.length||0)>n){
        notifyError('Remove Drop items before shrinking this NPC inventory.');
        capacityNumber.value=String(previous);capacitySlider.value=String(previous);return;
      }
      try { await this.actor.update({[`flags.${MODULE_ID}.npc.dropCapacity`]:n}); await this.actor.sheet?.render?.({force:true}); }
      catch(error){console.error(error);notifyError('Unable to save NPC Drop capacity.');capacityNumber.value=String(previous);capacitySlider.value=String(previous);}
    };
    capacityNumber?.addEventListener('change',saveCapacity);
    capacitySlider?.addEventListener('change',event=>{if(capacityNumber){capacityNumber.value=event.target.value;void saveCapacity({target:capacityNumber});}});
    this.element.querySelector('[data-npc-hp-resource]')?.addEventListener('change',async event=>{
      if(!game.user?.isGM || !this.actor?.isOwner)return;
      const id=event.target.value;
      if(!getSheetConfig().resources.some(r=>r.id===id))return;
      try { await this.actor.update({[`flags.${MODULE_ID}.npc.dropResource`]:id}); }
      catch(error){console.error(error);notifyError('Unable to save NPC HP resource.');}
    });
    this.element.querySelectorAll("[data-npc-mode]").forEach(button => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        if (!game.user?.isGM || !this.actor?.isOwner || button.disabled) return;
        const mode = button.dataset.npcMode;
        this.element.querySelectorAll("[data-npc-mode]").forEach(entry => { entry.disabled = true; });
        try {
          if (await saveNpcSheetMode(this.actor, mode)) {
            await this.actor.sheet?.render?.({ force: true });
            await this.render({ force: true });
          }
        } catch (error) {
          console.error(`${MODULE_ID} | NPC settings update failed.`, error);
          notifyError("Unable to save NPC Settings.");
        } finally {
          this.element?.querySelectorAll("[data-npc-mode]").forEach(entry => { entry.disabled = false; });
        }
      });
    });
  }
}
