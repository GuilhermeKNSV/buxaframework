import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_SHEET_CONFIG, MODULE_ID } from '../scripts/core/constants.js';
import { findAutoEquipDestination, autoEquipInventoryItem } from '../scripts/core/equipment-auto-equip.js';
import { getInventoryState } from '../scripts/core/inventory.js';
import { isEquipmentGhostRegion, equipmentGhostCellSize, setEquipmentGhostMode } from '../scripts/apps/equipment-drag-preview.js';

const get=(o,p)=>String(p).split('.').reduce((obj,key)=>obj?.[key],o);
const set=(o,p,value)=>{const keys=p.split('.');let node=o;for(const key of keys.slice(0,-1))node=node[key]??={};node[keys.at(-1)]=value;};
function setup({filled=false, backpack=false, capacity=1}={}) {
  const originals=Object.fromEntries(['game','foundry','Hooks'].map(key=>[key,globalThis[key]]));
  const cfg=structuredClone(DEFAULT_SHEET_CONFIG);
  cfg.inventory.mode='complex';cfg.inventory.complex={columns:7,rows:5,autoSort:false,activeCells:35};cfg.resources=[];
  cfg.inventory.equipmentLayout.slots=[
    {id:'weapon-1',type:'weapon',label:'Weapon',capacity,tabId:'main',x:1,y:1,size:'long'},
    {id:'backpack-1',type:'backpack',label:'Backpack',capacity:1,tabId:'main',x:3,y:1,size:'large'},
    {id:'hidden',type:'weapon',label:'Hidden',capacity:1,tabId:'main',x:6,y:1,size:'small',hidden:true}
  ];
  const rules={equip:{enabled:true,any:backpack,allowedTypes:backpack?['backpack']:['weapon']},
    ...(backpack?{storage:{slots:{external:[{id:'pouch',columns:3,rows:3,mode:'simple'}]}}}:{})};
  const item={id:'moving',name:backpack?'Backpack':'Sword',system:{quantity:1,equipped:false},flags:{[MODULE_ID]:{item:rules}},
    getFlag(ns,k){return get(this.flags?.[ns],k)}};
  const equipped={id:'occupant',name:'Already equipped',system:{quantity:1,equipped:true},flags:{[MODULE_ID]:{item:{}}},getFlag(ns,k){return get(this.flags?.[ns],k)}};
  const items=new Map([['moving',item],['occupant',equipped]]);
  items[Symbol.iterator]=function*(){yield* this.values();};
  const state={version:4,tracked:filled?['moving','occupant']:['moving'],autoSort:false,
    placements:{moving:{area:'inventory',index:0,rotation:0},...(filled?{occupant:{area:'equipment',slotId:'weapon-1',position:0}}:{})},
    equipmentActive:{'weapon-1':0,'backpack-1':0}};
  const actor={id:'actor',isOwner:true,items,flags:{[MODULE_ID]:{inventory:state}},
    getFlag(ns,key){return get(this.flags[ns],key)},async update(patch){for(const [k,v] of Object.entries(patch))set(this,k,v);return this;}};
  globalThis.game={system:{id:'custom'},settings:{get(){return cfg;}}};
  globalThis.foundry={utils:{deepClone:structuredClone,equals:(a,b)=>JSON.stringify(a)===JSON.stringify(b),getProperty:get,setProperty:set}};
  globalThis.Hooks={callAll(){}};
  return {cfg,item,actor,restore(){for(const [key,val] of Object.entries(originals)){if(val===undefined)delete globalThis[key];else globalThis[key]=val;}}};
}

test('auto EQUIP prefers the empty active compatible slot and preserves inventory item identity',async()=>{
  const f=setup();try {
    assert.deepEqual(findAutoEquipDestination(f.actor,f.item,f.cfg),{area:'equipment',slotId:'weapon-1',position:0,activate:false});
    await autoEquipInventoryItem(f.actor,f.item,f.cfg);
    assert.deepEqual(getInventoryState(f.actor,f.cfg).placements.moving,{area:'equipment',slotId:'weapon-1',position:0});
    assert.equal(f.actor.items.get('moving'),f.item);
  }finally{f.restore();}
});
test('EQUIP never swaps a full slot or equips into hidden slots',async()=>{
  const f=setup({filled:true});try {
    assert.equal(findAutoEquipDestination(f.actor,f.item,f.cfg),null);
    assert.equal(await autoEquipInventoryItem(f.actor,f.item,f.cfg),null);
    assert.deepEqual(getInventoryState(f.actor,f.cfg).placements.moving,{area:'inventory',index:0});
    assert.deepEqual(getInventoryState(f.actor,f.cfg).placements.occupant,{area:'equipment',slotId:'weapon-1',position:0});
  }finally{f.restore();}
});
test('EQUIP uses and activates a free alternative loadout position without displacing',async()=>{
  const f=setup({filled:true,capacity:2});try {
    assert.deepEqual(findAutoEquipDestination(f.actor,f.item,f.cfg),{area:'equipment',slotId:'weapon-1',position:1,activate:true});
    await autoEquipInventoryItem(f.actor,f.item,f.cfg);
    const state=getInventoryState(f.actor,f.cfg);
    assert.equal(state.placements.moving.position,1);
    assert.equal(state.placements.occupant.position,0);
    assert.equal(state.equipmentActive['weapon-1'],1);
  }finally{f.restore();}
});
test('EQUIP prefers the backpack slot for a bag even if another empty slot comes first',async()=>{
  const f=setup({backpack:true});try {
    assert.equal(findAutoEquipDestination(f.actor,f.item,f.cfg)?.slotId,'backpack-1');
    await autoEquipInventoryItem(f.actor,f.item,f.cfg);
    assert.equal(getInventoryState(f.actor,f.cfg).placements.moving.slotId,'backpack-1');
  }finally{f.restore();}
});
test('equipped item is not offered EQUIP twice',async()=>{
  const f=setup();try {await autoEquipInventoryItem(f.actor,f.item,f.cfg);assert.equal(findAutoEquipDestination(f.actor,f.item,f.cfg),null);}finally{f.restore();}
});

test('drag ghost switches compact over equipment and restores masked shape when leaving',()=>{
  const handlers={};const classes=new Set(['is-complex-ghost','is-rectangular-shape']);
  const ghost={style:{},classList:{contains:k=>classes.has(k),add:k=>classes.add(k),remove:(...keys)=>keys.forEach(k=>classes.delete(k))},
    ownerDocument:{createElement:tag=>({tag,src:'',alt:'',draggable:false})},children:[],
    append(node){this.children.push(node)},replaceChildren(...nodes){this.children=[...nodes]}};
  assert.equal(isEquipmentGhostRegion({closest(){return {}}},null),true);
  assert.equal(isEquipmentGhostRegion({closest(){return null}},{area:'inventory'}),false);
  assert.equal(equipmentGhostCellSize({querySelector(){return {getBoundingClientRect(){return {width:56,height:60}}}}}),56);
  const compact=setEquipmentGhostMode(ghost,{compact:true,image:'axe.webp',cellSize:56});
  assert.deepEqual(compact,{offsetX:28,offsetY:28});
  assert.equal(classes.has('is-equipment-ghost'),true);
  assert.equal(classes.has('is-complex-ghost'),false);
  assert.equal(ghost.children[0].src,'axe.webp');
  assert.equal(ghost.style.width,'56px');
  assert.equal(setEquipmentGhostMode(ghost,{compact:true}),null,'do not rebuild every pointermove');
  const restored=setEquipmentGhostMode(ghost,{compact:false,restoreShape:()=>{
    classes.add('is-complex-ghost');ghost.style.width='174px';return {offsetX:87,offsetY:29};
  }});
  assert.deepEqual(restored,{offsetX:87,offsetY:29});
  assert.equal(classes.has('is-equipment-ghost'),false);
  assert.equal(classes.has('is-complex-ghost'),true);
  assert.equal(ghost.style.width,'174px');
});
test('right-click menu wires EQUIP and preserves existing UNEQUIP and red DROP',()=>{
  const source=readFileSync(new URL('../scripts/apps/item-context-menu.js',import.meta.url),'utf8');
  assert.match(source,/button\.dataset\.action\s*=\s*"equip"/);
  assert.match(source,/data-action='equip'/);
  assert.match(source,/button\.dataset\.action\s*=\s*"unequip"/);
  assert.match(source,/dropButton\.classList\.add\("buxa-item-context-danger"\)/);
});
