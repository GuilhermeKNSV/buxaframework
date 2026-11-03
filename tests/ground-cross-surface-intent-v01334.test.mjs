import test from 'node:test';
import assert from 'node:assert/strict';
import { planGroundContainerPlacement, groundGrabbedCell } from '../scripts/core/ground-drop-intent.js';
import { groundCompartments, groundDirectItems, groundDropDestination } from '../scripts/core/ground-container.js';
import { groundVisibleCellAtPoint } from '../scripts/apps/ground-container-window.js';

const ns='buxaframework';
const item=(name,cells)=>({name,img:'icons/svg/item-bag.svg',system:{quantity:1},flags:{[ns]:{item:{shape:{cells}}}}});
const s=item('single',[{x:0,y:0}]);
const tee=item('tee',[{x:1,y:0},{x:0,y:1},{x:1,y:1},{x:2,y:1}]);
const line=item('line',[{x:0,y:0},{x:0,y:1},{x:0,y:2}]);
const root=(mask,contents=[],columns=5,rows=5)=>({id:'chest',data:{name:'chest',flags:{[ns]:{
  item:{storage:{slots:{external:[{id:'pouch',mode:'complex',columns,rows,cells:mask}]}}},
  backpackContents:contents
}}}});
const stored=(id,index,data)=>({sourceId:id,providerId:'root',compartmentId:'pouch',index,rotation:0,data});
test('board pickup anchored on a secondary T cell produces one valid exact server location',()=>{
  const mask=[2,6,7,8,11,12,13,16,17,18,22];
  const chest=root(mask,[stored('potion',2,s)]);
  const plan=planGroundContainerPlacement(chest,tee,{storageId:'root:pouch',hoverIndex:13,
    rotation:0,gripX:.84,gripY:.75});
  assert.ok(plan,'plausible ghost position must yield a real slot');
  assert.ok(Number.isInteger(plan.index));
  assert.equal(plan.rotation,0);
  const actual=groundDropDestination(chest,tee,{storageId:plan.storageId,index:plan.index,rotation:plan.rotation});
  assert.deepEqual(actual,{storageId:plan.storageId,index:plan.index,rotation:plan.rotation});
});
test('complex shapes rotate automatically only when needed and keep the chosen rotation',()=>{
  const mask=[2,7,10,11,12,13,14,16,18,23];
  const chest=root(mask,[stored('used',2,line),stored('another',10,tee)]);
  const plan=planGroundContainerPlacement(chest,s,{storageId:'root:pouch',hoverIndex:13});
  assert.ok(plan);
  assert.equal(plan.rotation,0);
  const narrow=root([0,1,2],[],3,1);
  const rotated=planGroundContainerPlacement(narrow,line,{storageId:'root:pouch',hoverIndex:1,rotation:0});
  assert.ok(rotated,'a long vertical item must find the horizontal orientation');
  assert.equal(rotated.rotation%2,1);
  assert.equal(groundDropDestination(narrow,line,{storageId:rotated.storageId,index:rotated.index,rotation:rotated.rotation})?.index,rotated.index);
});
test('a full storage container has no destination; source is not modified',()=>{
  const chest=root([0],[stored('full',0,s)],1,1);
  const before=JSON.stringify(chest);
  assert.equal(planGroundContainerPlacement(chest,s,{storageId:'root:pouch',hoverIndex:0}),null);
  assert.equal(JSON.stringify(chest),before);
});
test('repositioning a chest item excludes its own occupied footprint',()=>{
  const chest=root([1,5,6,7],[stored('inside',0,tee)],5,2);
  const plan=planGroundContainerPlacement(chest,tee,{storageId:'root:pouch',hoverIndex:1,
    movingContentId:'inside',rotation:0});
  assert.ok(plan,'same item should not collide with its old position');
  assert.equal(groundDirectItems(chest).length,1);
});
test('grab ratios are clipped and agree with rotated dimensions',()=>{
  assert.deepEqual(groundGrabbedCell(tee,0,.99,.99).x,2);
  const rotated=groundGrabbedCell(line,1,.99,.5);
  assert.equal(rotated.bounds.width,3);
  assert.equal(rotated.x,2);
  assert.ok(groundCompartments(root([0,1])).length);
});

test('visible cropped 3x3 grid maps to original 5x5 slots and rejects masked holes',()=>{
  const bag={columns:5,rows:5,mode:'complex',cells:[6,7,8,11,13,16,17,18]};
  const viewportRect={left:100,top:200,right:274,bottom:374,width:174,height:174};
  const boardRect={left:42,top:142,width:290,height:290};
  assert.equal(groundVisibleCellAtPoint(125,225,{viewportRect,boardRect,bag})?.index,6);
  assert.equal(groundVisibleCellAtPoint(183,283,{viewportRect,boardRect,bag}),null,'masked center is not a slot');
  assert.equal(groundVisibleCellAtPoint(242,341,{viewportRect,boardRect,bag})?.index,18);
  assert.equal(groundVisibleCellAtPoint(90,225,{viewportRect,boardRect,bag}),null,'outside clipped viewport');
});
