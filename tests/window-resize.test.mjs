import test from "node:test";
import assert from "node:assert/strict";
import { calculateWindowResize, enableWindowResize } from "../scripts/apps/window-resize.js";

function mockWindow() {
  const docHandlers = new Map();
  const viewHandlers = new Map();
  const makeTarget = (handlers) => ({
    addEventListener(name, fn) { handlers.set(name, fn); },
    removeEventListener(name, fn) { if (handlers.get(name) === fn) handlers.delete(name); },
    fire(name, event) { handlers.get(name)?.(event); }
  });
  const view = makeTarget(viewHandlers);
  const document = {
    ...makeTarget(docHandlers), defaultView: view,
    createElement(tag) {
      const element = {
        tagName: tag, dataset: {}, attrs: {}, listeners: new Map(),
        classes: new Set(),
        setAttribute(name, value) { this.attrs[name] = value; },
        addEventListener(name, fn) { this.listeners.set(name, fn); },
        fire(name, event) { this.listeners.get(name)?.(event); },
      };
      element.classList = {
        add: (key) => element.classes.add(key),
        remove: (key) => element.classes.delete(key)
      };
      return element;
    }
  };
  const root = {
    ownerDocument: document,
    children: [],
    isConnected: true,
    querySelector(selector) { return selector === "[data-buxa-window-resize]" ? this.children.find((child) => child.dataset.buxaWindowResize !== undefined) : null; },
    appendChild(child) { this.children.push(child); },
    getBoundingClientRect() { return { width: 520, height: 480 }; }
  };
  const app = {
    element: root,
    position: { width: 520, height: 480 },
    options: { window: { resizable: true } },
    changes: [],
    setPosition(pos) { this.changes.push(pos); this.position = { ...this.position, ...pos }; }
  };
  const event = (more = {}) => ({
    button: 0, pointerId: 4, clientX: 500, clientY: 470, type: "pointermove",
    preventDefault() {}, stopPropagation() {}, ...more
  });
  return { app, document, view, root, event, handlers: docHandlers };
}

test("resizing uses pointer deltas and respects sensible minimum sizes", () => {
  assert.deepEqual(calculateWindowResize({ width: 520, height: 480 }, 140, -60), { width: 660, height: 420 });
  assert.deepEqual(calculateWindowResize({ width: 520, height: 480 }, -900, -900), { width: 320, height: 260 });
});

test("one grip per window, even after repeated partial renders", () => {
  const { app, root } = mockWindow();
  const grip = enableWindowResize(app);
  assert.equal(root.children.length, 1);
  assert.equal(enableWindowResize(app), grip);
  assert.equal(root.children.length, 1);
  assert.equal(grip.type, "button");
  assert.ok(grip.attrs["aria-label"].includes("Resize"));
});

test("drag resizes the same Foundry app and removes document listeners on release", () => {
  const { app, document, event, handlers } = mockWindow();
  const grip = enableWindowResize(app);
  grip.fire("pointerdown", event({ type: "pointerdown" }));
  document.fire("pointermove", event({ clientX: 640, clientY: 530 }));
  assert.deepEqual(app.position, { width: 660, height: 540 });
  document.fire("pointerup", event({ type: "pointerup", clientX: 660, clientY: 540 }));
  assert.deepEqual(app.position, { width: 680, height: 550 });
  assert.ok(!handlers.has("pointermove"));
  assert.ok(!handlers.has("pointerup"));
  assert.ok(!grip.classes.has("is-resizing"));
});

test("keyboard arrows resize, and nonresizable windows are not modified", () => {
  const { app, event } = mockWindow();
  const grip = enableWindowResize(app);
  grip.fire("keydown", event({ key: "ArrowRight" }));
  grip.fire("keydown", event({ key: "ArrowDown" }));
  assert.deepEqual(app.position, { width: 544, height: 504 });
  app.options.window.resizable = false;
  assert.equal(enableWindowResize({ ...app, element: { ...app.element, querySelector: () => null } }), null);
});
