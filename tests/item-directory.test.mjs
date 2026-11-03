import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizeUiSettings } from "../scripts/core/notification-settings.js";

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("new worlds default to standard native folder expansion", () => {
  assert.equal(normalizeUiSettings().itemUi.openFoldersLeft, false);
});
test("folder expansion choice is opt-in and strictly boolean", () => {
  assert.equal(normalizeUiSettings({ itemUi: { openFoldersLeft: true } }).itemUi.openFoldersLeft, true);
  assert.equal(normalizeUiSettings({ itemUi: { openFoldersLeft: "true" } }).itemUi.openFoldersLeft, false);
});
test("folder setting doesn't reset the warning setting", () => {
  assert.deepEqual(normalizeUiSettings({ warning: { durationSeconds: 12, position: "left" }, itemUi: { openFoldersLeft: true } }), {
    warning: { durationSeconds: 12, position: "left" }, itemUi: { openFoldersLeft: true }
  });
});
test("item UI panel saves folder settings separately from warning settings", () => {
  assert.match(read("templates/layout-config.hbs"), /data-config-panel="ui-item-ui"/);
  assert.match(read("templates/layout-config.hbs"), /data-ui-item-folders-left/);
  assert.match(read("scripts/apps/layout-config.js"), /ui: \{ \.\.\.current\.ui, warning: readWarningSettings\(root\), itemUi:/);
  assert.match(read("scripts/apps/layout-config-navigation.js"), /"item-ui"/);
});
test("item creator sets rarity as real item flag, without opening Foundry type wizard", () => {
  const source = read("scripts/apps/item-directory-ui.js");
  assert.match(source, /Item\.create\(\{ name, type: defaultType/);
  assert.doesNotMatch(source, /<select name="type">/);
  assert.doesNotMatch(source, /data\.get\("type"\)/);
  assert.match(source, /flags: \{ \[MODULE_ID\]: \{ itemKind, item: \{ rarityId \}/);
  assert.match(source, /Folder\.create\(\{ name, type: "Item", color/);
});
test("directory context omits import and export and still includes ownership and deletion", () => {
  const source = read("scripts/apps/item-directory-ui.js");
  assert.match(source, /name: "Ownership"/);
  assert.match(source, /name: "Delete"/);
  assert.match(source, /import\|export/);
});
test("new left-folder panels accept world Item UUID drag data and move to native root", () => {
  const source = read("scripts/apps/item-folder-panels.js");
  assert.match(source, /data\.type !== "Item"/);
  assert.match(source, /Never move embedded actor items/);
  assert.match(source, /moveItem\(event, null\)/);
});
test("minimized item sheet hides its separate resize grip", () => {
  const item = read("scripts/apps/item-sheet.js");
  const css = read("styles/119-item-directory.css");
  assert.match(item, /async minimize\(\.\.\.args\)/);
  assert.match(item, /grip\.hidden = true/);
  assert.match(item, /async maximize\(\.\.\.args\)/);
  assert.match(css, /buxa-window-resize-grip\[hidden\]/);
});

test("delete item and folder use an anchored Buxa confirmation, not Foundry DialogV2", () => {
  const source = read("scripts/apps/item-directory-ui.js");
  assert.match(source, /function showDirectoryDeleteConfirmation/);
  assert.match(source, /showDirectoryDeleteConfirmation\(anchor, item/);
  assert.match(source, /showDirectoryDeleteConfirmation\(anchor, folder/);
  assert.doesNotMatch(source, /DialogV2\.confirm/);
});
test("the Buxa items sidebar respects the native active tab and uses flat corners", () => {
  const cards = read("styles/120-world-item-directory.css");
  const overlays = read("styles/119-item-directory.css");
  assert.doesNotMatch(cards, /min-height:0; display:flex; flex-direction:column/);
  assert.match(cards, /buxa-dir-active:not\(\.active\)/);
  assert.match(cards, /border-radius:0 !important/);
  assert.match(overlays, /\.buxa-directory-confirm/);
  assert.match(overlays, /border-radius:0 !important/);
});
