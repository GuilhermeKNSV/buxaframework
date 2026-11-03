import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeItemStorage,buildStorageGrants,fitsExternalStorage} from '../scripts/core/item-storage.js';
const read=p=>readFileSync(new URL(p, import.meta.url),'utf8');

test('storage normalization keeps stable identifiers and rejects invalid cells and colors',()=>{
 const out=normalizeItemStorage({equipped:{slotIds:['gloves-1','gloves-1']},slots:{add:12,external:[{id:'pouch',mode:'complex',columns:3,rows:3,cells:[0,1,4,99,-1,4],color:'#aa55FF'}, {id:'pouch',mode:'simple'}]}});
 assert.deepEqual(out.equipped.slotIds,['gloves-1']);
 assert.equal(out.slots.add,12);assert.deepEqual(out.slots.external[0].cells,[0,1,4]);
 assert.equal(out.slots.external[0].color,'#aa55ff');assert.notEqual(out.slots.external[0].id,out.slots.external[1].id);
});
test('only active loadout grants bonuses but unequipped compartment ownership persists',()=>{
 const items=[{id:'a',name:'Backpack'},{id:'b',name:'Inactive Bag'}];
 const grants=buildStorageGrants({items},{a:{area:'equipment',slotId:'backpack-1',position:0},b:{area:'equipment',slotId:'offhand-1',position:1}},{'backpack-1':0,'offhand-1':0},item=>({storage: {equipped:{slotIds:['gloves-2']},slots:{add:7,external:[{id:'p1',mode:'simple',columns:3,rows:2}]}}}));
 assert.equal(grants.additional,7);assert.equal(grants.compartments.length,2);assert.equal(grants.compartments[0].storageId,'a:p1');
 assert.equal(grants.compartments[1].storageId,'b:p1');assert.equal(grants.compartments[1].active,false);assert.ok(grants.unlocked.has('gloves-2'));
});
test('L-shaped compartment supports only eligible cells and no overlap',()=>{
 const bag={storageId:'a:bag',providerId:'a',mode:'complex',columns:3,rows:3,cells:[0,1,3,6]};
 const shapes={a:{cells:[{x:0,y:0}]},sword:{cells:[{x:0,y:0},{x:0,y:1}]},coin:{cells:[{x:0,y:0}]}};
 assert.equal(fitsExternalStorage(bag,{},shapes,'sword',0),true);
 assert.equal(fitsExternalStorage(bag,{},shapes,'sword',1),false);
 assert.equal(fitsExternalStorage(bag,{sword:{area:'storage',storageId:bag.storageId,index:0}},shapes,'coin',3),false);
 assert.equal(fitsExternalStorage(bag,{},shapes,'a',0),false);
 assert.equal(fitsExternalStorage(bag,{},shapes,'coin',4),false);
});
test('simple external cells accept only one occupied item per cell',()=>{
 const bag={storageId:'a:bag',providerId:'a',mode:'simple',columns:2,rows:2,cells:[]};
 assert.equal(fitsExternalStorage(bag,{coin:{area:'storage',storageId:bag.storageId,index:1}},{},'gem',1),false);
 assert.equal(fitsExternalStorage(bag,{coin:{area:'storage',storageId:bag.storageId,index:1}},{},'gem',2),true);
});
test('UI contains storage editing, external panels, optional one-tab navigation and hidden slots',()=>{
 assert.match(read('../templates/item-config.hbs'),/data-storage-add-external/);
 assert.match(read('../templates/item-config.hbs'),/data-storage-slot-id/);
 assert.match(read('../templates/player-sheet.hbs'),/inventory\.showEquipmentTabs/);
 assert.match(read('../templates/player-sheet.hbs'),/data-storage-board/);
 assert.match(read('../templates/equipment-layout.hbs'),/data-slot-hidden/);
});

test('Complex shape packing respects exact active cells rather than padding a full row',async()=>{
 const {createPlacementScanner,packShapes}=await import('../scripts/core/inventory-shapes.js');
 const config={columns:4,rows:2,activeCells:5};
 const shapes={a:{cells:[{x:0,y:0}]},b:{cells:[{x:0,y:0}]},c:{cells:[{x:0,y:0}]},wide:{cells:[{x:0,y:0},{x:1,y:0}]}};
 const scan=createPlacementScanner(shapes,config);
 for(let i=0;i<4;i++)scan.occupy(['a','b','c','wide'][i],i,0);
 assert.equal(scan.fits('c',5),false);
 const packed=packShapes(['a','b','c','wide'],shapes,config);
 for(const p of Object.values(packed))assert.ok(p.index<5);
});
