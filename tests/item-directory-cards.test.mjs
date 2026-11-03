import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { itemCardData, renderItemCard, renderFolderCard } from "../scripts/apps/item-directory-cards.js";
import { directoryListHTML } from "../scripts/apps/item-directory-tree.js";

const rarities = [
  { id: "common", label: "COMMON", color: "#9098a6" },
  { id: "legendary", label: "LEGENDARY", color: "#f2ca43", glint: true },
  { id: "relic", label: "RELIC", color: "#f060b8", animated: true }
];
const item = (id, name, rarityId="common", folder=null) => ({
  id, name, type: "tool", img: "icons/test.svg", folder,
  flags: { buxaframework: { item: { rarityId, typeLabel: { enabled: true, label: "Weapon" }, levelRequirement: { enabled: true, level: 5 } } } },
  system: { quantity: 3 }
});

test("item previews show artwork, name, rarity, type, quantity and optional level", () => {
  const html = renderItemCard(item("a", "Hammer", "legendary"), rarities);
  assert.match(html, /buxa-world-art/);
  assert.match(html, /Hammer/);
  assert.match(html, /LEGENDARY/);
  assert.match(html, /WEAPON/);
  assert.match(html, /LV 5/);
  assert.match(html, /×3/);
  assert.match(html, /--buxa-card-accent:#f2ca43/);
  assert.match(html, /is-glint/);
  assert.doesNotMatch(html, /width:20px/);
});
test("user item names and images are escaped in markup", () => {
  const html = renderItemCard({ ...item("bad", '<img onerror="foo">'), img:'x" onerror="bad"' }, rarities);
  assert.doesNotMatch(html, /<img onerror/);
  assert.doesNotMatch(html, /src="x" onerror/);
  assert.match(html, /&lt;img/);
});
test("unknown item rarity and invalid folder colors use stable defaults", () => {
  assert.equal(itemCardData(item("x", "Sample", "something"), rarities).rarity, "COMMON");
  assert.match(renderFolderCard({ id: "f", name: "Archive", color:"url(something)" }), /--buxa-folder-accent:#819bb3/);
});
test("nested folder expansion and left opening are separate options", () => {
  const folders=[{ id:"f", name:"Chest", folder:null }, { id:"sub", name:"Inner", folder:"f" }];
  const items=[item("a", "Potion", "relic", "sub")];
  const flat=directoryListHTML({ folders, items, rarities, expanded:new Set(), left:false });
  assert.match(flat, /Chest/);assert.doesNotMatch(flat, /Inner/);assert.doesNotMatch(flat,/Potion/);
  const nested=directoryListHTML({ folders, items, rarities, expanded:new Set(["f","sub"]), left:false });
  assert.match(nested,/Potion/);
  const left=directoryListHTML({ folders, items, rarities, expanded:new Set(["f","sub"]), left:true });
  assert.match(left,/fa-chevron-left/); assert.doesNotMatch(left,/Potion/);
});
test("search finds items in closed folders and handles unknown type and rarity", () => {
  const html = directoryListHTML({folders:[{id:"f", name:"Archive", folder:null}],items:[item("a", "Axe", "relic", "f")],rarities,query:"axe"});
  assert.match(html,/Axe/); assert.match(html,/Archive/); assert.match(html,/RELIC/);
});
test("folder panel rows use the same rarity-aware visual cards", () => {
  const html=renderItemCard(item("a", "Staff", "relic"),rarities,{panel:true});
  assert.match(html,/buxa-folder-entry is-item/);assert.match(html,/data-buxa-item="a"/);
  assert.match(html,/--buxa-card-accent:#f060b8/);
});

test("rarity sorting reorders cards without altering their flags", () => {
  const html=directoryListHTML({folders:[],items:[item("a","Common","common"),item("b","Legendary","legendary")],rarities,sort:"rarity"});
  assert.ok(html.indexOf("Legendary")<html.indexOf("Common"));
});
test("custom sidebar replaces core rows while retaining document UI actions", () => {
  const fs = requireSource("scripts/apps/item-directory-view.js");
  const css = requireSource("styles/120-world-item-directory.css");
  assert.match(fs,/mountBuxaItemDirectory/);
  assert.match(fs,/Item Directory|Buxa Item Directory/);
  assert.match(fs,/data-buxa-dir-create/);
  assert.match(fs,/event\.dataTransfer\.setData/);
  assert.match(fs,/await moveSortedWorldItem\(item, \{ folderId \}\)/);
  assert.match(css,/> :not\(\.buxa-world-item-directory\)/);
  assert.match(css,/\.buxa-world-art img/);
});
function requireSource(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}
