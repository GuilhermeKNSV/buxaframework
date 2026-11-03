import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeItemBoardImage,itemBoardImageOf} from '../scripts/core/item-board-image.js';
import {toPhysicalItem} from '../scripts/core/physical-items.js';
import {resolvePhysicalDropTarget} from '../scripts/integrations/physical-item-drop-targets.js';

test('small coin artwork defaults persist across world/inventory/scene copies',()=>{
 const data={name:'Gold coin',type:'loot',flags:{buxaframework:{item:{boardImage:{size:24,rotation:90,opacity:.48}}}}};
 const world={toObject:()=>structuredClone(data)};
 const first=toPhysicalItem(world,1,{x:200,y:300},76,'a');
 assert.deepEqual([first.size,first.rotation,first.opacity],[24,90,.48]);
 const second=toPhysicalItem({toObject:()=>structuredClone(first.data)},1,{x:400,y:200},76,'b');
 assert.deepEqual([second.size,second.rotation,second.opacity],[24,90,.48]);
});
test('image defaults clamp malformed size and opacity and normalize rotation',()=>{
 assert.deepEqual(normalizeItemBoardImage({size:-50,rotation:-90,opacity:7}),{size:20,rotation:270,opacity:1,sceneFx:{beam:{x:0,y:0,scale:1},label:{x:0,y:0,scale:1}}});
 assert.deepEqual(itemBoardImageOf({flags:{buxaframework:{item:{boardImage:{size:35}}}}}),{size:35,rotation:0,opacity:1,sceneFx:{beam:{x:0,y:0,scale:1},label:{x:0,y:0,scale:1}}});
});
test('dropping into a directory folder returns folder ID; empty area targets root',()=>{
 const folder={dataset:{buxaDirFolder:'folder123'},closest(selector){return selector.includes('data-buxa-dir-folder')||selector.includes('buxa-world-item-directory')?this:null;}};
 const root={dataset:{},closest(selector){return selector.includes('buxa-world-item-directory')?this:null;}};
 assert.equal(resolvePhysicalDropTarget(folder,0,0).folderId,'folder123');
 assert.equal(resolvePhysicalDropTarget(root,0,0).folderId,null);
});
