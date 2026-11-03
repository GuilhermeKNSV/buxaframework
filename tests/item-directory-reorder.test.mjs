import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { itemSortUpdates, byDocumentOrder } from "../scripts/apps/item-directory-reorder.js";
import { directoryListHTML } from "../scripts/apps/item-directory-tree.js";
const item = (id, sort, folder = null) => ({ id, sort, folder, name: id, type:"tool", flags:{buxaframework:{item:{rarityId:"common"}}} });
const rarities = [{ id:"common", label:"Common", color:"#abcabc" }];
const helper = (document, {target, siblings, sortBefore}) => {
  const sorted = siblings.filter((d)=>d.id!==document.id);
  const index = target ? sorted.findIndex((d)=>d.id===target.id) : sorted.length;
  sorted.splice(target ? index + (sortBefore ? 0 : 1) : index, 0, document);
  return sorted.map((doc, index)=>({target:doc, update:{sort:(index+1)*1000}}));
};
test("native sort values, not item name, decide the manual display order", () => {
  const html = directoryListHTML({ folders:[], items:[item("A",2000), item("Z",1000)], rarities, sort:"manual" });
  assert.ok(html.indexOf('data-buxa-dir-item="Z"') < html.indexOf('data-buxa-dir-item="A"'));
  assert.deepEqual([item("A",2000),item("Z",1000)].sort(byDocumentOrder).map((i)=>i.id), ["Z","A"]);
});
test("dropping below a different item persists order via Foundry sort updates",()=>{
  const a=item("A",1000), b=item("B",2000), c=item("C",3000);
  const updates=itemSortUpdates(a,{ folderId:null, target:c, sortBefore:false, siblings:[a,b,c], sortingHelper:helper });
  assert.deepEqual(updates.map((d)=>d._id), ["B","C","A"]);
  assert.equal(updates.find((d)=>d._id==="A").sort, 3000);
});
test("sorting into a different folder only moves the dragged Item's folder",()=>{
  const source=item("a",1000,null), a=item("x",1000,"f"), b=item("y",2000,"f");
  const updates=itemSortUpdates(source,{ folderId:"f", target:a, sortBefore:true, siblings:[source,a,b], sortingHelper:helper });
  assert.equal(updates.find((d)=>d._id==="a").folder,"f");
  assert.ok(updates.filter((d)=>d._id!=="a").every((d)=>!("folder" in d)));
});
test("sorting is rejected if the target is in another folder and ignores self-drops",()=>{
  const a=item("a",1000,null), b=item("b",2000,"f");
  assert.throws(()=>itemSortUpdates(a,{ folderId:null,target:b,siblings:[a,b],sortingHelper:helper }),/destination folder/);
  assert.deepEqual(itemSortUpdates(a,{folderId:null,target:a,siblings:[a,b],sortingHelper:helper}),[]);
});
test("drag preview never inserts a layout-shifting placeholder and does not write documents",()=>{
  const source=fs.readFileSync(new URL("../scripts/apps/item-directory-reorder.js",import.meta.url),"utf8");
  assert.match(source,/previous\?\.key === key/);
  assert.match(source,/buxa-world-reorder-guide/);
  assert.doesNotMatch(source,/insertBefore\(marker/);
  const css=fs.readFileSync(new URL("../styles/120-world-item-directory.css",import.meta.url),"utf8");
  assert.match(css,/buxa-world-reorder-guide/);
  assert.match(css,/pointer-events:none/);
  assert.match(source,/itemSortUpdates/);
  const dir=fs.readFileSync(new URL("../scripts/apps/item-directory-view.js",import.meta.url),"utf8");
  assert.match(dir,/sortMode = "manual"/);
  assert.match(dir,/preview\?\.update/);
  const panels=fs.readFileSync(new URL("../scripts/apps/item-folder-panels.js",import.meta.url),"utf8");
  assert.match(panels,/DirectoryReorderPreview/);
});
