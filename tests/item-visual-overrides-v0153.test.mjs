import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { INVENTORY_SIZE_PATTERNS } from '../scripts/core/inventory-config.js';
import { normalizeItemEquipArtwork, equipmentArtworkTransform } from '../scripts/core/item-equip-artwork.js';
import { normalizeItemBoardImage, itemBoardImageOf } from '../scripts/core/item-board-image.js';
import { groundFxSize, normalizeSceneItemVisualLayout } from '../scripts/core/scene-item-visual-layout.js';
import { normalizeItemRules, normalizeItemSystemConfig } from '../scripts/core/item-config.js';
import { positionPhysicalItemFx } from '../scripts/integrations/physical-item-fx.js';
import { positionPhysicalItemLabel } from '../scripts/integrations/physical-item-label.js';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
test('each of the five equipment sizes gets an independent, normalized artwork profile',()=>{
  assert.deepEqual(INVENTORY_SIZE_PATTERNS.map(v=>v.id),['small','wide','tall','long','large']);
  const base=normalizeItemEquipArtwork({small:{x:14,y:-8,zoom:1.25,rotation:45},long:{zoom:2.6}});
  assert.equal(base.small.x,14);assert.equal(base.long.zoom,2.6);
  assert.equal(base.tall.zoom,1);assert.equal(base.large.x,0);
  assert.equal(base.small.rotation,45);
  assert.match(equipmentArtworkTransform(base.small),/translate\(14px,-8px\) rotate\(45deg\) scale\(1.25\)/);
});
test('invalid slot size overrides are clamped; executable CSS cannot be injected via saved settings',()=>{
  const profiles=normalizeItemEquipArtwork({small:{x:'100);color:red',y:1e80,zoom:-9,rotation:9999},
    wide:{x:-9999,y:-10,zoom:80,rotation:'NaN'}});
  assert.deepEqual(profiles.small,{x:0,y:180,zoom:.25,rotation:360});
  assert.deepEqual(profiles.wide,{x:-180,y:-10,zoom:4,rotation:0});
  assert.doesNotMatch(equipmentArtworkTransform(profiles.small),/color:red/);
});
test('Item rule normalization keeps equipment art and scene FX independent, while preserving old defaults',()=>{
  const config=normalizeItemSystemConfig();
  const rules=normalizeItemRules({equipArtwork:{large:{zoom:2}},boardImage:{size:22,sceneFx:{beam:{x:30,scale:1.8},label:{y:-55,scale:.65}}}},config);
  assert.equal(rules.equipArtwork.large.zoom,2);assert.equal(rules.equipArtwork.small.zoom,1);
  assert.equal(rules.boardImage.size,22);
  assert.deepEqual(rules.boardImage.sceneFx.beam,{x:30,y:0,scale:1.8});
  assert.deepEqual(rules.boardImage.sceneFx.label,{x:0,y:-55,scale:.65});
  const old=normalizeItemRules({},config);
  assert.equal(old.boardImage.sceneFx.beam.scale,1);assert.equal(old.equipArtwork.long.rotation,0);
});
test('scene FX dimensions have a lower bound for tiny items and scale normally for large ones',()=>{
  const tiny=groundFxSize(20,20,1), coin=groundFxSize(28,7,1), normal=groundFxSize(76,76,1);
  assert.equal(tiny.factor,.62);assert.equal(coin.factor,.62);assert.equal(normal.factor,1);
  assert.ok(tiny.groundX>=.4);assert.ok(tiny.groundY>=.38);
  assert.ok(coin.groundY>=.38);
  assert.ok(groundFxSize(150,120,3).factor>normal.factor);
});
test('malformed scene overrides clamp scale and offsets; missing saved values remain at defaults',()=>{
  const value=normalizeSceneItemVisualLayout({beam:{x:10000,y:'oops',scale:200},label:{x:-10000,y:27,scale:0}});
  assert.deepEqual(value.beam,{x:500,y:0,scale:4});
  assert.deepEqual(value.label,{x:-500,y:27,scale:.3});
  assert.deepEqual(normalizeSceneItemVisualLayout({}).label,{x:0,y:0,scale:1});
});
test('ground scene effects honor the saved beam offset/scale, and keep their shadow footprint bounded',()=>{
  const location={x:0,y:0};const beamScale={x:0,y:0};const groundScale={x:0,y:0};
  const fx={_rarityTier:1,_visualMode:'beam',_beamHeight:178,
    position:{set(x,y){Object.assign(location,{x,y});}},scale:{set(){}},
    _ground:{scale:{set(x,y){Object.assign(groundScale,{x,y});}}},
    _beam:{scale:{set(x,y){Object.assign(beamScale,{x,y});}}},
    _frontFx:{position:{set(){}}}};
  const record={size:20,data:{flags:{buxaframework:{item:{boardImage:{size:20,sceneFx:{beam:{x:11,y:-9,scale:1.7}}}}}}}};
  positionPhysicalItemFx(fx,record,{width:20,height:20,rotation:0});
  assert.deepEqual(location,{x:21,y:11});
  assert.ok(beamScale.y>1,'scale customization persists after minimum size handling');
  assert.ok(groundScale.x>=.4 && groundScale.y>=.38);
  assert.ok(fx._baseSize>=.62);
});
test('scene loot nameplate placement and scale are independent of the beam',()=>{
  const values={};
  const label={position:{set(x,y){values.x=x;values.y=y;}},scale:{set(v){values.scale=v;}}};
  const item={size:20,data:{flags:{buxaframework:{item:{boardImage:{sceneFx:{label:{x:15,y:22,scale:.7},beam:{x:120,scale:4}}}}}}}};
  positionPhysicalItemLabel(label,item,110,'beam');
  assert.equal(values.x,25);assert.equal(values.scale,.7);assert.equal(values.y,-20);
});
test('new visual subtab is connected to persistent runtime equipment artwork, not a mock-only preview',()=>{
  assert.match(read('../scripts/apps/item-config-navigation.js'),/\["equipSize", "Equip Size"/);
  assert.match(read('../scripts/apps/item-config.js'),/bindItemEquipSizeEditor\(root, this\)/);
  assert.match(read('../scripts/apps/item-config.js'),/equipArtwork: this\._equipArtworkDraft/);
  assert.match(read('../scripts/apps/inventory-context.js'),/--buxa-equipped-art-transform/);
  assert.match(read('../styles/141-responsive-item-artwork.css'),/var\(--buxa-equipped-art-transform/);
  assert.match(read('../templates/item-config.hbs'),/data-equip-size-editor/);
});
test('right-click scene preview exposes separate position and resize controls for beam and nameplate',()=>{
  const html=read('../templates/item-config.hbs');
  const code=read('../scripts/apps/item-scene-fx-preview.js');
  for(const key of ['data-board-preview-toggle','data-board-preview-select="image"','data-board-fx-target="beam"','data-board-fx-target="label"','data-board-fx-resize'])assert.ok(html.includes(key),key);
  assert.match(code,/const name = target\.dataset\.boardFxTarget/);
  assert.match(code,/sceneFx:\s*\{\s*\.\.\.app\._boardImageDraft\.sceneFx,\s*\[name\]:\s*next\s*\}/);
  assert.match(read('../scripts/integrations/physical-item-fx.js'),/visual\.scale/);
  assert.match(read('../scripts/integrations/physical-item-label.js'),/visual\.scale/);
});
