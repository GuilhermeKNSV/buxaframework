import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { appendItemHoverEffectLine } from "../scripts/apps/item-tooltip.js";

class FakeElement {
  constructor(tagName, document) {
    this.tagName = tagName;
    this.ownerDocument = document;
    this.children = [];
    this.className = "";
    this.textContent = "";
    this.src = "";
    this.alt = "";
    this.style = { properties: {}, setProperty: (key, value) => { this.style.properties[key] = value; } };
  }
  append(...children) { this.children.push(...children); }
}
const document = { createElement: (tag) => new FakeElement(tag, document) };
const makeParent = () => new FakeElement("section", document);

function assertEffectGroup(row, { icon, value, label, passive = false }) {
  assert.equal(row.children.length, 2, "icon and one compact value-first group");
  const [graphic, group] = row.children;
  assert.equal(graphic.tagName, icon);
  assert.equal(group.className, "buxa-item-effect-copy");
  assert.deepEqual(group.children.map((child) => child.textContent), [value, label, ...(passive ? ["PASSIVE"] : [])]);
  assert.deepEqual(group.children.map((child) => child.className), [
    "buxa-item-effect-value", "buxa-item-effect-label", ...(passive ? ["buxa-item-effect-passive"] : [])
  ]);
}

test("inventory hover dice reads icon → 1d20 → DAMAGE", () => {
  const parent = makeParent();
  appendItemHoverEffectLine(parent, { label: "DAMAGE", displayText: "1d20", color: "#eec544" }, "dice");
  assertEffectGroup(parent.children[0], { icon: "i", value: "1d20", label: "DAMAGE" });
  assert.equal(parent.children[0].style.properties["--buxa-tooltip-color"], "#eec544");
});

test("inventory hover increase reads icon → +20% → HP Maximum, with passive last", () => {
  const parent = makeParent();
  appendItemHoverEffectLine(parent, { label: "HP Maximum", valueText: "+20%", passive: true }, "increase");
  assertEffectGroup(parent.children[0], { icon: "i", value: "+20%", label: "HP Maximum", passive: true });
});

test("custom icons and lengthy dice ranges stay intact", () => {
  const parent = makeParent();
  appendItemHoverEffectLine(parent, {
    icon: "modules/buxaframework/assets/icons/weapon.svg", label: "Long range DAMAGE",
    displayText: "7–74 + Strength Modifier", color: "#af92fe"
  }, "dice");
  assertEffectGroup(parent.children[0], { icon: "img", value: "7–74 + Strength Modifier", label: "Long range DAMAGE" });
  assert.equal(parent.children[0].children[0].src, "modules/buxaframework/assets/icons/weapon.svg");
});

test("full item sheet puts computed value before text for both dice and increases", () => {
  const hbs = fs.readFileSync(new URL("../templates/item-sheet.hbs", import.meta.url), "utf8");
  const dice = hbs.match(/<div class="buxa-item-tooltip-line is-dice[^"]*"[\s\S]*?<\/div>/)?.[0];
  const increase = hbs.match(/<div class="buxa-item-tooltip-line is-increase[^"]*"[\s\S]*?<\/div>/)?.[0];
  assert.ok(dice && increase);
  assert.ok(dice.indexOf("{{displayText}}") < dice.indexOf("{{label}}"));
  assert.ok(increase.indexOf("{{valueText}}") < increase.indexOf("{{label}}"));
  assert.ok(increase.indexOf("{{label}}") < increase.indexOf("PASSIVE"));
  assert.ok(dice.includes("buxa-item-effect-copy"));
  assert.ok(increase.includes("buxa-item-effect-copy"));
});

test("new style module follows existing item UI styles; no fixed-width rightmost values", () => {
  const main = fs.readFileSync(new URL("../styles/buxa.css", import.meta.url), "utf8");
  const styles = fs.readFileSync(new URL("../styles/112-item-effect-display.css", import.meta.url), "utf8");
  assert.ok(main.indexOf("112-item-effect-display.css") > main.indexOf("111-item-rule-editor.css"));
  assert.ok(styles.includes("flex-flow: row wrap"));
  assert.ok(styles.includes("grid-template-columns: 18px minmax(0, 1fr)"));
  assert.ok(styles.includes(".buxa-item-hover-line .buxa-item-effect-value"));
  assert.match(styles, /\.buxa-item-sheet \.buxa-item-tooltip-line \.buxa-item-effect-value,[\s\S]*?color: var\(--buxa-tooltip-color/);
});
