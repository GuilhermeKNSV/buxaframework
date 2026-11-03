/* Buxa Framework lightweight regression tests; no Foundry installation needed.
 * Run: node --experimental-default-type=module --test tests/*.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";

const pathParts = (path) => String(path).split(".");
const getProperty = (object, path) => pathParts(path).reduce((value, key) => value?.[key], object);
const setProperty = (object, path, value) => {
  const segments = pathParts(path);
  let current = object;
  for (const segment of segments.slice(0, -1)) current = current[segment] ??= {};
  current[segments.at(-1)] = structuredClone(value);
  return object;
};

globalThis.foundry = {
  utils: {
    deepClone: structuredClone,
    equals: isDeepStrictEqual,
    getProperty,
    setProperty,
    hasProperty: (object, path) => getProperty(object, path) !== undefined,
    randomID: () => "random-test-id",
    escapeHTML: (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  },
  dice: {},
  documents: {}
};
globalThis.game = { system: { id: "dnd5e" }, i18n: { lang: "en" }, user: { id: "player", isGM: true, isActiveGM: true } };
globalThis.Hooks = { callAll() {} };
globalThis.CONST = { CHAT_MESSAGE_STYLES: { ROLL: 5 } };

const { DEFAULT_SHEET_CONFIG, MODULE_ID } = await import("../scripts/core/constants.js");
const { getItemIncreaseAggregate, getActiveItemIncreaseEntries } = await import("../scripts/core/item-effects.js");
const { canStackItems } = await import("../scripts/core/item-runtime.js");
const { getInventoryState, reconcileInventoryState } = await import("../scripts/core/inventory.js");
const { normalizeItemDice } = await import("../scripts/core/item-dice-config.js");
const { resolveItemDice, rollItemDice } = await import("../scripts/core/item-dice.js");

function item(id, { rules = {}, quantity = 1, uuid = `Actor.actor.Item.${id}`, name = id } = {}) {
  return {
    id, uuid, name, type: "loot", img: "icons/svg/item-bag.svg", system: { quantity },
    getFlag: (scope, key) => scope === MODULE_ID && key === "item" ? rules : undefined
  };
}
function actor(items = [], flags = {}) {
  items.get = (id) => items.find((item) => item.id === id);
  const result = {
    id: "actor", name: "Tester", documentName: "Actor", isOwner: true,
    items, _flags: structuredClone(flags), writes: [],
    getFlag(scope, key) { return scope === MODULE_ID ? getProperty(this._flags, key) : undefined; },
    async update(update) {
      this.writes.push(structuredClone(update));
      for (const [path, value] of Object.entries(update)) {
        setProperty(this, path, value);
        if (path.startsWith(`flags.${MODULE_ID}.`)) setProperty(this._flags, path.slice(`flags.${MODULE_ID}.`.length), value);
      }
      return this;
    }
  };
  for (const entry of items) entry.parent = result;
  return result;
}
function config() { return structuredClone(DEFAULT_SHEET_CONFIG); }
function increase(activation, target = "stat:damageReduction:value", value = 5) {
  return { id: `${activation}-${target}`, target, activation, value, mode: "flat" };
}

test("passive increases apply to actor-owned items absent from the Buxa grid", () => {
  const bag = item("bag", { rules: { increases: [increase("passive")] } });
  const owner = actor([bag]);
  assert.equal(getItemIncreaseAggregate(owner, "stat:damageReduction:value", config()).flat, 5);
  assert.equal(getActiveItemIncreaseEntries(owner, config()).length, 1);
});

test("zero-quantity items do not grant passive increases", () => {
  const owner = actor([item("empty", { quantity: 0, rules: { increases: [increase("passive")] } })]);
  assert.equal(getItemIncreaseAggregate(owner, "stat:damageReduction:value", config()).count, 0);
});

test("equipped-only increases require the selected equipment position", () => {
  const sword = item("sword", { rules: { increases: [increase("equipped")] } });
  const owner = actor([sword], { inventory: { tracked: ["sword"], placements: { sword: { area: "equipment", slotId: "weapon", position: 1 } }, equipmentActive: { weapon: 0 } } });
  assert.equal(getItemIncreaseAggregate(owner, "stat:damageReduction:value", config()).count, 0);
  owner._flags.inventory.equipmentActive.weapon = 1;
  assert.equal(getItemIncreaseAggregate(owner, "stat:damageReduction:value", config()).flat, 5);
});

test("stacking World Items and embedded Items with the same id is allowed when compatible", () => {
  const rules = { multiple: { enabled: true, stackKey: "same-template" } };
  const source = item("same", { rules, uuid: "Item.same" });
  const embedded = item("same", { rules, uuid: "Actor.actor.Item.same" });
  assert.equal(canStackItems(source, embedded, config()), true);
  assert.equal(canStackItems(embedded, embedded, config()), false);
});

test("reconciling a healthy inventory does not create actor updates", async () => {
  const owner = actor([item("apple")]);
  owner._flags.inventory = getInventoryState(owner, config());
  await reconcileInventoryState(owner, config());
  assert.equal(owner.writes.length, 0);
});

test("resource maximum is clamped even without a custom inventory flag", async () => {
  const cfg = config();
  cfg.resources = [{ id: "energy", label: "Energy", startMax: 20, link: "buxa" }];
  const owner = actor([item("drain", { rules: { increases: [increase("passive", "resource:energy:max", -15)] } })], {
    resources: { energy: { value: 20, max: 20 } }
  });
  await reconcileInventoryState(owner, cfg);
  assert.equal(owner._flags.resources.energy.value, 5);
});

test("2d20 + flat uses Buxa's configured ARPG range, while retaining real dice formula", () => {
  const entry = normalizeItemDice([{ label: "Damage", count: 2, faces: 20, flat: 7, showRange: true }])[0];
  const weapon = item("weapon", { rules: { dice: [entry] } });
  const owner = actor([weapon]);
  const resolved = resolveItemDice(weapon, entry, { actor: owner, config: config() });
  assert.equal(resolved.formula, "2d20 + 7");
  assert.equal(resolved.displayText, "7 - 47");
});

test("item chat rolls serialize the v14 roll as a JSON object", async () => {
  const messages = [];
  class FakeRoll {
    constructor(formula) { this.formula = formula; this.total = 12; }
    async evaluate() { return this; }
    toJSON() { return { formula: this.formula, total: this.total }; }
  }
  foundry.dice.Roll = FakeRoll;
  foundry.documents.ChatMessage = {
    getSpeaker: () => ({ alias: "Tester" }),
    applyMode: (data) => data,
    create: async (data) => { messages.push(data); return data; }
  };
  const weapon = item("weapon", { rules: { dice: normalizeItemDice([{ id: "attack", flat: 2 }]) } });
  const owner = actor([weapon]);
  assert.equal(await rollItemDice(weapon, "attack", { actor: owner, config: config() }), true);
  assert.equal(messages.length, 1);
  assert.equal(typeof messages[0].rolls[0], "object");
  assert.equal(messages[0].rolls[0].formula, "1d20 + 2");
});

test("new increase and dice entries default to neutral without losing custom color settings", async () => {
  const { createItemIncrease, normalizeItemIncreases } = await import("../scripts/core/item-increase-config.js");
  const { createItemDice } = await import("../scripts/core/item-dice-config.js");
  assert.equal(createItemIncrease().tooltip.style, "neutral");
  assert.equal(createItemDice().tooltip.style, "neutral");
  assert.equal(normalizeItemIncreases([{ tooltip: {} }])[0].tooltip.style, "neutral");
  assert.equal(normalizeItemDice([{ tooltip: { style: "custom", color: "#ff0000" } }])[0].tooltip.color, "#ff0000");
});

test("item-sheet dice and increases are neutral but do not mutate colored hover lines", async () => {
  const { neutralItemSheetLines } = await import("../scripts/core/item-presentation.js");
  const custom = [{ id: "fire", style: "--buxa-tooltip-color:#ff4500", color: "#ff4500", icon: "fire.svg" }];
  const neutral = neutralItemSheetLines(custom);
  assert.equal(neutral[0].style, "--buxa-tooltip-color:#c8d0dc");
  assert.equal(neutral[0].color, "#c8d0dc");
  assert.equal(neutral[0].icon, "fire.svg");
  assert.equal(custom[0].color, "#ff4500");
});
