import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
globalThis.CONST ??= {};
globalThis.foundry ??= {
  applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: Base => Base },
    apps: { FilePicker: class {} }, sheets: { ItemSheetV2: class {} } },
  utils: { deepClone: structuredClone, randomID: () => 'id' }
};
const { BuxaHotbar } = await import('../scripts/apps/hotbar.js');

class Element {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.classList = { add() {} };
    this.style = { setProperty() {} };
    this.textContent = '';
  }
  setAttribute(key, value) { this.attributes[key] = value; }
  append(...items) { this.children.push(...items); }
}
const doc = { createElement: tag => new Element(tag), createElementNS: (_ns, tag) => new Element(tag) };

test('resource names are etched on an SVG arc with no boxed caption', async () => {
  const { buildHotbarView } = await import('../scripts/apps/hotbar-view.js');
  const { DEFAULT_SHEET_CONFIG } = await import('../scripts/core/constants.js');
  const { defaultHotbarState } = await import('../scripts/core/hotbar-state.js');
  const oldGame = globalThis.game;
  const cfg = structuredClone(DEFAULT_SHEET_CONFIG);
  cfg.resources = [{id:'health',label:'Health',color:'#e13b50',start:25,max:100}, {id:'mana',label:'Mana',color:'#487bff',start:30,max:50}];
  globalThis.game = { settings: { get: () => cfg }, user:{isGM:false} };
  try {
    const view = buildHotbarView(doc,defaultHotbarState(),null,{isGM:false});
    const svg = [];
    function walk(node) { if (node.tag === 'svg') svg.push(node); for (const child of node.children) walk(child); }
    walk(view);
    assert.equal(svg.length,2);
    const labels = svg.map(node => node.children.at(-1).children.at(-1).textContent);
    assert.deepEqual(labels,['HP','MP']);
    assert.deepEqual(svg.map(node => node.children[0].children[0].attributes.d), ['M 17 78 Q 50 110 83 78','M 17 78 Q 50 110 83 78']);
  } finally { globalThis.game = oldGame; }
});

test('tab switching plays exit to the left and saves only after it finishes', async () => {
  const hotbar = new BuxaHotbar({defaultView:{matchMedia:()=>({matches:false})}});
  const state = {tabs:[{id:'a'},{id:'b'},{id:'c'}],activeTab:'a'};
  Object.defineProperty(hotbar,'state',{ get:()=>state });
  let complete, keyframes, saved = 0;
  hotbar.root = {querySelector:() => ({animate(frames,opts) {
    keyframes = frames;
    assert.equal(opts.duration,155);
    return {finished:new Promise(resolve=>{complete=resolve;})};
  }})};
  hotbar.update = async patch => {state.activeTab=patch.activeTab;saved++;};
  const running = hotbar.changeTab('c');
  assert.equal(hotbar.tabSwitching,true);
  assert.equal(saved,0);
  assert.equal(await hotbar.changeTab('b'),false, 'rapid second switch must not race');
  assert.equal(keyframes[1].transform,'translateX(-26px)');
  complete();
  assert.equal(await running,true);
  assert.equal(saved,1);
  assert.equal(state.activeTab,'c');
  assert.equal(hotbar.tabEntranceDirection,1);
  assert.equal(hotbar.tabEntranceTarget,'c');
  assert.equal(hotbar.tabSwitching,false);
  assert.equal(await hotbar.changeTab('c'),false);
});

test('tab switching works instantly with reduced motion and reverses travel on prior tabs', async () => {
  const hotbar = new BuxaHotbar({defaultView:{matchMedia:()=>({matches:true})}});
  const state = {tabs:[{id:'a'},{id:'b'}],activeTab:'b'};
  Object.defineProperty(hotbar,'state',{get:()=>state});
  let played = 0;
  hotbar.root = {querySelector:()=>({animate(){played++;throw new Error('Should respect reduced motion');}})};
  hotbar.update = async patch => {state.activeTab=patch.activeTab;};
  assert.equal(await hotbar.changeTab('a'),true);
  assert.equal(played,0);
  assert.equal(hotbar.tabEntranceDirection,-1);
  assert.equal(hotbar.tabEntranceTarget,'a');
});

test('arrow remains gold, tabs have square corners, and slot transitions have both directions', () => {
  const css = readFileSync(new URL('../styles/163-hotbar.css',import.meta.url),'utf8');
  const view = readFileSync(new URL('../scripts/apps/hotbar-view.js',import.meta.url),'utf8');
  assert.doesNotMatch(view,/drawer\.style\.setProperty\('--buxa-hb-drawer-color'/);
  assert.doesNotMatch(css,/var\(--buxa-hb-drawer-color/);
  assert.match(css,/\.buxa-hb-attribute-toggle\[aria-expanded='true'\]\s*\{[^}]*border-top-color:#a59a7e/);
  assert.match(css,/\.buxa-hb-tab\s*\{\s*border-radius:0;/);
  assert.match(css,/@keyframes buxa-hb-tab-enter-next/);
  assert.match(css,/@keyframes buxa-hb-tab-enter-previous/);
  assert.match(css,/\.buxa-hb-orb-inscription text/);
});
