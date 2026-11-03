import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_SHEET_CONFIG } from '../scripts/core/constants.js';
import { defaultHotbarState } from '../scripts/core/hotbar-state.js';
import { buildHotbarAttributeTray, hotbarAttributeDrawerColor, hotbarAttributeRarityColor } from '../scripts/apps/hotbar-attributes.js';

class FakeNode {
  constructor(tag) {
    this.tag=tag; this.children=[];this.dataset={};this.attributes={};this.styleMap={};
    this.style={setProperty:(k,v)=>{this.styleMap[k]=v;}};
    this.className='';this.textContent='';
  }
  append(...children){this.children.push(...children);}
  setAttribute(key,value){this.attributes[key]=value;}
  get childElementCount(){return this.children.length;}
  querySelectorAll(selector){
    const result=[];
    const walk=n=>{for(const child of n.children){
      if(selector.startsWith('.') && child.className?.split(' ').includes(selector.slice(1)))result.push(child);
      if(selector==='[data-hb-attribute]' && child.dataset.hbAttribute)result.push(child);
      walk(child);
    }};
    walk(this);return result;
  }
}
const doc={createElement:tag=>new FakeNode(tag)};
const cfg=structuredClone(DEFAULT_SHEET_CONFIG);
cfg.attributes.entries=[
  {id:'str',label:'Strength',ability:'str',rebirth:{enabled:true,maxPoints:100,gainDieEveryRebirths:1},modifier:{enabled:true,everyPoints:10}},
  {id:'agi',label:'Agility',ability:'dex',rebirth:{enabled:false},modifier:{enabled:true,everyPoints:10}}
];
cfg.rebirthStyles=[{color:'#aabbcc',decoration:'I'},{color:'#55b86a',decoration:'II'},{color:'#5c65ee',decoration:'III'}];

globalThis.foundry={utils:{deepClone:structuredClone,randomID:()=> 'id',getProperty:(o,p)=>p.split('.').reduce((v,k)=>v?.[k],o)}};
const actor={id:'npc',uuid:'Actor.npc',isOwner:true,name:'NPC',items:[],system:{abilities:{str:{value:0},dex:{value:0}}},
  getFlag:(_mod,key)=>({'attributes.str.progress':200,'attributes.str.rebirths':2})[key]};

test('attribute squares use configured rarity colors and neutral for non-rebirth attributes',()=>{
  assert.equal(hotbarAttributeRarityColor(cfg.attributes.entries[0],2,cfg),'#55b86a');
  assert.equal(hotbarAttributeRarityColor(cfg.attributes.entries[0],3,cfg),'#5c65ee');
  assert.equal(hotbarAttributeRarityColor(cfg.attributes.entries[1],0,cfg),'#aabbcc');
  assert.equal(hotbarAttributeRarityColor(cfg.attributes.entries[0],2,{...cfg,rebirthStyles:[{color:'#not-a-color'}]}),'#8b93a1');
});

test('the tray colors each individual tile and preserves all roll metadata',()=>{
  const priorGame=globalThis.game;
  globalThis.game={user:{isGM:true},settings:{get:()=>cfg}};
  try {
    const tray=buildHotbarAttributeTray(doc,actor);
    const tiles=tray.querySelectorAll('[data-hb-attribute]');
    assert.equal(tiles.length,2);
    assert.equal(tiles[0].styleMap['--buxa-hb-attr-color'],'#55b86a');
    assert.equal(tiles[1].styleMap['--buxa-hb-attr-color'],'#aabbcc');
    assert.equal(tiles[0].dataset.hbRebirth,'2');
    assert.equal(tiles[0].attributes['aria-haspopup'],'menu');
    assert.equal(hotbarAttributeDrawerColor(actor,cfg),'#55b86a');
  } finally {globalThis.game=priorGame;}
});

test('GM SELECT lives below the slot board with tabs, not in the top tools',async()=>{
  const priorGame=globalThis.game;
  globalThis.game={user:{isGM:true},settings:{get:()=>cfg}};
  try {
    const {buildHotbarView}=await import('../scripts/apps/hotbar-view.js');
    const view=buildHotbarView(doc,defaultHotbarState(),actor,{isGM:true});
    const lower=view.querySelectorAll('.buxa-hb-lower-rail');
    assert.equal(lower.length,1);
    const select=lower[0].querySelectorAll('.buxa-hb-select');
    assert.equal(select.length,1);
    assert.equal(select[0].dataset.hbAction,'select');
    assert.equal(view.querySelectorAll('.buxa-hb-tools')[0].querySelectorAll('.buxa-hb-select').length,0);
    assert.equal(view.querySelectorAll('.buxa-hb-attribute-drawer')[0].styleMap['--buxa-hb-drawer-color'],undefined, 'rebirth rarity must not tint the drawer arrow');
    const player=buildHotbarView(doc,defaultHotbarState(),actor,{isGM:false});
    assert.equal(player.querySelectorAll('.buxa-hb-select').length,0);
  } finally {globalThis.game=priorGame;}
});

test('bottom selection and rarity UI preserve the same interaction hooks and color-based hover',()=>{
  const css=readFileSync(new URL('../styles/163-hotbar.css',import.meta.url),'utf8');
  assert.match(css,/\.buxa-hb-lower-rail \.buxa-hb-select\s*\{/);
  assert.match(css,/\.buxa-hb-attribute:hover,[\s\S]*?var\(--buxa-hb-attr-color\)/);
  assert.match(css,/\.buxa-hb-attribute-toggle\[aria-expanded='true'\]/);
  assert.match(css,/@media \(prefers-reduced-motion:reduce\)/);
});
