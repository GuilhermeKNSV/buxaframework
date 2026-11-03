/** NPC-specific sheet shell; reuses all Player inventory, item and equipment controls. */
import { BuxaPlayerSheet } from "./player-sheet.js";
import { getNpcSheetMode } from "../core/npc-sheet.js";
import { bindNpcDropEditor } from "./npc-drop-editor.js";
import { bindNpcCheatControls } from "./npc-cheat-editor.js";

export class BuxaNpcSheet extends BuxaPlayerSheet {
  static DEFAULT_OPTIONS = {
    ...BuxaPlayerSheet.DEFAULT_OPTIONS,
    classes: [...BuxaPlayerSheet.DEFAULT_OPTIONS.classes, "buxa-npc-sheet"],
    window: { ...BuxaPlayerSheet.DEFAULT_OPTIONS.window, icon: "fa-solid fa-dragon" }
  };
  get title() { return this.actor?.name || "NPC"; }
  async _prepareContext(options) {
    if (getNpcSheetMode(this.actor) === "quick" && this._activeTab === "stats") this._activeTab = "basic";
    return super._prepareContext(options);
  }
  async _onRender(context, options) {
    await super._onRender(context, options);
    bindNpcCheatControls(this);
    bindNpcDropEditor(this);
  }
}
