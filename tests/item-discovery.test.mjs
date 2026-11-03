import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizeItemRules, normalizeItemSystemConfig } from "../scripts/core/item-config.js";
import {
  normalizeDescriptionParts, descriptionView, mergeTargetFor, changeDiscoveryState
} from "../scripts/core/item-discovery.js";
import { getActiveItemIncreaseEntries, getItemIncreaseAggregate } from "../scripts/core/item-effects.js";
import { buildItemPresentation } from "../scripts/core/item-presentation.js";

globalThis.foundry = { utils: { getProperty: (obj, path) => path.split(".").reduce((value, key) => value?.[key], obj) } };

const conf = { items: normalizeItemSystemConfig(), attributes: { entries: [] }, proficiencies: { entries: [] }, resources: [] };
const createItem = (raw) => ({
  id: "abc", name: "Discovery Axe", type: "tool", img: "icons/svg/item-bag.svg", parent: null,
  getFlag: (module, key) => module === "buxaframework" && key === "item" ? raw : undefined,
  system: { quantity: 1 }
});
const inc = (id, value, visibility, reveal = {}) => ({ id, value, target: "stat:initiative:value", mode: "flat", activation: "passive", visibility, reveal, tooltip: { enabled: true, label: "Initiative" } });

test("legacy description migrates into an editable part", () => {
  const rules = normalizeItemRules({ description: { enabled: true, text: "A very old relic" } }, conf.items);
  assert.equal(rules.version, 6);
  assert.equal(rules.description.mode, "standard");
  assert.equal(rules.description.parts[0].text, "A very old relic");
  assert.equal(descriptionView(rules.description)[0].text, "A very old relic");
});

test("description parts assemble, hide and replace without showing secret", () => {
  const parts = normalizeDescriptionParts([
    { id: "start", text: "Owned by", visibility: "revealed" },
    { id: "secret", text: "unknown", revealedText: "Loki", visibility: "locked", join: "space" },
    { id: "hint", text: "actual dark secret", visibility: "hidden" },
    { id: "dm", text: "DO NOT SHOW", visibility: "dmOnly" }
  ]);
  let view = descriptionView({ enabled: true, parts });
  assert.deepEqual(view.map((p) => p.text), ["Owned by", "unknown", "???"]);
  assert.equal(JSON.stringify(view).includes("Loki"), false);
  assert.equal(JSON.stringify(view).includes("DO NOT SHOW"), false);
  const next = changeDiscoveryState({ description: { parts } }, "description", "secret", "revealed");
  view = descriptionView({ enabled: true, parts: next.description.parts });
  assert.equal(view[1].text, "Loki");
  assert.equal(parts[1].visibility, "locked", "change must not mutate source");
});

test("locked/hidden/dm-only increase have no mechanical effect", () => {
  const raw = { increases: [
    inc("base", 5, "revealed"), inc("locked", 20, "locked"), inc("secret", 50, "hidden"), inc("gm", 100, "dmOnly")
  ] };
  const item = createItem(raw);
  const actor = { items: [item], getFlag: () => ({}) };
  const entries = getActiveItemIncreaseEntries(actor, conf);
  assert.deepEqual(entries.map((e) => e.increase.id), ["base"]);
  assert.equal(getItemIncreaseAggregate(actor, "stat:initiative:value", conf).flat, 5);
});

test("merge-compatible +5 and +5 become one visible +10, but still add mechanically", () => {
  const rules = normalizeItemRules({ increases: [inc("base", 5, "revealed"), inc("secret", 5, "revealed", { mergeInto: "base" })] }, conf.items);
  const source = rules.increases[1];
  assert.equal(mergeTargetFor(source, rules.increases)?.id, "base");
  const item = createItem(rules);
  const lines = buildItemPresentation(item, { config: conf }).increaseLines;
  assert.equal(lines.length, 1);
  assert.equal(lines[0].valueText, "+10");
  const actor = { items: [item], getFlag: () => ({}) };
  assert.equal(getItemIncreaseAggregate(actor, "stat:initiative:value", conf).flat, 10);
});

test("merge refuses different targets or unknown links; does not lose bonuses", () => {
  const base = inc("base", 5, "revealed");
  const different = { ...inc("secret", 5, "revealed", { mergeInto: "base" }), mode: "percent" };
  assert.equal(mergeTargetFor(different, [base, different]), null);
  const dangling = inc("other", 5, "revealed", { mergeInto: "removed" });
  assert.equal(mergeTargetFor(dangling, [base, dangling]), null);
});

test("one-click reveal upgrades rarity and can re-lock", () => {
  const rules = normalizeItemRules({ rarityId: "rare", increases: [inc("secret", 20, "hidden", { rarityId: "epic" })] }, conf.items);
  const revealed = changeDiscoveryState(rules, "increase", "secret", "revealed", ["rare", "epic"]);
  assert.equal(revealed.increases[0].visibility, "revealed");
  assert.equal(revealed.rarityId, "epic");
  assert.equal(rules.rarityId, "rare");
  assert.equal(changeDiscoveryState(revealed, "increase", "secret", "locked").increases[0].visibility, "locked");
  assert.equal(changeDiscoveryState(rules, "increase", "nonexistent", "revealed"), null);
  assert.equal(changeDiscoveryState(rules, "increase", "secret", "bad-state"), null);
});

test("player display is masked; forbidden dice blocked in roll path and context menu", () => {
  const raw = {
    dice: [
      { id: "normal", label: "Normal", visibility: "revealed" },
      { id: "locked", label: "Hidden formula", count: 20, visibility: "locked" },
      { id: "hidden", label: "SECRET", count: 99, visibility: "hidden" },
      { id: "dm", label: "TOPSECRET", count: 99, visibility: "dmOnly" }
    ],
    increases: [ inc("locked", 20, "locked"), inc("hidden", 50, "hidden"), inc("dm", 100, "dmOnly") ]
  };
  const item = createItem(raw);
  const presentation = buildItemPresentation(item, { config: conf });
  const playerView = JSON.stringify({ diceLines: presentation.diceLines, increaseLines: presentation.increaseLines });
  assert.equal(presentation.diceLines.length, 3);
  assert.equal(presentation.increaseLines.length, 2);
  assert.equal(presentation.diceLines[2].displayText, "???");
  assert.ok(!playerView.includes("TOPSECRET"));
  assert.ok(!playerView.includes("SECRET"));
  assert.ok(!playerView.includes("100"));
  assert.ok(!playerView.includes("99"));
  assert.ok(fs.readFileSync(new URL("../scripts/core/item-dice.js", import.meta.url), "utf8").includes("!isRevealed(dice)"));
  assert.ok(fs.readFileSync(new URL("../scripts/apps/item-context-menu.js", import.meta.url), "utf8").includes("isRevealed(entry)"));
});

test("item editor exposes modular description, reveal and merge controls", () => {
  const config = fs.readFileSync(new URL("../templates/item-config.hbs", import.meta.url), "utf8");
  const sheet = fs.readFileSync(new URL("../templates/item-sheet.hbs", import.meta.url), "utf8");
  const tooltip = fs.readFileSync(new URL("../scripts/apps/item-tooltip.js", import.meta.url), "utf8");
  assert.equal((config.match(/data-item-entry-visibility/g) || []).length, 4);
  assert.equal((config.match(/data-item-increase-merge-into/g) || []).length, 2);
  assert.ok(config.includes("data-item-description-template"));
  assert.ok(config.includes('data-item-config-tab="control"'));
  assert.ok(config.includes('data-item-control-set'));
  assert.ok(!sheet.includes('data-action="buxaShowControl"'));
  assert.ok(!sheet.includes('data-action="buxaSetDiscovery"'));
  assert.ok(!tooltip.includes('header.append(art, copy)'));
  const menu = fs.readFileSync(new URL("../scripts/apps/item-context-menu.js", import.meta.url), "utf8");
  assert.ok(!menu.includes('header.append(image, copy)'));
  assert.ok(menu.includes('empty.className = "buxa-item-context-empty"'));
  assert.ok(!menu.includes('empty.textContent = "NO USE ACTION"'));
});

test("revealed merge can override the target tooltip label, icon and color", () => {
  const rules = normalizeItemRules({ increases: [
    inc("base", 5, "revealed"),
    inc("upgrade", 5, "revealed", { mergeInto: "base", label: "Blessed HP", icon: "icons/svg/holy-shield.svg", style: "custom", color: "#ffaabb" })
  ] }, conf.items);
  const view = buildItemPresentation(createItem(rules), { config: conf }).increaseLines;
  assert.equal(view.length, 1);
  assert.equal(view[0].valueText, "+10");
  assert.equal(view[0].label, "Blessed HP");
  assert.equal(view[0].icon, "icons/svg/holy-shield.svg");
  assert.equal(view[0].color, "#ffaabb");
});

test("locked and hidden values use muted or unknown presentation", () => {
  const rules = normalizeItemRules({ increases: [
    inc("locked", 20, "locked"), inc("hidden", 300, "hidden"), inc("dm", 500, "dmOnly")
  ] }, conf.items);
  const lines = buildItemPresentation(createItem(rules), { config: conf }).increaseLines;
  assert.equal(lines.length, 2);
  assert.equal(lines[0].locked, true);
  assert.equal(lines[0].color, "#788390");
  assert.equal(lines[0].valueText, "+20");
  assert.equal(lines[1].hidden, true);
  assert.equal(lines[1].valueText, "???");
  assert.equal(lines[1].label, "");
});

test("item template and stylesheet versions are complete", () => {
  const manifest = JSON.parse(fs.readFileSync(new URL("../module.json", import.meta.url), "utf8"));
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  const mainCSS = fs.readFileSync(new URL("../styles/buxa.css", import.meta.url), "utf8");
  assert.ok(mainCSS.includes('113-item-discovery.css'));
  assert.ok(mainCSS.includes('114-item-control-polish.css'));
  const configUI = fs.readFileSync(new URL("../templates/item-config.hbs", import.meta.url), "utf8");
  assert.ok(!configUI.includes("COLOR_{{"));
  assert.equal((configUI.match(/data-item-reveal-icon/g) || []).length, 4);
  assert.equal((configUI.match(/data-item-increase-merge-into/g) || []).length, 2);
});
