/* Notification regression tests, without a running Foundry VTT server.
 * Run with node --experimental-default-type=module --test tests/*.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const { normalizeWarningSettings, normalizeUiSettings } = await import("../scripts/core/notification-settings.js");
const { DEFAULT_SHEET_CONFIG } = await import("../scripts/core/constants.js");

globalThis.foundry = { utils: { deepClone: structuredClone } };
const { normalizeSheetConfig } = await import("../scripts/core/config.js");
const { notifyWarning, notifySuccess, syncNotificationPlacement } = await import("../scripts/core/notifications.js");
const { readWarningSettings, previewWarningSettings } = await import("../scripts/apps/layout-config-notifications.js");
const { applyConfigNavigation } = await import("../scripts/apps/layout-config-navigation.js");

function fakeDom() {
  let nextTimerId = 1;
  const timers = new Map();
  const all = new Set();
  class FakeElement {
    constructor(tag) {
      this.tagName = tag;
      this.children = [];
      this.dataset = {};
      this.attrs = {};
      this.listeners = {};
      this.removed = false;
      const classes = new Set();
      this.classList = {
        add: (name) => classes.add(name),
        contains: (name) => classes.has(name)
      };
      const styles = {};
      this.style = { setProperty: (key, val) => { styles[key] = val; }, getPropertyValue: (key) => styles[key] };
      all.add(this);
    }
    setAttribute(name, val) { this.attrs[name] = val; }
    append(...children) { this.children.push(...children); }
    remove() { this.removed = true; }
    addEventListener(name, handler) { this.listeners[name] = handler; }
    querySelectorAll(selector) {
      if (selector === ".buxa-toast:not(.is-leaving)") return this.children.filter((item) => item.className?.includes("buxa-toast ") && !item.classList.contains("is-leaving") && !item.removed);
      return [];
    }
  }
  const body = new FakeElement("body");
  globalThis.document = {
    body,
    createElement: (tag) => new FakeElement(tag),
    getElementById: (id) => [...all].find((node) => node.id === id && !node.removed) ?? null
  };
  globalThis.window = {
    setTimeout(fn, delay) { const id = nextTimerId++; timers.set(id, { fn, delay }); return id; },
    clearTimeout(id) { timers.delete(id); }
  };
  globalThis.requestAnimationFrame = (fn) => { fn(); return 1; };
  return { body, timers, all };
}

let rawConfig = structuredClone(DEFAULT_SHEET_CONFIG);
globalThis.game = { settings: { get: () => rawConfig } };

const switchConfig = (warning) => { rawConfig = { ui: { warning } }; };

// Global fake DOM is reset for each test; tests in this file run sequentially.
test("warning config defaults, bad positions, values and old worlds normalize safely", () => {
  assert.deepEqual(normalizeWarningSettings(), { durationSeconds: 5, position: "right" });
  assert.deepEqual(normalizeWarningSettings({ durationSeconds: -10, position: "top" }), { durationSeconds: 0, position: "right" });
  assert.deepEqual(normalizeWarningSettings({ durationSeconds: 600, position: "left" }), { durationSeconds: 60, position: "left" });
  assert.deepEqual(normalizeWarningSettings({ durationSeconds: "", position: "center" }), { durationSeconds: 5, position: "center" });
  assert.deepEqual(normalizeUiSettings(null).warning, { durationSeconds: 5, position: "right" });
});

test("existing world configs gain warning options without resetting custom rules", () => {
  const raw = structuredClone(DEFAULT_SHEET_CONFIG);
  delete raw.ui;
  raw.basicTabLabel = "Custom character details";
  raw.inventory.slots = 87;
  const normalized = normalizeSheetConfig(raw);
  assert.equal(normalized.basicTabLabel, "Custom character details");
  assert.equal(normalized.inventory.slots, 87);
  assert.deepEqual(normalized.ui.warning, { durationSeconds: 5, position: "right" });
});

test("warnings and saved toasts auto-dismiss after configured seconds, not permanently", () => {
  const { timers } = fakeDom();
  switchConfig({ durationSeconds: 4, position: "left" });
  const toast = notifyWarning("You cannot equip this item.");
  assert.ok(toast);
  assert.equal(document.getElementById("buxa-toast-stack").dataset.position, "left");
  assert.equal(toast.style.getPropertyValue("--buxa-toast-duration"), "4000ms");
  assert.equal([...timers.values()].filter((entry) => entry.delay === 4000).length, 1);
  const saved = notifySuccess("Layout saved.");
  assert.equal(saved.style.getPropertyValue("--buxa-toast-duration"), "4000ms");
  const first = [...timers].find(([, entry]) => entry.delay === 4000);
  first[1].fn();
  assert.equal(toast.classList.contains("is-leaving"), true);
  const exit = [...timers.values()].find((entry) => entry.delay === 190);
  assert.ok(exit);
  exit.fn();
  assert.equal(toast.removed, true);
});

test("explicit zero-duration sticks, and an explicit timeout can override settings", () => {
  const { timers } = fakeDom();
  switchConfig({ durationSeconds: 0, position: "center" });
  const pinned = notifyWarning("Persistent warning");
  assert.equal(pinned.children.at(-1).hidden, true);
  assert.equal(timers.size, 0);
  const overridden = notifyWarning("Temporary warning", { timeout: 1200 });
  assert.equal(overridden.style.getPropertyValue("--buxa-toast-duration"), "1200ms");
  assert.equal(document.getElementById("buxa-toast-stack").dataset.position, "center");
  assert.equal([...timers.values()][0].delay, 1200);
});

test("new configuration changes placement of already-visible notifications", () => {
  fakeDom();
  switchConfig({ durationSeconds: 0, position: "right" });
  notifySuccess("Saved");
  switchConfig({ durationSeconds: 3, position: "center" });
  syncNotificationPlacement();
  assert.equal(document.getElementById("buxa-toast-stack").dataset.position, "center");
});

test("preview reads unsaved field values without writing module settings", () => {
  const { timers } = fakeDom();
  switchConfig({ durationSeconds: 5, position: "right" });
  const root = {
    querySelector(query) {
      if (query === "[data-warning-dismiss-seconds]") return { value: "8" };
      if (query === '[data-warning-position]:checked') return { value: "left" };
      return null;
    }
  };
  assert.deepEqual(readWarningSettings(root), { durationSeconds: 8, position: "left" });
  previewWarningSettings(root);
  assert.equal([...timers.values()][0].delay, 8000);
  assert.equal(document.getElementById("buxa-toast-stack").dataset.position, "left");
  assert.equal(rawConfig.ui.warning.position, "right");
});

test("config navigation shows the requested UI > Warning panel", () => {
  const groups = new Map();
  function button(dataset = {}) {
    let active = false;
    return { dataset, classList: { toggle(_className, value) { active = value; } }, get active() { return active; } };
  }
  const uiButton = button({ configSection: "ui" });
  const uiTab = button({ configUiTab: "warning" });
  const uiNav = {};
  const playerNav = {};
  const warningPanel = { dataset: { configPanel: "ui-warning" }, hidden: true };
  const inventoryPanel = { dataset: { configPanel: "inventory" }, hidden: true };
  const heading = { textContent: "" };
  groups.set("[data-config-section]", [uiButton]);
  groups.set("[data-config-tab]", []);
  groups.set("[data-config-ui-tab]", [uiTab]);
  groups.set("[data-config-panel]", [warningPanel, inventoryPanel]);
  const elements = { "[data-player-sheet-tabs]": playerNav, "[data-ui-tabs]": uiNav, "[data-config-heading]": heading };
  const app = { _activeSection: "ui", _activeTab: "basic", _activeUiTab: "warning", element: {
    querySelector(selector) { return elements[selector] ?? null; },
    querySelectorAll(selector) { return groups.get(selector) ?? []; }
  } };
  applyConfigNavigation(app);
  assert.equal(uiButton.active, true);
  assert.equal(uiTab.active, true);
  assert.equal(uiNav.hidden, false);
  assert.equal(playerNav.hidden, true);
  assert.equal(warningPanel.hidden, false);
  assert.equal(inventoryPanel.hidden, true);
  assert.equal(heading.textContent, "UI");
});
