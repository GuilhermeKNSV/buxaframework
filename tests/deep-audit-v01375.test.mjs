import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve,dirname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const BASE = process.env.BUXA_AUDIT_BASE || resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = name => import(pathToFileURL(resolve(BASE,'scripts/core',name)).href);
const [dice, limits, storage, stacks, hit, physical, quick, sight, ground, recharge, itemUse] = await Promise.all([
  imp('item-dice-config.js'),imp('item-use-config.js'),imp('item-storage.js'),
  imp('item-stack-artwork.js'),imp('storage-drop-geometry.js'),imp('physical-items.js'),
  imp('physical-quick-drop.js'),imp('physical-item-sight-auth.js'),imp('ground-container.js'),
  imp('item-recharge.js'),imp('item-use-runtime.js')
]);
const missingInputs = ['', '  ', null, false];
for (const [field, expected, generate] of [
  ['dice count',1,v=>dice.normalizeItemDice([{count:v}])[0].count],
  ['dice faces',20,v=>dice.normalizeItemDice([{faces:v}])[0].faces],
  ['attribute dice faces',20,v=>dice.normalizeItemDice([{attributeDice:{faces:v}}])[0].attributeDice.faces],
  ['tooltip symbol count',3,v=>dice.normalizeTooltipDecorations([{count:v}])[0].count],
  ['resource base amount',1,v=>limits.normalizeItemResourceEffects([{amount:v}])[0].amount],
  ['resource dice count',1,v=>limits.normalizeItemResourceEffects([{count:v}])[0].count],
  ['resource dice faces',10,v=>limits.normalizeItemResourceEffects([{faces:v}])[0].faces],
  ['resource attribute dice faces',10,v=>limits.normalizeItemResourceEffects([{attributeDice:{faces:v}}])[0].attributeDice.faces],
  ['maximum item uses',4,v=>limits.normalizeItemLimits({maxUses:v}).maxUses],
  ['storage width',4,v=>storage.normalizeItemStorage({slots:{external:[{columns:v}]}}).slots.external[0].columns],
  ['storage height',4,v=>storage.normalizeItemStorage({slots:{external:[{rows:v}]}}).slots.external[0].rows],
  ['stack artwork horizontal position',50,v=>stacks.normalizeStackImages([{at:2,mode:'custom',layers:[{img:'gold.png',x:v}]}])[0].layers[0].x],
  ['stack artwork vertical position',50,v=>stacks.normalizeStackImages([{at:2,mode:'custom',layers:[{img:'gold.png',y:v}]}])[0].layers[0].y],
  ['stack artwork image size',55,v=>stacks.normalizeStackImages([{at:2,mode:'custom',layers:[{img:'gold.png',size:v}]}])[0].layers[0].size],
  ['stack artwork opacity',1,v=>stacks.normalizeStackImages([{at:2,mode:'custom',layers:[{img:'gold.png',opacity:v}]}])[0].layers[0].opacity],
  ['scene loot range',10,v=>physical.normalizePhysicalSettings({lootDistance:v}).lootDistance],
  ['scene drop range',10,v=>physical.normalizePhysicalSettings({dropDistance:v}).dropDistance],
  ['scene move range',10,v=>physical.normalizePhysicalSettings({moveDistance:v}).moveDistance],
  ['scene max move range',15,v=>physical.normalizePhysicalSettings({maxMoveDistance:v}).maxMoveDistance]
]) {
  for (const invalid of missingInputs) test(`${field} uses its documented default for ${JSON.stringify(invalid)}`,()=>assert.equal(generate(invalid),expected));
}
// Corrupt imported pouch masks must not invent an extra occupied cell at zero.
for(const invalid of missingInputs){
  test(`shaped pouch excludes malformed mask cell ${JSON.stringify(invalid)}`,()=>{
    const bag=storage.normalizeItemStorage({slots:{external:[{columns:3,rows:3,mode:'complex',cells:[invalid,4]}]}}).slots.external[0];
    assert.deepEqual(bag.cells,[4]);
  });
  test(`compact pouch bounds ignore malformed cell ${JSON.stringify(invalid)}`,()=>{
    assert.deepEqual(storage.storageVisibleBounds({mode:'complex',columns:3,rows:3,cells:[invalid,4]}),{x:1,y:1,columns:1,rows:1});
  });
  test(`legacy invalid placement ${JSON.stringify(invalid)} doesn't occupy first cell`,()=>{
    const bag={columns:2,rows:2,mode:'simple',itemMode:'simple',storageId:'chest:bag',providerId:'chest'};
    const placements={bad:{area:'storage',storageId:'chest:bag',index:invalid}};
    assert.equal(storage.fitsExternalStorage(bag,placements,{},'new',0),true);
  });
}
// Drop coordinates must reference the actual board, not the infinite drag projection.
const board={rect:{left:100,top:100,right:220,bottom:220,width:120,height:120},columns:2,rows:2,complex:true,storageId:'crate:bag'};
for (const [name,x,y,grab] of [
  ['right exterior',235,160,{x:1,y:0}], ['bottom exterior',160,235,{x:0,y:1}],
  ['nonfinite horizontal',NaN,130,null], ['nonfinite vertical',130,Infinity,null],
  ['exterior origin',90,130,null], ['exterior top',130,90,null]
]) test(`drop mapping blocks ${name}`,()=>assert.equal(hit.storagePlacementAt(board,x,y,grab),null));
for(const [name,x,y] of [['missing x',NaN,110],['missing y',110,Infinity]])
  test(`storage window hit test blocks ${name}`,()=>assert.equal(hit.storageBoardAt([board],x,y),null));
test('incomplete storage window rectangle cannot intercept dragging',()=>{
 assert.equal(hit.storageBoardAt([{rect:{left:0,top:0}}],50,50),null);
});
// Invalid text and boolean coordinates should not make a character token at 0,0.
const scene={id:'S',width:700,height:700,grid:{size:100,distance:5}};
const actor={id:'A'};
for(const [name,field,value] of [
  ['null horizontal','x',null],['blank horizontal','x',''],['boolean horizontal','x',false],
  ['null vertical','y',null],['blank vertical','y',''],['boolean vertical','y',false],
  ['negative token width','width',-1],['zero token height','height',0]
]) test(`quick scene drop ignores ${name}`,()=>{
 const token={id:'T',actorId:'A',x:100,y:100,width:1,height:1};token[field]=value;
 assert.equal(quick.quickDropPoint({actor,scene,user:{isGM:false},tokens:[token],actors:[actor],settings:{playerDropRangeEnabled:false}}),null);
});
for(const [name,invalid] of [['zero width',0],['negative height',-20]])
 test(`scene with ${name} cannot be a valid drop rectangle`,()=>{
 const target=name==='zero width'?{width:invalid,height:100}:{width:100,height:invalid};
 assert.equal(physical.physicalDropArtworkOrigin({x:50,y:50},30,target),null);
});
for (const [name,inputs] of [
 ['missing player',{user:null,scene:{id:'S',tokenVision:false},item:{id:'I'}}],
 ['missing scene',{user:{id:'P'},scene:{tokenVision:false},item:{id:'I'}}],
 ['missing item',{user:{id:'P'},scene:{id:'S',tokenVision:false},item:null}]
]) test(`vision disabled cannot authorize ${name}`,()=>{
  assert.equal(sight.playerSightForPhysicalItem(inputs).allowed,false);
});
// Corrupt legacy rotation should not be silently reinterpreted as a legal new item footprint.
for(const invalid of [-1,4,1.5,'bad']) test(`ground chest classifies invalid legacy rotation ${invalid} as recoverable`,()=>{
 const bag={id:'b',storageId:'root:b',providerId:'root',columns:3,rows:3,mode:'complex',cells:[0,1,2,3,4,5,6,7,8]};
 const item={sourceId:'axe',providerId:'root',compartmentId:'b',index:0,rotation:invalid,data:{flags:{buxaframework:{item:{shape:{cells:[{x:0,y:0}]}}}}}};
 const result=ground.classifyGroundPlacements([bag],[item]);
 assert.equal(result.valid.length,0);assert.equal(result.unplaced.length,1);
});
// A freshly generated ID must remain a valid plain-string identity in a saved chest.
const crateData={id:'c',data:{flags:{buxaframework:{item:{storage:{slots:{external:[{id:'bag',mode:'complex',columns:3,rows:3,cells:[0,1,2,3,4,5,6,7,8]}]}}}}}}};
const axeData={name:'Axe',img:'axe.png',flags:{buxaframework:{item:{shape:{cells:[{x:0,y:0}]}}}}};
for(const invalid of [42,true,{},'root']) test(`ground chest refuses invalid generated ID ${JSON.stringify(invalid)}`,()=>{
 assert.throws(()=>ground.groundAddBranch(crateData,axeData,[],'root:bag',0,0,()=>invalid),/unique/);
});
// Identity checks: a stale document must not spend current Actor resources.
test('a stale embedded item reference cannot initiate item use',()=>{
 const actor={id:'A',isOwner:true,items:new Map([['I',{}]])};
 const item={id:'I',parent:actor};
 assert.throws(()=>itemUse.preflightItemUse(item,actor,{}),/owner/);
});
test('a different actor instance with the same ID cannot be used as owner',()=>{
 const owner={id:'A',isOwner:true};
 const actor={id:'A',isOwner:true};
 const item={id:'I',parent:owner};
 assert.throws(()=>itemUse.preflightItemUse(item,actor,{}),/owner/);
});
// Item instance IDs can collide with World Item template IDs; only provenance counts.
test('an unrelated Actor Item with coincidentally matching template ID cannot be spent as recharge material',()=>{
 const actor={isOwner:true};const source={id:'T',parent:actor,getFlag:()=>null};
 const target={id:'X',parent:actor,getFlag:(ns,key)=>key==='item'?{limits:{enabled:true,maxUses:4,recharge:{item:{enabled:true,templateId:'T'}}}}:null};
 actor.items=new Map([['T',source],['X',target]]);
 assert.equal(recharge.canRechargeWithItem(source,target,{items:{}}),false);
});
for(const [name,raw] of [
 ['dice fixed-vs-attribute false', {run:()=>dice.normalizeItemDice([{attributeDice:{enabled:'false'}}])[0].attributeDice.enabled,expected:false}],
 ['dice fixed-vs-attribute true',{run:()=>dice.normalizeItemDice([{attributeDice:{enabled:'true'}}])[0].attributeDice.enabled,expected:true}],
 ['dice show-range false',{run:()=>dice.normalizeItemDice([{showRange:'false'}])[0].showRange,expected:false}],
 ['dice show-range true',{run:()=>dice.normalizeItemDice([{showRange:'true'}])[0].showRange,expected:true}],
 ['dice chat publication false',{run:()=>dice.normalizeItemDice([{chatRoll:'false'}])[0].chatRoll,expected:false}],
 ['dice tooltip display false',{run:()=>dice.normalizeItemDice([{tooltip:{enabled:'false'}}])[0].tooltip.enabled,expected:false}],
 ['resource attribute dice activation',{run:()=>limits.normalizeItemResourceEffects([{attributeDice:{enabled:'true'}}])[0].attributeDice.enabled,expected:true}],
 ['resource attribute dice rejection',{run:()=>limits.normalizeItemResourceEffects([{attributeDice:{enabled:'false'}}])[0].attributeDice.enabled,expected:false}],
 ['Limits activation',{run:()=>limits.normalizeItemLimits({enabled:'true'}).enabled,expected:true}],
 ['Limits disabled string',{run:()=>limits.normalizeItemLimits({enabled:'false'}).enabled,expected:false}],
 ['recharge button activation',{run:()=>limits.normalizeItemRecharge({button:{enabled:'true'}}).button.enabled,expected:true}],
 ['recharge item activation',{run:()=>limits.normalizeItemRecharge({item:{enabled:'true'}}).item.enabled,expected:true}],
 ['recharge combat activation',{run:()=>limits.normalizeItemRecharge({combat:{enabled:'true'}}).combat.enabled,expected:true}],
 ['recharge button rejection',{run:()=>limits.normalizeItemRecharge({button:{enabled:'false'}}).button.enabled,expected:false}],
 ['storage tooltip activation',{run:()=>storage.normalizeStorageTooltip({enabled:'true'}).enabled,expected:true}],
 ['storage tooltip refusal',{run:()=>storage.normalizeStorageTooltip({enabled:'false'}).enabled,expected:false}],
 ['storage capacity text',{run:()=>storage.normalizeStorageTooltip({showCapacity:'false'}).showCapacity,expected:false}],
 ['storage compartment text',{run:()=>storage.normalizeStorageTooltip({showCompartments:'false'}).showCompartments,expected:false}],
 ['storage equipment bonuses',{run:()=>storage.normalizeStorageTooltip({showBonuses:'false'}).showBonuses,expected:false}],
 ['storage compartment border',{run:()=>storage.normalizeItemStorage({slots:{external:[{border:'false'}]}}).slots.external[0].border,expected:false}],
 ['storage compartment background',{run:()=>storage.normalizeItemStorage({slots:{external:[{background:'false'}]}}).slots.external[0].background,expected:false}],
 ]) test(`persisted string checkbox: ${name}`,()=>assert.equal(raw.run(),raw.expected));
// Legacy invalid rotations should not block a real empty cell during a later transfer.
for(const invalid of [-1,4,1.5,'bad']) test(`Actor storage excludes corrupt rotation ${invalid} from occupied hit map`,()=>{
 const bag={columns:2,rows:2,mode:'simple',itemMode:'complex',storageId:'crate:bag',providerId:'crate'};
 const placements={bad:{area:'storage',storageId:'crate:bag',index:0,rotation:invalid}};
 assert.equal(storage.fitsExternalStorage(bag,placements,{},'new',0),true);
});

test('legacy numeric-string rotations remain valid for an otherwise fitting chest item',()=>{
 const bag={id:'b',storageId:'root:b',providerId:'root',columns:3,rows:3,mode:'complex',cells:[0,1,2,3,4,5,6,7,8]};
 const entry={sourceId:'old',providerId:'root',compartmentId:'b',index:0,rotation:'1',data:{flags:{buxaframework:{item:{shape:{cells:[{x:0,y:0}]}}}}}};
 const result=ground.classifyGroundPlacements([bag],[entry]);
 assert.equal(result.valid.length,1);assert.equal(result.placements.old.rotation,1);
});
