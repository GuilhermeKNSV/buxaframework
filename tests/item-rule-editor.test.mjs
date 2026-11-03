import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { describeItemChoice, listItemChoices } from "../scripts/apps/item-rule-choice.js";
import { itemDiceSummary, itemIncreaseSummary } from "../scripts/apps/item-rule-editor.js";

function option(value, label, selected = false) {
  return { value, textContent: label, selected, disabled: false };
}
function fakeRow(fields) {
  return { querySelector: (selector) => fields[selector.slice(1, -1)] ?? null };
}

test("grouped picker separates category from label without losing the source value", () => {
  const source = { options: [
    option("none:", "NONE · No modifier", true),
    option("attribute:str", "ATTRIBUTES · Strength · Modifier"),
    option("proficiency:pick", "PROFICIENCIES · Lockpicking · Modifier")
  ] };
  const choices = listItemChoices(source);
  assert.deepEqual(choices.map((entry) => [entry.value, entry.group, entry.label]), [
    ["none:", "NONE", "No modifier"],
    ["attribute:str", "ATTRIBUTES", "Strength · Modifier"],
    ["proficiency:pick", "PROFICIENCIES", "Lockpicking · Modifier"]
  ]);
  assert.equal(choices[0].selected, true);
});

test("same-name proficiencies remain separate with distinguishable ID tags", () => {
  const source = { options: [
    option("proficiency:abc", "PROFICIENCIES · New proficiency · Modifier"),
    option("proficiency:def", "PROFICIENCIES · New proficiency · Modifier"),
    option("attribute:abc", "ATTRIBUTES · New proficiency · Modifier")
  ] };
  const choices = listItemChoices(source, "new prof");
  assert.equal(choices.length, 3);
  assert.equal(choices[0].duplicate, true);
  assert.equal(choices[1].duplicate, true);
  assert.equal(choices[2].duplicate, false);
  assert.deepEqual(choices.map((entry) => entry.id), ["abc", "def", "abc"]);
});

test("search is accent-insensitive and matches source IDs", () => {
  const source = { options: [
    option("attribute:forca", "ATTRIBUTES · Força · Modifier"),
    option("proficiency:q6", "PROFICIENCIES · New proficiency · Modifier")
  ] };
  assert.equal(listItemChoices(source, "FORCA")[0].value, "attribute:forca");
  assert.equal(listItemChoices(source, "q6")[0].value, "proficiency:q6");
  assert.deepEqual(listItemChoices(source, "nonexistent"), []);
});

test("disabled choices cannot be selected and empty labels remain stable", () => {
  const opts = [option("enabled", "Enabled")];
  opts.push({ ...option("disabled", "Disabled"), disabled: true });
  assert.equal(listItemChoices({ options: opts }).length, 1);
  assert.deepEqual(describeItemChoice({ textContent: "Resource" }), { group: "OPTIONS", label: "Resource" });
});

test("increase summary reflects changes in target, percentage and passive mode", () => {
  const row = fakeRow({
    "data-item-increase-target": { selectedOptions: [option("stat:initiative:value", "STATS · Initiative")] },
    "data-item-increase-value": { value: -15 },
    "data-item-increase-mode": { value: "percent" },
    "data-item-increase-activation": { value: "passive" }
  });
  assert.equal(itemIncreaseSummary(row), "Initiative  ·  -15%  ·  Passive");
});

test("dice summary reflects 4d20, bonus and optional modifier without modifying data", () => {
  const row = fakeRow({
    "data-item-dice-count": { value: "4" },
    "data-item-dice-faces": { value: "20" },
    "data-item-dice-flat": { value: "2" },
    "data-item-dice-roll-mode": { selectedOptions: [{ textContent: "Advantage" }] },
    "data-item-dice-attribute-enabled": { checked: false },
    "data-item-dice-modifier": { selectedOptions: [option("attribute:strength", "Strength modifier")] }
  });
  assert.equal(itemDiceSummary(row), "4d20 + 2 + MOD  ·  Advantage");
});

test("both editor rows preserve every legacy data field used for saving", () => {
  const template = fs.readFileSync(new URL("../templates/item-config.hbs", import.meta.url), "utf8");
  for (const marker of [
    "data-item-increase-target", "data-item-increase-mode", "data-item-increase-activation", "data-item-increase-value",
    "data-item-increase-tooltip-style", "data-item-increase-tooltip-enabled", "data-item-increase-tooltip-label",
    "data-item-dice-label", "data-item-dice-count", "data-item-dice-faces", "data-item-dice-flat",
    "data-item-dice-roll-mode", "data-item-dice-attribute-enabled", "data-item-dice-attribute-id",
    "data-item-dice-attribute-faces", "data-item-dice-modifier", "data-item-dice-show-range", "data-item-dice-chat-roll",
    "data-item-dice-tooltip-enabled", "data-item-dice-tooltip-style", "data-item-dice-tooltip-label",
    "data-item-tooltip-icon", "data-item-tooltip-icon-browse",
    "data-buxa-rule-collapse", "data-buxa-search-picker", "data-buxa-appearance"
  ]) {
    assert.ok(template.includes(marker), `Missing expected form selector ${marker}`);
  }
});

test("module imports the new editor styles after legacy styles, keeping old sheet displays", () => {
  const entry = fs.readFileSync(new URL("../styles/buxa.css", import.meta.url), "utf8");
  const position = entry.indexOf("./111-item-rule-editor.css");
  assert.ok(position > entry.indexOf("./109-item-dice-tooltip.css"));
  assert.ok(position > entry.indexOf("./110-window-resize.css"));
});
