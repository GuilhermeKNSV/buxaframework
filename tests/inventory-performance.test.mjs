import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { beginItemIncreaseBatch, getActiveItemIncreaseEntries, getItemIncreaseAggregate } from "../scripts/core/item-effects.js";
import { prepareInventoryContext } from "../scripts/apps/inventory-context.js";
import { normalizeSheetConfig } from "../scripts/core/config.js";

const getProperty = (value, path) => String(path).split(".").reduce((v, key) => v?.[key], value);
globalThis.foundry = { utils: { deepClone: structuredClone, getProperty } };
const config = normalizeSheetConfig({ inventory: { slots: 80, weight: { enabled: true, capacity: 200 } } });

function makeActor(count = 12) {
  let reads = 0;
  const items = Array.from({ length: count }, (_, index) => {
    const raw = {
      rarityId: index % 2 ? "relic" : "rare",
      weight: { enabled: true, value: 2 },
      levelRequirement: { enabled: index === 0, level: 3 },
      increases: [
        { id: `inc-${index}`, target: "attribute:str:value", mode: "flat", value: 2, activation: "passive", visibility: "revealed" },
        { id: `secret-${index}`, target: "attribute:str:value", mode: "flat", value: 90, activation: "passive", visibility: "hidden" }
      ]
    };
    return {
      id: `item-${index}`, name: `Item ${index}`, type: "tool", img: "",
      system: { quantity: 2 },
      getFlag(_module, key) { if (key === "item") { reads += 1; return raw; } return undefined; }
    };
  });
  items.get = (id) => items.find((item) => item.id === id);
  const placements = Object.fromEntries(items.map((item, index) => [item.id, { area: "inventory", index }]));
  const inventory = { tracked: items.map((item) => item.id), placements, equipmentActive: {} };
  const actor = {
    isOwner: true, items,
    getFlag(_module, key) { if (key === "inventory") return inventory; if (key === "level") return 2; return undefined; }
  };
  items.forEach((item) => { item.parent = actor; });
  return { actor, items, reads: () => reads };
}

test("render-scoped increase cache computes item flags once, preserves mechanics", () => {
  const { actor, reads } = makeActor();
  const direct = getItemIncreaseAggregate(actor, "attribute:str:value", config);
  assert.deepEqual(direct, { flat: 24, percent: 0, count: 12 });
  const start = reads();
  const release = beginItemIncreaseBatch(actor, config);
  assert.equal(reads() - start, actor.items.length);
  for (let i = 0; i < 70; i += 1) {
    assert.deepEqual(getItemIncreaseAggregate(actor, "attribute:str:value", config), direct);
    assert.equal(getItemIncreaseAggregate(actor, "resource:hp:max", config).flat, 0);
    assert.equal(getActiveItemIncreaseEntries(actor, config).length, 12);
  }
  assert.equal(reads() - start, actor.items.length, "stat lookups must not parse items again during rendering");
  release();
  assert.deepEqual(getItemIncreaseAggregate(actor, "attribute:str:value", config), direct);
  assert.equal(reads() - start, actor.items.length * 2, "closing context discards the cache");
});

test("closing the batch reflects reveals and changed quantities on the next render", () => {
  const { actor, items } = makeActor(1);
  const release = beginItemIncreaseBatch(actor, config);
  assert.equal(getItemIncreaseAggregate(actor, "attribute:str:value", config).flat, 2);
  items[0].getFlag = (_m, key) => key === "item" ? { increases: [
    { id: "revealed", target: "attribute:str:value", mode: "flat", value: 8, activation: "passive", visibility: "revealed" }
  ] } : undefined;
  release();
  assert.equal(getItemIncreaseAggregate(actor, "attribute:str:value", config).flat, 8);
  items[0].system.quantity = 0;
  assert.equal(getItemIncreaseAggregate(actor, "attribute:str:value", config).flat, 0);
});

test("inventory computes each item's rarity, requirement and weight once per context", () => {
  const { actor, items, reads } = makeActor();
  const result = prepareInventoryContext(actor, config, true);
  assert.equal(reads(), items.length, "multiple slot/weight passes must reuse item views");
  assert.equal(result.weight.total, 48);
  assert.equal(result.used, items.length);
  assert.equal(result.inventorySlots[0].item.requirement.enabled, true);
  assert.equal(result.inventorySlots[0].item.requirement.met, false);
  assert.equal(result.inventorySlots[1].item.rarity.id, "relic");
  assert.equal(result.inventorySlots[0].item.rarity.id, "rare");
  assert.equal(result.inventorySlots[0].item.showQuantity, true);
  prepareInventoryContext(actor, config, true);
  assert.equal(reads(), items.length * 2, "a subsequent render must re-read changed items");
});

test("successful unstack is silent and drag uses a lightweight stable preview", () => {
  const menu = fs.readFileSync(new URL("../scripts/apps/item-context-menu.js", import.meta.url), "utf8");
  const controls = fs.readFileSync(new URL("../scripts/apps/inventory-controls.js", import.meta.url), "utf8");
  const styles = fs.readFileSync(new URL("../styles/117-inventory-drag-stability.css", import.meta.url), "utf8");
  assert.ok(!menu.includes("notifyInfo"));
  assert.ok(menu.includes("notifyWarning"), "failed splits should still be reported");
  assert.ok(controls.includes("view.requestAnimationFrame"));
  assert.ok(controls.includes("translate3d"));
  assert.ok(controls.includes("if (slot === previous) return previous"));
  assert.ok(styles.includes("animation: none !important"));
  assert.ok(styles.includes(".buxa-inventory-drag-ghost"));
  const ghost = fs.readFileSync(new URL("../scripts/apps/inventory-drag-motion.js", import.meta.url), "utf8");
  assert.match(ghost, /doc\.createElement\(['"]img['"]\)/);
  assert.ok(!ghost.includes('element.cloneNode(true)'), "rarity/slot styling must not enter the moving preview");
});

test('simple inventory skips complex shape artwork and cell maps entirely', () => {
  const {actor}=makeActor(6);
  const result=prepareInventoryContext(actor,config,true);
  assert.equal(result.complexMode,false);
  assert.deepEqual(result.complexItems,[]);
  assert.deepEqual(result.complexCells,[]);
});
