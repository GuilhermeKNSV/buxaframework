import test from "node:test";
import assert from "node:assert/strict";
import { getMainFolder, ensureMainFolder, isMainFolder, sortMainFirst, installMainFolderHooks } from "../scripts/apps/directory-main-folder.js";
import { directoryListHTML } from "../scripts/apps/item-directory-tree.js";
import { genericCardData, renderGenericCard, genericTreeHTML, moveWorldDocument } from "../scripts/apps/world-directory-shared.js";

const all = [];
const hooks = new Map();
globalThis.Hooks = {
  on(name, fn) { hooks.set(name, fn); },
  once(name, fn) { hooks.set(name, fn); }
};
globalThis.game = {
  folders: { contents:all, get:id=>all.find(f=>f.id===id) },
  items: { contents:[] },
  actors: { contents:[] },
  scenes: { contents:[] },
  user: { isGM:true, isActiveGM:true }
};
let counter = 0;
globalThis.Folder = {
  async create(data) {
    const folder = { ...data, id:`F${++counter}`, folder:data.folder ?? null };
    all.push(folder);
    return folder;
  }
};

test("one persistent Main folder per type; no duplicates during concurrent requests", async () => {
  const [a1,a2] = await Promise.all([ensureMainFolder("Actor"),ensureMainFolder("Actor")]);
  assert.equal(a1.id,a2.id);
  const scene = await ensureMainFolder("Scene");
  const item = await ensureMainFolder("Item");
  assert.equal(all.length,3);
  assert.deepEqual(all.map(x=>x.type),["Actor","Scene","Item"]);
  for (const doc of [scene,item,a1]) {
    assert.equal(doc.name,"Main");
    assert.equal(doc.flags.buxaframework.directoryMain,doc.type);
    assert.equal(getMainFolder(doc.type),doc);
    assert.equal(isMainFolder(doc),true);
  }
  assert.equal(await ensureMainFolder("Actor"),a1);
  assert.equal(getMainFolder("JournalEntry"),null);
});

test("an existing root Main is reused, without moving existing documents", async () => {
  const prev = {id:"OLD", name:"Main",type:"Scene",folder:null};
  all.splice(all.findIndex(f=>f.type==="Scene"),1,prev);
  assert.equal(await ensureMainFolder("Scene"),prev);
  assert.equal(all.length,3);
});

test("Main sorts first even before alphabetically earlier folders", () => {
  const first = all.find(f=>f.type==="Actor");
  const folders = [{ id:"a", name:"AAA", type:"Actor", folder:null },first,{ id:"z",name:"ZZZ",type:"Actor",folder:null }];
  assert.equal([...folders].sort(sortMainFirst)[0].id,first.id);
  const html = genericTreeHTML({type:"Actor",folders,docs:[],expanded:new Set()});
  assert.ok(html.indexOf("Main")<html.indexOf("AAA"));
  const itemMain = all.find(f=>f.type==="Item");
  const old = directoryListHTML({folders:[{id:"a",name:"AAA",folder:null},itemMain],items:[],rarities:[]});
  assert.ok(old.indexOf("Main")<old.indexOf("AAA"));
});

test("native creation is routed to the correct Main and embedded actor Items are untouched", () => {
  installMainFolderHooks();
  for (const type of ["Item","Actor","Scene"]) {
    const doc = { type, updateSource(data) { this.changed=data; } };
    hooks.get(`preCreate${type}`)(doc,{});
    assert.equal(doc.changed.folder,getMainFolder(type).id);
    const already = { type, updateSource() { throw Error("must not be touched"); } };
    hooks.get(`preCreate${type}`)(already,{folder:"CUSTOM"});
  }
  const embedded = { parent:{id:"ACT"},updateSource(){throw Error("embedded item changed");} };
  hooks.get("preCreateItem")(embedded,{});
  const folder = { type:"Actor",updateSource(data){this.changed=data;} };
  hooks.get("preCreateFolder")(folder,{type:"Actor"});
  assert.equal(folder.changed.folder,getMainFolder("Actor").id);
  const builtin = { type:"Actor",updateSource(){throw Error("main must remain root");} };
  hooks.get("preCreateFolder")(builtin,{type:"Actor",flags:{buxaframework:{directoryMain:"Actor"}}});
});

test("Main cannot be deleted, renamed or nested, regular folders can", () => {
  const main = getMainFolder("Item");
  assert.equal(hooks.get("preDeleteFolder")(main),false);
  assert.equal(hooks.get("preUpdateFolder")(main,{name:"Rename"}),false);
  assert.equal(hooks.get("preUpdateFolder")(main,{folder:"other"}),false);
  assert.equal(hooks.get("preUpdateFolder")(main,{color:"#bada55"}),undefined);
  assert.equal(hooks.get("preDeleteFolder")({name:"Other",type:"Item",folder:main.id}),undefined);
});

test("actors and scenes use custom cards with escaped info and responsive thumbnails", () => {
  const actor = {id:"a",name:'The <Mage>',type:"npc", img:"icons/mage.webp",system:{details:{cr:5},attributes:{hp:{value:45}}}};
  const scene = {id:"s",name:"Dungeon",thumb:"scene.webp",width:2000,height:1500};
  const actorMarkup = renderGenericCard(actor,"Actor");
  assert.match(actorMarkup,/The &lt;Mage&gt;/);
  assert.match(actorMarkup,/NPC/);
  assert.match(actorMarkup,/CR 5/);
  assert.match(actorMarkup,/HP 45/);
  assert.match(actorMarkup,/icons\/mage.webp/);
  assert.match(renderGenericCard(scene,"Scene"),/2000×1500/);
  assert.equal(genericCardData(scene,"Scene").image,"scene.webp");
});

test("nested folders, searching and folder left mode reuse the Buxa directory layout", () => {
  const folders=[{id:"main",name:"Main",type:"Actor",folder:null}, {id:"nest",name:"NPCs",type:"Actor",folder:"main"}];
  const docs=[{id:"a",name:"Goblin",type:"npc",folder:"nest"}];
  assert.match(genericTreeHTML({type:"Actor",docs,folders,expanded:new Set(["main","nest"])}),/Goblin/);
  const collapsed=genericTreeHTML({type:"Actor",docs,folders,left:true,expanded:new Set(["main","nest"])});
  assert.doesNotMatch(collapsed,/Goblin/);
  assert.match(genericTreeHTML({type:"Actor",docs,folders,query:"goblin"}),/Goblin/);
});

test("moving actors and scenes uses Foundry folder updates and integer sort", async () => {
  const changes=[];
  const a = {id:"a", name:"A",folder:"main",sort:0,async update(v){changes.push(v);this.folder=v.folder;} };
  const b = {id:"b", name:"B",folder:"nest",sort:2000};
  game.actors.contents=[a,b];
  globalThis.foundry = {utils:{performIntegerSort(source){return [{target:source,update:{sort:1000}}];}}};
  globalThis.Actor = {async updateDocuments(updates){changes.push(updates);} };
  globalThis.Scene = {async updateDocuments(updates){changes.push(updates);} };
  assert.equal(await moveWorldDocument(a,"Actor",{folderId:"nest",target:b}),true);
  assert.equal(changes[0][0].folder,"nest");
  assert.equal(await moveWorldDocument(a,"Actor",{folderId:null}),true);
  assert.deepEqual(changes[1],{folder:null});
});

test("Main is red in every directory, including already existing folders", async () => {
  const { MAIN_FOLDER_COLOR, renderFolderCard } = await import("../scripts/apps/item-directory-cards.js");
  assert.equal(MAIN_FOLDER_COLOR, "#d9434e");
  for (const type of ["Item", "Actor", "Scene"]) {
    const main = getMainFolder(type);
    main.color = "#789cbd"; // previous releases initialized Main with a blue tint
    let writes = 0;
    main.update = async (change) => { main.color = change.color; writes += 1; };
    assert.match(renderFolderCard(main, {main:true}), /--buxa-folder-accent:#d9434e/);
    assert.equal(await ensureMainFolder(type), main);
    assert.equal(main.color, MAIN_FOLDER_COLOR);
    assert.equal(writes, 1);
    await ensureMainFolder(type);
    assert.equal(writes, 1, "a red Main should not be written again");
  }
  const custom = {id:"other", name:"Custom", type:"Item", folder:null, color:"#4a72e0"};
  assert.match(renderFolderCard(custom), /--buxa-folder-accent:#4a72e0/);
});
