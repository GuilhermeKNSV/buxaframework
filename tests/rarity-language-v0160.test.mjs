import test from 'node:test';
import assert from 'node:assert/strict';
import { RARITY_VISUALS, resolveRarityVisual, rarityVisualPresentation, applyRarityVisual } from '../scripts/core/rarity-visuals.js';
import { rarityBeamTraces, rarityBeamMotion } from '../scripts/core/rarity-beam-geometry.js';
import { DEFAULT_ITEM_RARITIES, rarityPresentation } from '../scripts/core/item-config.js';
import { presentationTheme, neutralItemSheetLines } from '../scripts/core/item-presentation.js';
import { actorRarityContext, rebirthRarityContext } from '../scripts/core/rarity-context.js';
import { normalizeSheetConfig } from '../scripts/core/config.js';
import { DEFAULT_SHEET_CONFIG } from '../scripts/core/constants.js';

globalThis.foundry = { utils: { deepClone: structuredClone, randomID: () => 'test',
  getProperty: (o,p) => p.split('.').reduce((v,k)=>v?.[k],o), hasProperty: (o,p) => p.split('.').reduce((v,k)=>v?.[k],o) !== undefined } };
globalThis.game = { settings: { get: () => DEFAULT_SHEET_CONFIG }, system: { id: 'dnd5e' } };

test('all twelve default rarities have distinct silhouettes, materials and canvas trace geometry', () => {
  const themes = DEFAULT_ITEM_RARITIES.map(resolveRarityVisual);
  assert.equal(themes.length,12);
  for (const key of ['ornamentStyle','material','beamProfile','cornerMask']) assert.equal(new Set(themes.map(t=>t[key])).size,12,key);
  assert.equal(new Set(themes.map(t=>JSON.stringify(rarityBeamTraces(t,200,20)))).size,12);
  for (const theme of themes) {
    for (const path of rarityBeamTraces(theme,200,20)) for (const point of path) assert.ok(point.every(Number.isFinite));
    for (const time of [0,1,10,100]) assert.ok(Object.values(rarityBeamMotion(theme,time,.4)).every(Number.isFinite));
  }
  assert.ok(resolveRarityVisual({id:'divine'}).rays > resolveRarityVisual({id:'rare'}).rays);
});

test('user colors, switches, background controls and custom rarity IDs remain supported', () => {
  const custom = {id:'moonstone',color:'#163eaa',animated:false,ornament:false,spectrum:false,glint:false};
  const t = resolveRarityVisual(custom);
  assert.equal(t.baseColor,'#163eaa');
  assert.equal(t.id,'moonstone');
  assert.equal(t.motion,false);
  const view = rarityPresentation(custom,{background:{opacity:31,brightness:140}});
  assert.match(view.style,/--buxa-rarity-bg-opacity:0.31/);
  assert.match(view.style,/--buxa-rarity-bg-brightness:1.4/);
  assert.match(view.style,/--rv-motion-state:paused/);
  assert.match(view.style,/--rv-ornament:0/);
  assert.equal(resolveRarityVisual({id:'secret',color:'#08090c'}).baseColor,'#08090c');
  assert.notEqual(resolveRarityVisual({id:'secret',color:'#08090c'}).glowColor,'#08090c');
  assert.ok(Object.isFrozen(RARITY_VISUALS));
});

test('unsafe authored values cannot enter the generated CSS or SVG', () => {
  const t=rarityVisualPresentation({id:'<script>',color:'red;position:fixed',label:'<img onerror=alert(1)>'});
  assert.doesNotMatch(t.style,/position:|onerror|<script/);
  assert.doesNotMatch(t.className,/[<>]/);
});

test('effect row selected rarity receives the full theme but hidden and locked rows reveal none', () => {
  const config={items:{rarities:DEFAULT_ITEM_RARITIES}};
  const rare=DEFAULT_ITEM_RARITIES.find(r=>r.id==='rare');
  const selected={style:'rarity',rarityId:'divine'};
  const view=presentationTheme(selected,rare,config);
  assert.match(view.themeClass,/celestial/);
  assert.match(view.themeStyle,/--rv-crest:url/);
  for(const visibility of ['hidden','locked','dmOnly']) assert.deepEqual(presentationTheme(selected,rare,config,visibility),{themeClass:'',themeStyle:''});
  for(const style of ['neutral','custom']) assert.deepEqual(presentationTheme({style},rare,config),{themeClass:'',themeStyle:''});
  const neutral=neutralItemSheetLines([{themeClass:view.themeClass,themeStyle:view.themeStyle}])[0];
  assert.equal(neutral.themeClass,''); assert.equal(neutral.themeStyle,'');
});

test('applying visual tokens preserves resource fill, coordinates and pointer behavior', () => {
  const props=new Map([['--buxa-hb-orb-fill','65%'],['left','24px'],['pointer-events','none']]);
  const element={className:'buxa-hb-orb',style:{setProperty:(k,v)=>props.set(k,v)}};
  applyRarityVisual(element,DEFAULT_ITEM_RARITIES[10]);
  assert.equal(props.get('--buxa-hb-orb-fill'),'65%');
  assert.equal(props.get('left'),'24px'); assert.equal(props.get('pointer-events'),'none');
  assert.match(props.get('--rv-crest'),/^url\("data:image\/svg\+xml,/);
});

test('actor accent uses only active equipment, ignores inventory and never writes documents', () => {
  const config=normalizeSheetConfig(DEFAULT_SHEET_CONFIG);
  const slot=config.inventory.equipmentLayout.slots.find(s=>s.capacity>=1);
  slot.capacity=2;
  const items=['rare','divine','legendary'].map((id,i)=>({id:'i'+i,system:{quantity:1},getFlag:()=>({rarityId:id})}));
  items.get=id=>items.find(i=>i.id===id);
  const state={tracked:items.map(i=>i.id),placements:{i0:{area:'equipment',slotId:slot.id,position:0},i1:{area:'inventory',index:0},i2:{area:'equipment',slotId:slot.id,position:1}},equipmentActive:{[slot.id]:0}};
  const actor={items,getFlag:(_module,key)=>key==='inventory'?state:undefined,update:()=>{throw Error('visual resolver wrote to actor');}};
  const before=JSON.stringify(state);
  assert.equal(actorRarityContext(actor,config).id,'rare');
  assert.equal(JSON.stringify(state),before);
  state.equipmentActive[slot.id]=1;
  assert.equal(actorRarityContext(actor,config).id,'legendary');
  state.placements.i2={area:'inventory',index:2};
  assert.equal(actorRarityContext(actor,config).id,'common');
});

test('rebirth context uses authored tier identity or nearest palette while retaining the authored color', () => {
  const config={items:{rarities:DEFAULT_ITEM_RARITIES},rebirthStyles:[{rarityId:'divine'}]};
  assert.equal(rebirthRarityContext({},1,config,'#aabbcc').id,'divine');
  assert.equal(rebirthRarityContext({},1,config,'#aabbcc').color,'#aabbcc');
  assert.equal(rebirthRarityContext({},1,{items:config.items},'#df4e56').id,'masterwork');
});
