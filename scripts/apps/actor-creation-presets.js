/** Creation-dialog presets. These labels are UI choices, NOT new D&D Actor
 * document types. NPC modes are saved on the Actor when it is created.
 */
import { MODULE_ID } from "../core/constants.js";

export function actorCreationChoices(availableTypes = []) {
  const types = [...new Set((Array.isArray(availableTypes) ? availableTypes : []).filter(type => typeof type === "string" && type))];
  const choices = [];
  if (types.includes("character")) choices.push({ id: "player", label: "Player", type: "character" });
  if (types.includes("npc")) choices.push(
    { id: "npc-visual", label: "NPC Visual", type: "npc", mode: "visual" },
    { id: "npc-quick", label: "NPC Quick", type: "npc", mode: "quick" }
  );
  // Preserve access to extra system Actor types without conflating them with
  // the three requested player/NPC choices.
  for (const type of types) {
    if (type === "character" || type === "npc") continue;
    choices.push({ id: `system:${type}`, label: type.replaceAll("_", " "), type, other: true });
  }
  return choices;
}

export function newActorPreset(selected, availableTypes = []) {
  const choice = actorCreationChoices(availableTypes).find(entry => entry.id === selected);
  if (!choice) throw new Error("Invalid actor type.");
  const flags = {};
  if (choice.mode) {
    flags[MODULE_ID] = { npc: { sheetMode: choice.mode } };
    flags.core = { sheetClass: `${MODULE_ID}.BuxaNpcSheet` };
  } else if (choice.id === "player") {
    flags.core = { sheetClass: `${MODULE_ID}.BuxaPlayerSheet` };
  }
  return { type: choice.type, ...(Object.keys(flags).length ? { flags } : {}) };
}
