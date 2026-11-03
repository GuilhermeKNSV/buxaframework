/** v0.15.6 audit: independent user-visible input scenarios, checked against v0.15.5. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeItemSystemConfig} from '../scripts/core/item-config.js';
import {defaultHotbarState,mergeHotbarConfiguration} from '../scripts/core/hotbar-state.js';
import {gridDimensions,normalizeItemShape} from '../scripts/core/inventory-shapes.js';
import {normalizeSceneItemVisualLayout,groundFxSize} from '../scripts/core/scene-item-visual-layout.js';
import {normalizeItemEquipArtwork} from '../scripts/core/item-equip-artwork.js';
import {normalizeItemBoardImage} from '../scripts/core/item-board-image.js';
import {storagePlacementAt} from '../scripts/core/storage-drop-geometry.js';
import {cleanFloatingNumber} from '../scripts/core/number-display.js';
import {normalizeItemStorage} from '../scripts/core/item-storage.js';

const labels=['✨','🧿','🔥','🌟','☄️','💠','🎯','🎲','🛡','⚔️','💎','🪄','🦅','🔮','🎴','🌑','👑','🗡️'];
for(const label of labels) test(`rarity stable imported identifier for ${label}`,()=>{
  const data={rarities:[{id:label,label}]};
  const first=normalizeItemSystemConfig(data).rarities[0].id;
  assert.equal(normalizeItemSystemConfig(data).rarities[0].id,first);
});

for(let n=1;n<=9;n++)test(`hotbar concurrent settings edit preserves ${n} shortcuts on tabs unknown to original dialog`,()=>{
  const original=defaultHotbarState();
  const live=structuredClone(original);
  for(let i=0;i<n;i++){
    const tabId=`extra-${i}`;
    live.tabs.push({id:tabId,name:`Extra ${i}`});
    live.bindings['Actor.Demo']??={};
    live.bindings['Actor.Demo'][tabId]=[`item-${i}`];
  }
  const submitted=structuredClone(original);submitted.rows=2;
  const merged=mergeHotbarConfiguration(live,submitted,original);
  for(let i=0;i<n;i++){
    assert.ok(merged.tabs.some(t=>t.id===`extra-${i}`));
    assert.equal(merged.bindings['Actor.Demo'][`extra-${i}`][0],`item-${i}`);
  }
});

for(const columns of [4,7,10,14])for(const invalid of [null,'',' ',false,true,[], '\t','\n']){
  test(`invalid blank activeCells preserves ${columns}x3 grid with ${JSON.stringify(invalid)}`,()=>{
    assert.equal(gridDimensions({columns,rows:3,activeCells:invalid}).activeCells,columns*3);
  });
}

for(const target of ['beam','label'])for(const field of ['scale','x','y'])for(const val of [false,true]){
  if(field!=='scale' && !val) continue;
  if(field==='scale' && val) continue;
  test(`scene FX ${target}.${field} rejects boolean ${String(val)} as number`,()=>{
    const profile=normalizeSceneItemVisualLayout({[target]:{[field]:val}})[target];
    assert.equal(profile[field],field==='scale'?1:0);
  });
}
for(const size of ['small','wide','tall','long','large'])for(const field of ['zoom','x','y','rotation']){
  const value=field==='zoom'?false:true;
  test(`equipment ${size}.${field} uses default for checkbox ${String(value)}`,()=>{
    const profile=normalizeItemEquipArtwork({[size]:{[field]:value}})[size];
    assert.equal(profile[field],field==='zoom'?1:0);
  });
}

const badTurns=[-37,-15,-9,-5,-1,4,5,7,8,11,17,359,999,1.5,2.25,NaN,Infinity,'bad','2.5',true,false,[],{}];
for(const rotation of badTurns)test(`scene storage drag canonical rotation ${String(rotation)}`,()=>{
  const board={storageId:'Item.bag:pouch',rect:{left:0,top:0,width:120,height:120},columns:3,rows:3,complex:true};
  const result=storagePlacementAt(board,15,15,null,rotation);
  assert.ok(Number.isInteger(result.rotation) && result.rotation>=0 && result.rotation<=3);
});

for(const val of ['', ' ', '\t', '\n', false, true, null, [], ' \n ', ' \t ']){
  test(`display number blank ${JSON.stringify(val)} uses configured fallback`,()=>{
    assert.equal(cleanFloatingNumber(val,99),99);
  });
}

for(const field of ['x','y'])for(const value of [true, false, 'on','off']){
  test(`imported shape coordinate ${field} with ${String(value)} cannot create phantom cells`,()=>{
    const shape=normalizeItemShape({cells:[{x:0,y:0},{x:field==='x'?value:0,y:field==='y'?value:0}]});
    assert.equal(shape.cells.length,1);
  });
}

for(const bad of [null,undefined,false,true,{},[],'',' ',42]){
  test(`storage slot grant drops invalid ID ${JSON.stringify(bad)}`,()=>{
    assert.deepEqual(normalizeItemStorage({equipped:{slotIds:[bad]}}).equipped.slotIds,[]);
  });
}

for(const input of [null,false,'',[],true,' ', '\t'])for(const axis of ['width','height']){
  test(`missing FX ${axis} ${JSON.stringify(input)} uses normal footprint`,()=>{
    const result=axis==='width'?groundFxSize(input,76):groundFxSize(76,input);
    assert.equal(result.factor,1);
    if(axis==='height') assert.equal(result.groundY,1);
  });
}

// An invalid checkbox value in an item image field must never shrink a coin to
// 20 px or make a weapon nearly invisible after the next save/reopen.
for(const [field,bad,wanted] of [['size',false,76],['size',true,76],['rotation',true,0],['opacity',false,1]])for(const withOtherField of [false,true]){
  for(const withSavedFx of [false,true]) test(`scene artwork ${field} checkbox ${String(bad)} survives context ${withOtherField}/${withSavedFx}`,()=>{
    const raw={ [field]:bad };
    if(withOtherField) raw.rotation=field==='rotation'?bad:90;
    if(withSavedFx) raw.sceneFx={beam:{x:13,scale:1.5}};
    assert.equal(normalizeItemBoardImage(raw)[field],wanted);
  });
}
for(const sceneFx of [undefined,{beam:{scale:2}},{label:{x:30}}])test(`item shape rotation rejects imported boolean with scene settings ${JSON.stringify(sceneFx)}`,()=>{
  assert.equal(normalizeItemShape({imageRotation:true,sceneFx}).imageRotation,0);
});
