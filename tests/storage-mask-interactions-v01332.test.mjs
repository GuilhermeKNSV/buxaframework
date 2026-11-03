import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {storageRemovalResult} from '../scripts/core/storage-footprint-editor.js';
import {classifyGroundContents, groundCompartmentMarkup} from '../scripts/apps/ground-container-view.js';
import {groundMoveWithin,groundDirectItems} from '../scripts/core/ground-container.js';
const mask={id:'main',storageId:'root:main',mode:'complex',columns:5,rows:5,
  cells:[6,7,8,11,13,16,17,18],color:'#5688aa'};
const datum=name=>({name,img:'icons/svg/item-bag.svg',system:{quantity:1},
  flags:{buxaframework:{item:{shape:{cells:[{x:0,y:0}]}}}}});
const at=(id,index,compartmentId='main')=>({sourceId:id,providerId:'root',compartmentId,index,rotation:0,data:datum(id)});
const makeRecord=contents=>({id:'chest',data:{name:'Chest',flags:{buxaframework:{
  item:{storage:{slots:{external:[mask]}}},backpackContents:contents
}}}});
test('right mouse storage editing preserves a connected, nonempty mask',()=>{
 assert.deepEqual(storageRemovalResult([5,6,9],4,4,6),{allowed:true,cells:[5,9]});
 assert.match(storageRemovalResult([5,6,9],4,4,5).reason,/split/);
 assert.match(storageRemovalResult([6],4,4,6).reason,/at least one/);
 const editor=readFileSync(new URL('../scripts/apps/item-storage-editor.js',import.meta.url),'utf8');
 assert.match(editor,/addEventListener\('pointerdown'/);
 assert.match(editor,/e\.button!==2/);
 assert.match(editor,/addEventListener\('contextmenu'/);
});
test('storage view separates saved items outside a revised custom mask without modifying source',()=>{
 const valid=at('valid',6),stale=at('stale',0);
 const contents=[valid,stale];
 const out=classifyGroundContents([mask],contents);
 assert.deepEqual(out.valid.map(item=>item.sourceId),['valid']);
 assert.deepEqual(out.unplaced.map(item=>item.sourceId),['stale']);
 const bounds={bag:mask,crop:{x:1,y:1,columns:3,rows:3}};
 const markup=groundCompartmentMarkup([bounds],contents,false);
 assert.match(markup,/Items needing placement/);
 assert.match(markup,/data-ground-recovery-item="stale"/);
 assert.match(markup,/data-ground-content-id="stale"/);
 assert.equal(contents[1].index,0,'the view cannot rewrite or delete saved item placement');
});
test('overlapping saved contents do not steal otherwise available grid cells',()=>{
 const results=classifyGroundContents([mask],[at('a',6),at('b',6),at('c',7)]);
 assert.deepEqual(results.valid.map(item=>item.sourceId),['a','c']);
 assert.deepEqual(results.unplaced.map(item=>item.sourceId),['b']);
});
test('unplaced saved content can be moved to a valid cell with no lost contents',()=>{
 const chest=makeRecord([at('stale',0),at('valid',7)]);
 const before=groundDirectItems(chest);
 assert.equal(before.length,2);
 const moved=groundMoveWithin(chest,'stale','root:main',6,0);
 const after=groundDirectItems(moved);
 assert.equal(after.length,2);
 assert.equal(after.find(item=>item.sourceId==='stale').index,6);
 assert.equal(after.find(item=>item.sourceId==='valid').index,7);
 assert.equal(classifyGroundContents([mask],after).unplaced.length,0);
});
test('valid storage layouts do not render any recovery strip',()=>{
 const bounds={bag:mask,crop:{x:1,y:1,columns:3,rows:3}};
 const markup=groundCompartmentMarkup([bounds],[at('gem',7)],false);
 assert.doesNotMatch(markup,/Items needing placement/);
 assert.match(markup,/data-ground-content-id="gem"/);
});
