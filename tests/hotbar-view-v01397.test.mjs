import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SHEET_CONFIG } from '../scripts/core/constants.js';
import { defaultHotbarState, assignHotbarSlot } from '../scripts/core/hotbar-state.js';

class DomNode {
  constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.value = ''; this.className = ''; this.textContent = ''; this.styleMap = {}; this.style = { setProperty:(k,v) => this.styleMap[k] = v }; }
  append(...children) { this.children.push(...children); }
  setAttribute(k,v) { this.attributes[k] = v; }
  querySelectorAll(selector) {
    const result=[];
    const matches = node => selector.startsWith('[data-') ? node.dataset[selector.match(/^\[data-([\w-]+)/)?.[1]?.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())] !== undefined : node.className?.split(' ').includes(selector.slice(1));
    const visit = (node) => { for(const child of node.children){ if(matches(child))result.push(child); visit(child); } };
    visit(this);return result;
  }
}
globalThis.foundry = {utils:{deepClone:structuredClone,randomID:()=> 'random',hasProperty:(o,p)=>p.split('.').reduce((v,k)=>v?.[k],o)!==undefined,getProperty:(obj,path)=>path.split('.').reduce((v,k)=>v?.[k],obj)}};
const config = structuredClone(DEFAULT_SHEET_CONFIG);
const actor = { id:'abc', uuid:'Actor.abc',name:'Adventurer',isOwner:true,type:'character', documentName:'Actor',
  system:{attributes:{hp:{value:65,max:100}},resources:{primary:{value:12,max:20}}},
  items:new Map(), getFlag:()=>undefined };
const item = {id:'sword',name:'Sword',img:'icons/svg/sword.svg',system:{quantity:1},parent:actor,
  getFlag:(_id,key)=>key==='item'?{rarityId:'rare',dice:[{id:'roll',count:1,faces:20,chatRoll:true}]}:undefined};
actor.items.set('sword',item);
globalThis.game = {user:{id:'u',character:actor},actors:new Map([[actor.id,actor]]),settings:{get:()=>config},system:{id:'dnd5e'}};
const { buildHotbarView } = await import('../scripts/apps/hotbar-view.js');
const document = {createElement: tag => new DomNode(tag)};

test('real hotbar view renders all 10 slots and 3 tabs with rarity-bound artwork', () => {
  let state = defaultHotbarState();
  state = assignHotbarSlot(state, actor.uuid,'tab-1',0,'sword');
  const view = buildHotbarView(document,state,actor);
  const slots = view.querySelectorAll('[data-hb-slot]');
  assert.equal(slots.length,10);
  assert.equal(slots[0].styleMap['--buxa-hb-rarity'],'#4d98f0');
  assert.equal(slots[0].children.find(c=>c.tag==='img')?.src,'icons/svg/sword.svg');
  assert.equal(view.querySelectorAll('[data-hb-tab]').length,3);
  assert.equal(view.querySelectorAll('.buxa-hb-orb').length,2);
});

test('resource orbs display current points only when enabled and respect configured resource colors', () => {
  const state = defaultHotbarState();
  state.orbs[0].resourceId='hp';state.orbs[0].showNumber=true;
  const view = buildHotbarView(document,state,actor);
  const orbs = view.querySelectorAll('.buxa-hb-orb');
  assert.equal(orbs[0].styleMap['--buxa-hb-orb-color'],config.resources[0].color);
  assert.equal(orbs[0].styleMap['--buxa-hb-orb-fill'],'65%');
  assert.equal(orbs[0].querySelectorAll('.buxa-hb-orb-value')[0]?.textContent,'65');
  assert.equal(orbs[1].querySelectorAll('.buxa-hb-orb-value').length,0);
});


test('GM-only select control is rendered without reintroducing the Actor picker', () => {
  const gm=buildHotbarView(document,defaultHotbarState(),actor,{isGM:true});
  const player=buildHotbarView(document,defaultHotbarState(),actor,{isGM:false});
  const hasSelect = root => {
    let found=false;
    const walk=node=>{if(node.dataset?.hbAction==='select')found=true; for(const child of node.children??[])walk(child);};
    walk(root);return found;
  };
  assert.equal(hasSelect(gm),true);
  assert.equal(hasSelect(player),false);
});
