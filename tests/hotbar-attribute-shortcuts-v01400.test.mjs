import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_SHEET_CONFIG } from '../scripts/core/constants.js';
import { defaultHotbarState, assignHotbarSlot, hotbarItemLocations, removeHotbarItem, hotbarSlots } from '../scripts/core/hotbar-state.js';
import { hotbarAttributeAbbreviation, buildHotbarAttributeTray } from '../scripts/apps/hotbar-attributes.js';

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const owner = 'Actor.hero';

test('hotbar presence searches all tabs and retained hidden rows, removal never modifies inventory', () => {
  let state = defaultHotbarState();
  state.rows = 2;
  state = assignHotbarSlot(state, owner, 'tab-1', 14, 'sword');
  state = assignHotbarSlot(state, owner, 'tab-2', 3, 'sword');
  state = assignHotbarSlot(state, owner, 'tab-3', 0, 'potion');
  state.rows = 1;
  const actorItem = {id:'sword', system:{quantity:1}};
  const oldItem = structuredClone(actorItem);
  assert.deepEqual(hotbarItemLocations(state,owner,'sword'),[
    {tabId:'tab-1',index:14},{tabId:'tab-2',index:3}
  ]);
  const next = removeHotbarItem(state,owner,'sword');
  assert.equal(next.bindings[owner]['tab-1'][14],null);
  assert.equal(hotbarSlots(next,owner,'tab-2')[3],null);
  assert.equal(hotbarSlots(next,owner,'tab-3')[0],'potion');
  assert.equal(hotbarSlots(state,owner,'tab-2')[3],'sword');
  assert.deepEqual(actorItem,oldItem);
  assert.equal(removeHotbarItem(next,owner,'sword'),null);
  assert.deepEqual(hotbarItemLocations(next,'Actor.other','potion'),[]);
});

test('lock prevents removing shortcuts from any tab', () => {
  let state = assignHotbarSlot(defaultHotbarState(),owner,'tab-1',0,'blade');
  state.locked = true;
  assert.equal(removeHotbarItem(state,owner,'blade'),null);
  assert.equal(hotbarSlots(state,owner)[0],'blade');
});

test('only one Add or Remove shortcut option appears by item presence, hotbar never offers Drop/Unequip', () => {
  const menuSource = source('scripts/apps/item-context-menu.js');
  assert.match(menuSource, /const alreadyInHotbar = hotbarContext \|\| game\.buxaframework\?\.hasItemOnHotbar/);
  assert.match(menuSource, /if \(alreadyInHotbar\)\s*\{[\s\S]*?REMOVE SHORTCUT[\s\S]*?\}\s*else if \(game\.buxaframework\?\.addItemToHotbar\)/);
  assert.match(menuSource,/if \(!hotbarContext && placement\?\.area === "equipment"\)/);
  assert.match(menuSource,/if \(!hotbarContext\) \{\s*const dropButton/);
  assert.match(menuSource,/if \(!hotbarContext && placement\?\.area !== "equipment"/);
  const actionsSource = source('scripts/apps/hotbar-item-actions.js');
  assert.match(actionsSource,/hotbarContext: true/);
  assert.match(actionsSource,/hotbarLocked: locked/);
});

test('short labels show abbreviations; single-word and multiword labels stay legible', () => {
  assert.equal(hotbarAttributeAbbreviation('Strength'),'STR');
  assert.equal(hotbarAttributeAbbreviation('Mental Focus'),'MF');
  assert.equal(hotbarAttributeAbbreviation('Dexterity'),'DEX');
  assert.equal(hotbarAttributeAbbreviation(''),'?' );
});

class FakeNode {
  constructor(tag) { this.tag=tag; this.children=[]; this.dataset={}; this.attributes={}; this.style={setProperty(){}}; this.className=''; this.textContent=''; this.disabled=false; }
  append(...kids){this.children.push(...kids);}
  setAttribute(key,val){this.attributes[key]=val;}
  get childElementCount(){return this.children.length;}
  querySelectorAll(selector){const found=[];function visit(node){for(const child of node.children){if(selector==='[data-hb-attribute]' && child.dataset.hbAttribute) found.push(child);visit(child);}}visit(this);return found;}
}

test('open tray renders actual attribute tiles with tooltip, modifier and dice count; no large names', () => {
  const config = structuredClone(DEFAULT_SHEET_CONFIG);
  config.attributes.entries = [{id:'str',label:'Strength',ability:'str',rebirth:{enabled:false},modifier:{enabled:true,everyPoints:2}},
    {id:'dex',label:'Dexterity',ability:'dex',rebirth:{enabled:false},modifier:{enabled:true,everyPoints:2}}];
  const priorGame=globalThis.game, priorFoundry=globalThis.foundry;
  globalThis.foundry={utils:{deepClone:structuredClone,randomID:()=> 'id',getProperty:(o,p)=>p.split('.').reduce((v,k)=>v?.[k],o)}};
  globalThis.game={settings:{get:()=>config},user:{id:'gm',isGM:true}};
  const actor={id:'hero',isOwner:true,items:[],system:{abilities:{str:{value:10},dex:{value:8}}},getFlag:()=>undefined};
  try {
    const tray=buildHotbarAttributeTray({createElement:tag=>new FakeNode(tag)},actor);
    const tiles=tray.querySelectorAll('[data-hb-attribute]');
    assert.equal(tiles.length,2);
    assert.deepEqual(tiles.map(t=>t.children[0].textContent),['STR','DEX']);
    assert.ok(tiles[0].title.includes('Strength'));
    assert.match(tiles[0].children[1].textContent,/^[+−\-\d]/);
    assert.equal(tiles[0].children[2].textContent,'1d20');
    assert.equal(tiles[0].attributes['aria-haspopup'],'menu');
  } finally {globalThis.game=priorGame;globalThis.foundry=priorFoundry;}
});

test('toggle in hotbar is independently collapsible and right click has Advantage/Disadvantage',()=>{
  const view=source('scripts/apps/hotbar-view.js');
  const ctl=source('scripts/apps/hotbar.js');
  const rolls=source('scripts/apps/hotbar-attributes.js');
  assert.match(view,/data-hb-action|control\(doc, attributesOpen/);
  assert.match(ctl,/this\.attributesOpen = !this\.attributesOpen/);
  assert.match(rolls,/\['advantage','Advantage'/);
  assert.match(rolls,/\['disadvantage','Disadvantage'/);
  assert.match(rolls,/rollAttribute\(\{ actor \}, attribute, 'normal'\)/);
  assert.match(rolls,/rollAttribute\(\{ actor \}, attribute, mode\)/);
});

test('real item menus show Add or Remove exclusively; hotbar removes physical Drop action', async () => {
  const { createItemContextMenu } = await import('../scripts/apps/item-context-menu.js');
  const priorGame = globalThis.game, priorFoundry = globalThis.foundry;
  const cfg = structuredClone(DEFAULT_SHEET_CONFIG); cfg.inventory.mode = 'simple';
  class MenuNode {
    constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.className='';this.style={};this.classList={add(){}};}
    append(...nodes){this.children.push(...nodes);}
    setAttribute(){}
  }
  const doc={createElement:tag=>new MenuNode(tag)};
  const actor={id:'hero',uuid:'Actor.hero',isOwner:true,type:'character',items:[],getFlag:()=>undefined};
  const item={id:'sword',name:'Sword',type:'loot',parent:actor,system:{quantity:1},getFlag:()=>undefined};
  actor.items.push(item);
  let present=false;
  globalThis.foundry={utils:{deepClone:structuredClone,getProperty:(o,p)=>p.split('.').reduce((v,k)=>v?.[k],o),randomID:()=> 'id'}};
  globalThis.game={user:{isGM:true},settings:{get:()=>cfg},buxaframework:{
    hasItemOnHotbar:()=>present,addItemToHotbar:()=>true,removeItemFromHotbar:()=>true
  }};
  const actions = (context=false) => {
    const menu=createItemContextMenu({actor,element:{ownerDocument:doc}},item,{hotbarContext:context});
    const result=[];
    const traverse=node=>{if(node.dataset.action)result.push(node.dataset.action);for(const child of node.children)traverse(child);};
    traverse(menu);return result;
  };
  try {
    assert.deepEqual(actions().filter(a=>a.includes('hotbar')),['add-hotbar']);
    present=true;
    assert.deepEqual(actions().filter(a=>a.includes('hotbar') || a.includes('shortcut')), ['remove-hotbar']);
    assert.equal(actions().includes('drop'),true,'normal inventory keeps its drop action');
    const hotbarMenu=actions(true);
    assert.equal(hotbarMenu.includes('drop'),false);
    assert.equal(hotbarMenu.includes('unequip'),false);
    assert.equal(hotbarMenu.includes('equip'),false);
    assert.deepEqual(hotbarMenu.filter(a=>a.includes('hotbar') || a.includes('shortcut')), ['remove-hotbar']);
  } finally { globalThis.game=priorGame;globalThis.foundry=priorFoundry; }
});
