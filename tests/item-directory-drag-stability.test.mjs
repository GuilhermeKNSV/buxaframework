import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DirectoryReorderPreview } from "../scripts/apps/item-directory-reorder.js";

function createFixture() {
  let appendCount = 0;
  let insertCount = 0;
  let activeMarker = null;
  const document = {
    createElement() {
      return {
        style: {}, className: "", isConnected: false,
        setAttribute() {},
        remove() { this.isConnected = false; if (activeMarker === this) activeMarker = null; }
      };
    }
  };
  const container = {
    ownerDocument: document, scrollTop: 0,
    getBoundingClientRect: () => ({ top: 30, height: 400 }),
    contains: (element) => Boolean(element),
    append(marker) { appendCount++; marker.isConnected = true; activeMarker = marker; },
    insertBefore() { insertCount++; }
  };
  const rows = [100, 160, 220].map((top, index) => {
    const row = { getBoundingClientRect: () => ({ top, height: 55 }) };
    const item = {
      dataset: { buxaDirItem: String(index) },
      closest: (selector) => selector === ".buxa-world-tree-node" ? row : item
    };
    return { item, row };
  });
  const preview = new DirectoryReorderPreview(container, {
    itemSelector: "[data-buxa-dir-item]", rowSelector: ".buxa-world-tree-node"
  });
  return { rows, preview, stats: () => ({ appendCount, insertCount, activeMarker }) };
}

test("hundreds of rapid reversals reuse one stable guide without inserting a gap", () => {
  const { rows, preview, stats } = createFixture();
  for (let i = 0; i < 600; i++) {
    const row = rows[1 + (i % 2)];
    assert.equal(preview.update({ target: row.item, clientY: row.row.getBoundingClientRect().top + (i % 4 < 2 ? 5 : 50) }, "0"), true);
    assert.ok(preview.getTarget());
  }
  assert.equal(stats().appendCount, 1);
  assert.equal(stats().insertCount, 0);
  assert.equal(stats().activeMarker, preview.marker);
  preview.clear();
  assert.equal(preview.getTarget(), null);
  assert.equal(stats().activeMarker, null);
});

test("dragging over the source does not produce a reorder target", () => {
  const { rows, preview } = createFixture();
  assert.equal(preview.update({ target: rows[0].item, clientY: 105 }, "0"), false);
  assert.equal(preview.getTarget(), null);
});

test("guide remains on its chosen side within four-pixel midpoint hysteresis", () => {
  const { rows, preview } = createFixture();
  const item = rows[1].item;
  assert.equal(preview.update({ target: item, clientY: 177 }, "0"), true);
  assert.equal(preview.getTarget().before, true);
  preview.update({ target: item, clientY: 189 }, "0"); // mid=187.5, within 4px
  assert.equal(preview.getTarget().before, true);
  preview.update({ target: item, clientY: 195 }, "0");
  assert.equal(preview.getTarget().before, false);
});

test("the main directory and folder panels never replace/flash rows on dragover", () => {
  const main = fs.readFileSync(new URL("../scripts/apps/item-directory-view.js", import.meta.url), "utf8");
  const folder = fs.readFileSync(new URL("../scripts/apps/item-folder-panels.js", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../styles/120-world-item-directory.css", import.meta.url), "utf8");
  assert.match(main, /if \(draggedId !== null \|\| draggedFolderId !== null\) \{ state\.needsRender = true; return; \}/);
  assert.match(main, /const folderNode = event\.target\.closest\(\x27\[data-buxa-dir-folder\]\x27\)/);
  assert.match(folder, /const folder = event\.target\.closest\?\.\("\.buxa-folder-entry\.is-folder"\)/);
  assert.match(css, /\.buxa-world-reorder-guide/);
  assert.match(css, /pointer-events:none/);
});
