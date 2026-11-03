import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { itemDisplayLabel } from "../scripts/core/item-type-label.js";
import { buildItemPresentation } from "../scripts/core/item-presentation.js";
import { normalizeItemRules, normalizeItemSystemConfig } from "../scripts/core/item-config.js";
import { itemCardData, renderItemCard } from "../scripts/apps/item-directory-cards.js";
import { directoryListHTML } from "../scripts/apps/item-directory-tree.js";

const rarities = [{ id: "common", label: "COMMON", color: "#9098a6" }];
const conf = { items: normalizeItemSystemConfig(), attributes: { entries: [] }, proficiencies: { entries: [] }, resources: [] };
const item = (labelFlags, type = "tool") => ({
  id: "id-1", name: "Flask", type, img: "icons/svg/item-bag.svg", folder: null,
  flags: { buxaframework: { item: { rarityId: "common", ...labelFlags } } },
  getFlag: (namespace, key) => namespace === "buxaframework" && key === "item" ? { rarityId: "common", ...labelFlags } : undefined,
  system: { quantity: 1 }
});
globalThis.foundry ??= { utils: { getProperty: (object, path) => path.split(".").reduce((value, key) => value?.[key], object) } };

test("visible item label never defaults to D&D 5e system item types", () => {
  for (const source of [undefined, {}, { typeLabel: {} }, { typeLabel: { enabled: true, label: "  " } }, { typeLabel: { enabled: false, label: "Secret" } }]) {
    assert.equal(itemDisplayLabel(source), "");
    const presentation = buildItemPresentation(item(source), { config: conf });
    assert.equal(presentation.typeLabel, "");
    assert.equal(presentation.showTypeLabel, false);
    const html = renderItemCard(item(source), rarities);
    assert.doesNotMatch(html, /buxa-world-type|buxa-world-meta-sep|>TOOL</);
  }
});

test("custom label survives rules normalization and appears in sheet, hover, and directory view models", () => {
  const flags = { typeLabel: { enabled: true, label: "  Mystery Potion  " } };
  assert.equal(normalizeItemRules(flags, conf.items).typeLabel.label, "Mystery Potion");
  const presentation = buildItemPresentation(item(flags, "weapon"), { config: conf });
  assert.equal(presentation.typeLabel, "Mystery Potion");
  assert.equal(presentation.showTypeLabel, true);
  assert.equal(itemCardData(item(flags), rarities).type, "MYSTERY POTION");
  const html = renderItemCard(item(flags), rarities);
  assert.match(html, /buxa-world-type">MYSTERY POTION/);
  assert.match(html, /buxa-world-meta-sep/);
  assert.doesNotMatch(html, />TOOL</);
});

test("disabling a custom label hides it everywhere without destroying the saved label", () => {
  const flags = { typeLabel: { enabled: false, label: "Weapon" } };
  assert.equal(normalizeItemRules(flags, conf.items).typeLabel.label, "Weapon");
  assert.equal(buildItemPresentation(item(flags), { config: conf }).showTypeLabel, false);
  assert.equal(itemCardData(item(flags), rarities).type, "");
});

test("world directory searches cosmetic labels but not hidden internal types", () => {
  const items = [item({ typeLabel: { enabled: true, label: "Potion" } })];
  const common = { folders: [], items, rarities };
  assert.match(directoryListHTML({ ...common, query: "potion" }), /Flask/);
  assert.match(directoryListHTML({ ...common, query: "TOOL" }), /No matching items/);
  assert.match(directoryListHTML({ ...common, query: "flask" }), /Flask/);
  items[0] = item({ typeLabel: { enabled: false, label: "Potion" } });
  assert.match(directoryListHTML({ ...common, query: "potion" }), /No matching items/);
});

test("new item popover has only Name and Rarity; Info tab has editable custom label", () => {
  const create = fs.readFileSync(new URL("../scripts/apps/item-directory-ui.js", import.meta.url), "utf8");
  const template = fs.readFileSync(new URL("../templates/item-config.hbs", import.meta.url), "utf8");
  assert.match(create, /<label>Name<input name="name"/);
  assert.match(create, /<label>Rarity<select name="rarityId"/);
  assert.doesNotMatch(create, /<select name="type"|data\.get\("type"\)/);
  assert.match(create, /Item\.create\(\{ name, type: defaultType/);
  assert.match(template, /<strong>ITEM LABEL<\/strong>/);
  assert.match(template, /data-item-type-label type="text" maxlength="48"/);
  assert.match(template, /Display-only category/);
});
