/** Register independent player and NPC sheets for Foundry V14. */
import { MODULE_ID } from "../core/constants.js";
import { BuxaPlayerSheet } from "./player-sheet.js";
import { BuxaNpcSheet } from "./npc-sheet.js";

export function registerBuxaActorSheets(config, {
  models = globalThis.CONFIG?.Actor?.dataModels ?? {},
  register = foundry.applications.apps.DocumentSheetConfig.registerSheet
} = {}) {
  const available = Object.keys(models);
  const selected = (config?.actorTypes ?? []).filter(type => available.includes(type));
  const fallback = available.includes("character") ? ["character"]
    : (available.length === 1 ? available : []);
  const targets = selected.length ? selected : fallback;
  const playerTypes = [...new Set([...targets.filter(type => type !== "npc"), ...(available.includes("character") ? ["character"] : [])])];
  // Do not register a catch-all player sheet when NPC is the only actor type.
  // Foundry V14 registerSheet uses private static state (#pending). It must
  // be called with the DocumentSheetConfig class as its receiver; extracting
  // the function and calling it bare crashes init and every Actor sheet.
  const sheetConfig = globalThis.foundry?.applications?.apps?.DocumentSheetConfig;
  const registerBound = (...args) => register.call(sheetConfig, ...args);
  if (playerTypes.length) {
    registerBound(Actor, MODULE_ID, BuxaPlayerSheet, {
      label: "Buxa Player Sheet", makeDefault: config?.makeDefault ?? false, types: playerTypes
    });
  } else if (!targets.length) {
    registerBound(Actor, MODULE_ID, BuxaPlayerSheet, {
      label: "Buxa Player Sheet", makeDefault: config?.makeDefault ?? false
    });
  }
  if (available.includes("npc")) {
    registerBound(Actor, MODULE_ID, BuxaNpcSheet, {
      label: "Buxa NPC Sheet", makeDefault: true, types: ["npc"]
    });
  }
}
