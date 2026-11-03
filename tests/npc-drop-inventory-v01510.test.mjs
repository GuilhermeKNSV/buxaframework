import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { npcDropTargetAt, handleNpcPointerDrop, addNpcDropItem, sourceNpcDropItem } from '../scripts/apps/npc-drop-editor.js';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const item=(id)=>({id,documentName:'Item',name:`Treasure ${id}`,toObject(){return {name:this.name,img:'gem.webp',type:'loot',system:{quantity:1},_id:id};}});
const originalGame=()=>({user:{isGM:true},settings:{get:()=>({npc:{dropping:{defaultSlots:3}}})},items:{get(){return null;}}});
function npc(items=[]){
  let drops=[];
  const actor={type:'npc',isOwner:true,items:{get:id=>items.find(it=>it.id===id)},getFlag:(_ns,key)=>key==='npc.dropTable'?drops:null,
    async update(changes){await Promise.resolve();drops=structuredClone(changes['flags.buxaframework.npc.dropTable']);}};
  return actor;
}
function fakeGrid({hidden=false,occluded=false}={}) {
  const rect={left:10,top:20,right:210,bottom:120,width:200,height:100};
  const zone={dataset:{},closest(sel){return hidden&&sel==='[hidden]'?{}:null;},getBoundingClientRect:()=>rect,
    contains(el){return el===zone||el===cell;},querySelectorAll:()=>[cell]};
  const cell={dataset:{npcDropCell:'0'},closest:sel=>sel==='[data-npc-drop-cell]'?cell:null};
  zone.ownerDocument={elementFromPoint:()=>occluded?{}:cell};
  return {root:{querySelector:()=>zone},zone,cell};
}
test('Drop renders inside Inventory underneath ordinary slots, not as another tab',()=>{
  const hbs=read('../templates/player-sheet.hbs');
  const bag=hbs.indexOf('class="buxa-inventory-section buxa-bag-section"');
  const drop=hbs.indexOf('class="buxa-npc-drop-page"');
  const inventory=hbs.indexOf('class="buxa-inventory-page"');
  assert.ok(inventory>=0&&bag>inventory&&drop>bag);
  assert.match(hbs,/data-npc-drop-section/);
  assert.doesNotMatch(hbs,/data-sheet-panel="drop"|data-sheet-tab="drop"/);
  assert.match(read('../scripts/apps/player-sheet.js'),/state\?\.activeTab === 'drop'\) this\._activeTab='inventory'/);
});
test('pointer hit testing identifies Drop cell zero, ignores hidden and obstructed grids',()=>{
  const {root}=fakeGrid();
  assert.equal(npcDropTargetAt(root,30,30),0);
  assert.equal(npcDropTargetAt(root,9,30),null);
  assert.equal(npcDropTargetAt(root,210,30),null);
  assert.equal(npcDropTargetAt(root,30,120),null);
  assert.equal(npcDropTargetAt(root,NaN,40),null);
  assert.equal(npcDropTargetAt(fakeGrid({hidden:true}).root,30,30),null);
  assert.equal(npcDropTargetAt(fakeGrid({occluded:true}).root,30,30),null);
});
test('native Item directory, Actor UUID, local Item and Buxa MIME drag data resolve',async()=>{
  const prev=globalThis.fromUuid;
  const source=item('local');const actor=npc([source]);
  globalThis.fromUuid=async uuid=>uuid==='Actor.npc.Item.abc'?source:null;
  try {
    const transfer=payload=>({getData:type=>payload[type]??''});
    assert.equal(await sourceNpcDropItem(transfer({'application/json':JSON.stringify({type:'Item',uuid:'Actor.npc.Item.abc'})}),actor),source);
    assert.equal(await sourceNpcDropItem(transfer({'text/plain':JSON.stringify({type:'Item',id:'local'})}),actor),source);
    assert.equal(await sourceNpcDropItem(transfer({'application/x-buxa-item':'local'}),actor),source);
    assert.equal(await sourceNpcDropItem(transfer({'text/plain':'not json'}),actor),null);
    assert.equal(await sourceNpcDropItem(transfer({'application/json':JSON.stringify({type:'Actor',uuid:'Actor.npc.Item.abc'})}),actor),null);
  }finally{if(prev===undefined)delete globalThis.fromUuid;else globalThis.fromUuid=prev;}
});
test('custom inventory pointer drop routes into NPC table without moving/deleting source',async()=>{
  const before=globalThis.game;const oldFoundry=globalThis.foundry;globalThis.game=originalGame();
  globalThis.foundry={utils:{deepClone:structuredClone,randomID:()=>`random${Math.random().toString(36).slice(2,12)}`}};
  try {
    const treasure=item('stone'),actor=npc([treasure]),sheet={actor};let dispatched;
    const queue=fn=>{dispatched=fn;return fn();};
    assert.equal(handleNpcPointerDrop(sheet,fakeGrid().root,'stone',30,30,queue),true);
    // Wait for the queued NPC flag update.
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(actor.getFlag(null,'npc.dropTable').length,1);
    assert.equal(actor.getFlag(null,'npc.dropTable')[0].data.name,'Treasure stone');
    assert.equal(actor.items.get('stone'),treasure,'loot-table assignment must not remove the real item');
    assert.equal(handleNpcPointerDrop(sheet,fakeGrid().root,'stone',300,300,queue),false);
    assert.equal(handleNpcPointerDrop(sheet,fakeGrid().root,'unknown',30,30,queue),false);
    assert.equal(typeof dispatched,'function');
  }finally{globalThis.game=before;globalThis.foundry=oldFoundry;}
});
test('concurrent native drops serialize, preserve order, and enforce capacity without overwriting entries',async()=>{
  const before=globalThis.game;const priorFoundry=globalThis.foundry;
  globalThis.game=originalGame();let n=0;globalThis.foundry={utils:{deepClone:structuredClone,randomID:()=>`generated${++n}`}};
  try {
    const actor=npc();
    const [a,b]=await Promise.all([addNpcDropItem(actor,item('a')),
      addNpcDropItem(actor,item('b'),{index:0})]);
    assert.equal(a,true);assert.equal(b,true);
    assert.deepEqual(actor.getFlag(null,'npc.dropTable').map(x=>x.data.name),['Treasure b','Treasure a']);
    assert.equal(await addNpcDropItem(actor,item('c')),true);
    assert.equal(await addNpcDropItem(actor,item('d')),false);
    assert.equal(actor.getFlag(null,'npc.dropTable').length,3);
    assert.equal(actor.getFlag(null,'npc.dropTable')[0].data._id,undefined);
  }finally{globalThis.game=before;globalThis.foundry=priorFoundry;}
});
test('GM/owner permissions prevent NPC table mutation',async()=>{
  const before=globalThis.game;globalThis.game=originalGame();
  try {
    const actor=npc();
    actor.isOwner=false;
    assert.equal(await addNpcDropItem(actor,item('a')),false);
    assert.equal(handleNpcPointerDrop({actor},fakeGrid().root,'a',30,30,()=>{}),false);
    actor.isOwner=true;globalThis.game.user.isGM=false;
    assert.equal(await addNpcDropItem(actor,item('b')),false);
    assert.equal(actor.getFlag(null,'npc.dropTable').length,0);
  }finally{globalThis.game=before;}
});
test('native drop handler consumes world Item drag and saves it to NPC Drop exactly once',async()=>{
  const prevGame=globalThis.game,prevFoundry=globalThis.foundry,prevUuid=globalThis.fromUuid;
  const treasure=item('worldgem');
  globalThis.game=originalGame();
  globalThis.foundry={utils:{deepClone:structuredClone,randomID:()=> 'nativeGem001'}};
  globalThis.fromUuid=async key=>key==='Item.worldgem'?treasure:null;
  try {
    const actor=npc();
    const handlers={};const classes=new Set();
    const zone={querySelectorAll:()=>[],addEventListener:(name,fn)=>{handlers[name]=fn;},classList:{add:k=>classes.add(k),remove:k=>classes.delete(k)}};
    const sheet={actor,element:{querySelector:()=>zone}};
    const {bindNpcDropEditor}=await import('../scripts/apps/npc-drop-editor.js');
    bindNpcDropEditor(sheet);
    assert.equal(typeof handlers.drop,'function');
    const payload={getData:key=>key==='text/plain'?JSON.stringify({type:'Item',uuid:'Item.worldgem'}):''};
    let prevented=0,stopped=0;
    handlers.dragover({preventDefault(){prevented++;},stopPropagation(){},dataTransfer:payload});
    assert.equal(classes.has('is-npc-drag-over'),true);
    await handlers.drop({preventDefault(){prevented++;},stopImmediatePropagation(){stopped++;},dataTransfer:payload,target:{closest:()=>({dataset:{npcDropCell:'0'}})}});
    assert.equal(prevented,2);assert.equal(stopped,1);
    assert.equal(actor.getFlag(null,'npc.dropTable').length,1);
    assert.equal(actor.getFlag(null,'npc.dropTable')[0].data.name,treasure.name);
    assert.equal(classes.has('is-npc-drag-over'),false);
  }finally{globalThis.game=prevGame;globalThis.foundry=prevFoundry;globalThis.fromUuid=prevUuid;}
});
