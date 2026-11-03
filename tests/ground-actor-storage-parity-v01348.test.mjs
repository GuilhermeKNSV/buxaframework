import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SHEET_CONFIG, MODULE_ID } from '../scripts/core/constants.js';
import { getInventoryState, getActorStorage } from '../scripts/core/inventory.js';
import { groundCompartments, classifyGroundPlacements } from '../scripts/core/ground-container.js';
import { rotatedCells, normalizeItemShape } from '../scripts/core/inventory-shapes.js';

function makeItem(id,rules){
 const flags={[MODULE_ID]:{item:rules}};
 return {id,name:id,flags,getFlag(ns,key){return this.flags[ns]?.[key];}};
}
function makePair({rows=4,columns=5,mask,contents}){
 const cfg=structuredClone(DEFAULT_SHEET_CONFIG);
 cfg.inventory.mode='complex';
 cfg.inventory.complex={columns:10,rows:6,activeCells:60,autoSort:false};
 const storage={slots:{external:[{id:'pouch',columns,rows,mode:'complex',cells:mask}]}};
 const root=makeItem('root',{storage});
 const children=contents.map(e=>makeItem(e.sourceId,{shape:e.data.flags[MODULE_ID].item.shape}));
 const items=[root,...children];
 const placements={root:{area:'inventory',index:0}};
 for(const e of contents)placements[e.sourceId]={area:'storage',storageId:'root:pouch',index:e.index,rotation:e.rotation};
 const actor={items,getFlag(ns,key){return ns===MODULE_ID && key==='inventory'?{version:4,tracked:items.map(x=>x.id),placements,autoSort:false}:undefined;}};
 const ground={data:{flags:{[MODULE_ID]:{item:{storage},backpackContents:contents}}}};
 return {cfg,actor,ground};
}
function child(id,index,rotation,cells){return {sourceId:id,providerId:'root',compartmentId:'pouch',index,rotation,
 data:{name:id,flags:{[MODULE_ID]:{item:{shape:{cells}}}}}};}

test('ground and Actor honor identical irregular occupied cells, not an empty origin',()=>{
 const entries=[child('axe',0,0,[{x:1,y:0},{x:0,y:1},{x:1,y:1}]),
   child('glove',2,0,[{x:0,y:0},{x:0,y:1}])];
 const {cfg,actor,ground}=makePair({columns:3,rows:3,mask:[1,2,3,4,5,6,7,8],contents:entries});
 const visible=classifyGroundPlacements(groundCompartments(ground),entries);
 assert.equal(visible.valid.length,2);
 const actorPositions=getInventoryState(actor,cfg).placements;
 for(const e of visible.valid)assert.equal(actorPositions[e.sourceId]?.index,e.index);
 assert.equal(getActorStorage(actor,cfg).compartments[0].itemMode,'complex');
});

test('ground and Actor agree on legal rotated L/T footprints over 4 turns and masked cells',()=>{
 const shapes=[
  [{x:1,y:0},{x:0,y:1},{x:1,y:1}],
  [{x:0,y:0},{x:1,y:0},{x:1,y:1}],
  [{x:1,y:0},{x:0,y:1},{x:1,y:1},{x:2,y:1}],
  [{x:0,y:0},{x:1,y:0},{x:0,y:1}],
  [{x:0,y:0},{x:0,y:1},{x:0,y:2}],
 ];
 let checks=0;
 for(let turn=0;turn<4;turn++)for(let s=0;s<shapes.length;s++) {
   const cells=rotatedCells(normalizeItemShape({cells:shapes[s]}),turn);
   const index=6;const columns=5;
   const originX=index%columns,originY=Math.floor(index/columns);
   const mask=cells.map(cell=>(originY+cell.y)*columns+originX+cell.x);
   // Exclude every non-occupied square, including the origin whenever empty.
   const entries=[child(`item-${turn}-${s}`,index,turn,shapes[s])];
   const {cfg,actor,ground}=makePair({rows:5,columns,mask,contents:entries});
   const visible=classifyGroundPlacements(groundCompartments(ground),entries);
   assert.equal(visible.valid.length,1,`ground shape ${s} rotation ${turn}`);
   const actual=getInventoryState(actor,cfg).placements;
   assert.equal(actual[entries[0].sourceId]?.index,index,`Actor shape ${s} rotation ${turn}`);
   assert.equal(actual[entries[0].sourceId]?.rotation,turn);
   checks++;
 }
 assert.equal(checks,20);
});

test('masked-out footprint cells remain forbidden after removing origin-cell precheck',()=>{
 const entry=child('axe',0,0,[{x:1,y:0},{x:0,y:1},{x:1,y:1}]);
 const {cfg,actor,ground}=makePair({columns:3,rows:3,mask:[1,4],contents:[entry]});
 assert.equal(classifyGroundPlacements(groundCompartments(ground),[entry]).valid.length,0);
 assert.equal(getInventoryState(actor,cfg).placements.axe,undefined);
});
