import test from "node:test";
import assert from "node:assert/strict";
import { isValidSplitQuantity, positionSplitPopover, promptUnstackAmount } from "../scripts/apps/unstack-dialog.js";

test("split amount accepts only whole quantities leaving at least one in source", () => {
  for (const valid of ["1", "2", "3", "03", 2]) assert.equal(isValidSplitQuantity(valid, 3), true);
  for (const invalid of [0, "", " ", -1, "1.1", "NaN", "Infinity", "4", 4, "3e0", "-2", "2.0", "2abc", null]) {
    assert.equal(isValidSplitQuantity(invalid, 3), false, String(invalid));
  }
});

test("floating popover stays beside pointer while clamped to every screen edge", () => {
  const opts = { width: 205, height: 44, viewportWidth: 800, viewportHeight: 600 };
  assert.deepEqual(positionSplitPopover({ ...opts, x: 200, y: 200 }), { left: 209, top: 178 });
  assert.deepEqual(positionSplitPopover({ ...opts, x: 796, y: 598 }), { left: 582, top: 547 });
  assert.deepEqual(positionSplitPopover({ ...opts, x: 0, y: 0 }), { left: 9, top: 9 });
  assert.deepEqual(positionSplitPopover({ ...opts, x: 799, y: 1 }), { left: 585, top: 9 });
});

// Minimal DOM fixture to exercise real event registration and cleanup without
// requiring Foundry to be running for every regression test.
class Emitter {
  constructor() { this.listeners = new Map(); }
  addEventListener(name, callback) { const handlers = this.listeners.get(name) || new Set(); handlers.add(callback); this.listeners.set(name, handlers); }
  removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback); }
  emit(name, props = {}) {
    const event = { type: name, target: this, currentTarget: this, prevented: false, preventDefault() { this.prevented = true; }, ...props };
    for (const listener of this.listeners.get(name) || []) listener(event);
    return event;
  }
  count(name) { return this.listeners.get(name)?.size ?? 0; }
}
class FakeNode extends Emitter {
  constructor(tagName = "div") {
    super(); this.tagName = tagName.toUpperCase(); this.children = []; this.style = {};
    this.attributes = {}; this.value = ""; this.disabled = false;
  }
  setAttribute(k, v) { this.attributes[k] = v; }
  append(child) { this.children.push(child); child.parent = this; }
  remove() { if (!this.parent) return; this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  focus() { this.focused = true; }
  select() { this.selected = true; }
  getBoundingClientRect() { return { width: 205, height: 44 }; }
  set innerHTML(html) {
    this.html = html;
    this.elements = new Map();
    const form = new FakeNode("form"); this.append(form);
    this.elements.set("form", form);
    for (const key of ["minus", "number", "plus", "submit"]) {
      const element = new FakeNode(key === "number" ? "input" : "button");
      form.append(element); this.elements.set(`[data-unstack-${key}]`, element);
    }
  }
  querySelector(selector) { return this.elements?.get(selector) ?? null; }
}
class FakeDocument extends Emitter {
  constructor() {
    super(); this.body = new FakeNode("body"); this.documentElement = { clientWidth: 800, clientHeight: 600 };
    this.defaultView = Object.assign(new Emitter(), { innerWidth: 800, innerHeight: 600 });
  }
  createElement(tagName) { return new FakeNode(tagName); }
}
globalThis.foundry = { utils: { getProperty: (source, path) => String(path).split(".").reduce((value, key) => value?.[key], source) } };
const item = (quantity) => ({ system: { quantity } });

test("split picker is non-modal, anchored, keyboard-submittable, and removes listeners", async () => {
  const doc = new FakeDocument();
  const result = promptUnstackAmount(item(4), { ownerDocument: doc, anchor: { x: 280, y: 160 } });
  const popup = doc.body.children[0];
  assert.equal(popup.tagName, "DIV");
  assert.equal(popup.attributes.role, "dialog");
  assert.equal(popup.style.left, "289px");
  assert.equal(popup.style.top, "138px");
  assert.equal(popup.children.length, 1);
  assert.equal(popup.querySelector("[data-unstack-number]").value, "2");
  assert.equal(doc.body.children.length, 1);
  assert.equal(doc.count("pointerdown"), 1);
  assert.equal(doc.defaultView.count("resize"), 1);
  const input = popup.querySelector("[data-unstack-number]");
  input.value = "4";
  input.emit("input");
  assert.equal(popup.querySelector("[data-unstack-submit]").disabled, true);
  input.value = "2";
  input.emit("input");
  assert.equal(popup.querySelector("[data-unstack-submit]").disabled, false);
  const submitEvent = popup.querySelector("form").emit("submit");
  assert.equal(submitEvent.prevented, true);
  assert.equal(await result, 2);
  assert.equal(doc.body.children.length, 0);
  assert.equal(doc.count("pointerdown"), 0);
  assert.equal(doc.count("keydown"), 0);
  assert.equal(doc.defaultView.count("resize"), 0);
  assert.equal(doc.defaultView.count("scroll"), 0);
});

test("plus/minus, outside click, Escape and opening another picker work", async () => {
  const doc = new FakeDocument();
  const first = promptUnstackAmount(item(3), { ownerDocument: doc });
  const popup = doc.body.children[0];
  const input = popup.querySelector("[data-unstack-number]");
  popup.querySelector("[data-unstack-plus]").emit("click");
  assert.equal(input.value, "2");
  popup.querySelector("[data-unstack-plus]").emit("click");
  assert.equal(input.value, "2");
  popup.querySelector("[data-unstack-minus]").emit("click");
  assert.equal(input.value, "1");
  const second = promptUnstackAmount(item(7), { ownerDocument: doc });
  assert.equal(await first, null);
  assert.equal(doc.body.children.length, 1);
  assert.notEqual(doc.body.children[0], popup);
  doc.emit("keydown", { key: "Escape" });
  assert.equal(await second, null);
  const third = promptUnstackAmount(item(4), { ownerDocument: doc });
  doc.emit("pointerdown", { target: new FakeNode() });
  assert.equal(await third, null);
  assert.equal(doc.body.children.length, 0);
});

test("scroll/resize dismiss; singleton stack opens nothing", async () => {
  const doc = new FakeDocument();
  assert.equal(await promptUnstackAmount(item(1), { ownerDocument: doc }), null);
  assert.equal(doc.body.children.length, 0);
  const first = promptUnstackAmount(item(3), { ownerDocument: doc });
  doc.defaultView.emit("resize");
  assert.equal(await first, null);
  const second = promptUnstackAmount(item(3), { ownerDocument: doc });
  doc.defaultView.emit("scroll");
  assert.equal(await second, null);
});
