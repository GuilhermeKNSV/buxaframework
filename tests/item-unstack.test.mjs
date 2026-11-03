import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { isDeepStrictEqual } from "node:util";

const getProperty = (value, path) => String(path).split(".").reduce((o, p) => o?.[p], value);
const setProperty = (value, path, replacement) => {
  let target = value;
  const parts = String(path).split(".");
  for (const key of parts.slice(0, -1)) target = target[key] ??= {};
  target[parts.at(-1)] = structuredClone(replacement);
};
let nextID = 0;
globalThis.foundry = { utils: {
  deepClone: structuredClone,
  equals: isDeepStrictEqual,
  getProperty, setProperty,
  hasProperty: (object, path) => getProperty(object, path) !== undefined,
  randomID: () => `new-instance-${++nextID}`,
  escapeHTML: text => String(text)
}};
globalThis.Hooks = { callAll() {} };
globalThis.game = { system: { id: "dnd5e" }, user: { isGM: true, id: "gm" }, i18n: { lang: "en" } };

const { DEFAULT_SHEET_CONFIG } = await import("../scripts/core/constants.js");
const { getStackSplitAvailability, splitItemStack } = await import("../scripts/core/item-stacks.js");
const { getInventoryState } = await import("../scripts/core/inventory.js");
const { canStackItems } = await import("../scripts/core/item-runtime.js");
const cfg = () => structuredClone(DEFAULT_SHEET_CONFIG);

function fakeActor(quantity = 4, { stackable = true, equipped = false, inventorySlots = null, failCreate = false, failUpdate = false, failTrack = false } = {}) {
  const stackRules = { multiple: { enabled: stackable, stackKey: "item-stack-template" }, increases: [], dice: [], description: { text: "old lore" } };
  const source = {
    id: "old", uuid: "Actor.actor.Item.old", name: "Ancient Compass", type: "loot", img: "icons/svg/compass.svg",
    system: { quantity, equipped }, flags: { buxaframework: { item: stackRules, itemInstance: { version: 1, instanceId: "identity-original", originUuid: "Item.template" } } },
    getFlag(ns, key) { return getProperty(this.flags, `${ns}.${key}`); },
    toObject() { return structuredClone({ _id: this.id, name: this.name, type: this.type, img: this.img, system: this.system, flags: this.flags }); },
    async update(update) {
      if (failUpdate) throw new Error("Simulated item update failure");
      for (const [key, value] of Object.entries(update)) setProperty(this, key, value);
      return this;
    }
  };
  const items = [source];
  items.get = id => items.find(x => x.id === id);
  const actor = {
    id: "actor", documentName: "Actor", isOwner: true, items,
    flags: { buxaframework: { inventory: { version:4, autoSort:false, tracked:["old"], placements:{ old: { area: "inventory", index: 0 } }, equipmentActive:{} } } },
    getFlag(ns, key) { return getProperty(this.flags, `${ns}.${key}`); },
    async update(update) {
      if (failTrack && Object.keys(update).some(key => key.startsWith("flags.buxaframework.inventory"))) throw new Error("Simulated inventory placement failure");
      for (const [key, value] of Object.entries(update)) setProperty(this, key, value);
    },
    async createEmbeddedDocuments(type, data, options = {}) {
      assert.equal(type, "Item");
      assert.equal(options["buxaframework.splitting"], true);
      if (failCreate) throw new Error("Simulated item creation failure");
      return data.map((payload) => {
        const entry = {
          ...structuredClone(payload), id: `new-${++nextID}`, parent: actor,
          getFlag(ns,key) { return getProperty(this.flags, `${ns}.${key}`); },
          toObject() { return structuredClone({ _id: this.id, name: this.name, type: this.type, img: this.img, system:this.system, flags:this.flags }); },
          async update(update) { for (const [path, value] of Object.entries(update)) setProperty(this, path, value); }
        };
        items.push(entry);
        return entry;
      });
    },
    async deleteEmbeddedDocuments(type, ids) {
      assert.equal(type, "Item");
      for (const id of ids) { const index = items.findIndex(item => item.id === id); if (index >= 0) items.splice(index, 1); }
    }
  };
  source.parent = actor;
  const config = cfg();
  if (inventorySlots !== null) config.inventory.slots = inventorySlots;
  return { actor, source, config };
}

test("a stack of 4 splits 2 + 2 with unique item IDs, preserved rules and inventory placement", async () => {
  const {actor, source, config} = fakeActor(4);
  const before = getStackSplitAvailability(actor, source, config);
  assert.deepEqual({ allowed: before.allowed, max: before.max, freeIndex: before.freeIndex }, { allowed: true, max: 3, freeIndex: 1 });
  const { item: split, amount, remaining } = await splitItemStack(actor, source, 2, config);
  assert.equal(amount, 2);
  assert.equal(remaining, 2);
  assert.equal(source.system.quantity, 2);
  assert.equal(split.system.quantity, 2);
  assert.equal(split.system.equipped, false);
  assert.notEqual(split.id, source.id);
  assert.notEqual(split.flags.buxaframework.itemInstance.instanceId, source.flags.buxaframework.itemInstance.instanceId);
  assert.equal(split.flags.buxaframework.itemInstance.originUuid, "Item.template");
  assert.deepEqual(split.flags.buxaframework.item, source.flags.buxaframework.item);
  assert.ok(canStackItems(source, split, config));
  const placements = getInventoryState(actor, config).placements;
  assert.equal(placements.old.index, 0);
  assert.equal(placements[split.id].index, 1);
});

test("the chosen amount may be 1 or all but one, never zero, fractional, or whole stack", async () => {
  for (const amount of [0, -1, 1.1, 4, "", "cat", Number.POSITIVE_INFINITY]) {
    const {actor, source, config} = fakeActor(4);
    await assert.rejects(() => splitItemStack(actor, source, amount, config), /Choose a whole number/);
    assert.equal(actor.items.length, 1);
    assert.equal(source.system.quantity, 4);
  }
  for (const amount of [1,3]) {
    const {actor, source, config} = fakeActor(4);
    const {item} = await splitItemStack(actor, source, amount, config);
    assert.equal(item.system.quantity, amount);
    assert.equal(source.system.quantity, 4 - amount);
  }
});

test("non-stackable, singleton, foreign, and full-grid stacks cannot be split", async () => {
  const invalid = [fakeActor(4, {stackable: false}), fakeActor(1), fakeActor(4, {inventorySlots: 1})];
  for (const {actor, source, config} of invalid) {
    assert.equal(getStackSplitAvailability(actor, source, config).allowed, false);
    await assert.rejects(() => splitItemStack(actor, source, 1, config));
    assert.equal(actor.items.length, 1);
  }
  const {actor, source, config} = fakeActor();
  actor.isOwner = false;
  assert.equal(getStackSplitAvailability(actor, source, config).allowed, false);
});

test("splitting an equipped item produces an unequipped inventory copy", async () => {
  const {actor, source, config} = fakeActor(3, { equipped: true });
  const {item} = await splitItemStack(actor, source, 1, config);
  assert.equal(source.system.equipped, true);
  assert.equal(item.system.equipped, false);
  assert.equal(getInventoryState(actor, config).placements[item.id].area, "inventory");
});

test("failed creation does not reduce source quantity", async () => {
  const {actor, source, config} = fakeActor(4, {failCreate: true});
  await assert.rejects(() => splitItemStack(actor, source, 2, config), /Simulated item creation failure/);
  assert.equal(source.system.quantity, 4);
  assert.equal(actor.items.length, 1);
});

test("failed source reduction rolls back the newly created stack", async () => {
  const {actor, source, config} = fakeActor(4, {failUpdate: true});
  await assert.rejects(() => splitItemStack(actor, source, 2, config), /Simulated item update failure/);
  assert.equal(source.system.quantity, 4);
  assert.equal(actor.items.length, 1);
});

test("failed inventory placement restores quantity and deletes the new stack", async () => {
  const {actor, source, config} = fakeActor(4, {failTrack: true});
  await assert.rejects(() => splitItemStack(actor, source, 2, config), /Simulated inventory placement failure/);
  assert.equal(source.system.quantity, 4);
  assert.equal(actor.items.length, 1);
});

test("right-click action menu excludes redundant image, title and rarity", () => {
  const menu = fs.readFileSync(new URL("../scripts/apps/item-context-menu.js", import.meta.url), "utf8");
  const inventory = fs.readFileSync(new URL("../scripts/apps/inventory-controls.js", import.meta.url), "utf8");
  const dialog = fs.readFileSync(new URL("../scripts/apps/unstack-dialog.js", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../styles/115-unstack-menu.css", import.meta.url), "utf8");
  assert.ok(!menu.includes("getItemVisual"));
  assert.ok(!menu.includes('doc.createElement("header")'));
  assert.ok(menu.includes('button.dataset.action = "unstack"'));
  assert.ok(menu.includes("promptUnstackAmount"));
  assert.ok(inventory.includes('event.button !== 2'));
  assert.ok(inventory.includes('addEventListener("contextmenu"'));
  assert.ok(!dialog.includes('dialog.showModal()'));
  assert.ok(!dialog.includes('<dialog'));
  assert.ok(!dialog.includes('data-unstack-range'));
  assert.ok(!dialog.includes('data-unstack-name'));
  assert.ok(dialog.includes('buxa-unstack-popover'));
  assert.ok(menu.includes('ownerDocument: doc, anchor'));
  assert.ok(dialog.includes('data-unstack-submit'));
  assert.ok(css.includes('buxa-item-action-popover'));
  assert.ok(css.includes('buxa-unstack-popover'));
  assert.ok(!css.includes('::backdrop'));
});


test('complex unstack needs a second full footprint and never occupies source cells', async () => {
  const {actor, source, config} = fakeActor(4);
  config.inventory.mode = 'complex';
  config.inventory.complex = { columns:2, rows:1, autoSort:false };
  source.flags.buxaframework.item.shape = {cells:[{x:0,y:0},{x:1,y:0}]};
  assert.equal(getStackSplitAvailability(actor,source,config).allowed,false,
    'an original 2×1 source fills the grid; its own shape may not be ignored');
  config.inventory.complex.columns = 4;
  const available = getStackSplitAvailability(actor,source,config);
  assert.equal(available.allowed,true);
  assert.equal(available.freeIndex,2);
  const split = await splitItemStack(actor,source,2,config);
  const placements = getInventoryState(actor,config).placements;
  assert.equal(placements.old.index,0);
  assert.equal(placements[split.item.id].index,2);
});

test('split cleans up an Item created before a Foundry post-create hook throws', async()=>{
  const {actor,source,config}=fakeActor(4);
  const nativeCreate=actor.createEmbeddedDocuments.bind(actor);
  actor.createEmbeddedDocuments=async(...args)=>{
    await nativeCreate(...args);
    throw Error('split post-create hook threw');
  };
  await assert.rejects(splitItemStack(actor,source,2,config),/post-create hook threw/);
  assert.equal(actor.items.length,1,'no orphaned stack must survive the failed split');
  assert.equal(source.system.quantity,4,'source quantity must remain unchanged');
});

test('split restores source quantity after a post-update hook rejects an already saved update', async()=>{
  const {actor,source,config}=fakeActor(4);
  const normalUpdate=source.update.bind(source);
  let updates=0;
  source.update=async(...args)=>{
    await normalUpdate(...args);
    if(++updates===1)throw Error('split post-update hook threw');
  };
  await assert.rejects(splitItemStack(actor,source,2,config),/post-update hook threw/);
  assert.equal(source.system.quantity,4,'the units must not be lost');
  assert.equal(actor.items.length,1,'the new copy must be removed');
});
