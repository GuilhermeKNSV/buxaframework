import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeItemShape, rotatedCells, canPlaceShape } from '../scripts/core/inventory-shapes.js';
import { shapeArtworkGeometry, shapeArtworkStyle, shapeMaskUrl } from '../scripts/core/shape-artwork.js';
const source = path => fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
test('L-shaped item uses a single mask covering exactly occupied squares',()=>{
 const shape={cells:[{x:0,y:0},{x:1,y:0},{x:0,y:1}]};
 const info=shapeArtworkGeometry(shape);
 assert.equal(info.width,2);assert.equal(info.height,2);
 const svg=decodeURIComponent(info.mask.split(',')[1]);
 assert.equal((svg.match(/<rect /g)||[]).length,3);
 assert.match(svg,/viewBox="0 0 200 200"/);
 assert.ok(!svg.includes('x="100" y="100"'));
 assert.match(shapeArtworkStyle(shape),/mask-image:url/);
});
test('rotating rectangular artwork swaps width and height without stretching',()=>{
 const shape={cells:[{x:0,y:0},{x:0,y:1},{x:0,y:2}],imageX:70,imageY:50,imageRotation:20};
 const g=shapeArtworkGeometry(shape,1);
 assert.deepEqual([g.width,g.height],[3,1]);
 assert.equal(g.imageWidth,100);
 assert.equal(g.imageHeight,300);
 assert.equal(g.imageRotation,110);
 assert.equal(g.imageX,0);assert.equal(g.imageY,20);
 assert.deepEqual(rotatedCells(shape,4),rotatedCells(shape,0));
 const manual=shapeArtworkGeometry({...shape,imageRotation:90},0);
 assert.equal(manual.imageHeight,100);
 assert.equal(manual.imageWidth,300);
});
test('new artwork rotation round trips with old item defaults',()=>{
 assert.equal(normalizeItemShape(null).imageRotation,0);
 assert.equal(normalizeItemShape({imageRotation:400}).imageRotation,40);
 assert.equal(normalizeItemShape({imageRotation:-30}).imageRotation,330);
});
test('all occupied footprint cells participate in collision checks',()=>{
 const shape={cells:[{x:0,y:0},{x:1,y:0},{x:0,y:1}]};
 const placements={existing:{area:'inventory',index:1}};
 const shapes={existing:{cells:[{x:0,y:0}]},moving:shape};
 const cfg={columns:4,rows:4};
 assert.equal(canPlaceShape(placements,shapes,'moving',0,0,cfg),false);
 assert.equal(canPlaceShape(placements,shapes,'moving',4,0,cfg),true);
});
test('inventory, drag ghost and size editor share a single image renderer',()=>{
 const tpl=source('templates/player-sheet.hbs'),ctl=source('scripts/apps/inventory-controls.js'),editor=source('scripts/apps/item-shape-editor.js');
 assert.match(tpl,/class="buxa-complex-art"/);
 assert.doesNotMatch(tpl,/class="buxa-complex-piece"[^>]*><img/);
 assert.match(ctl,/shapeArtworkStyle\(shape,\s*rotation\)/);
 assert.match(ctl,/grabbedX/);
 assert.match(editor,/shapeArtworkStyle\(s\)/);
 assert.match(editor,/pointermove/);
 assert.match(source('templates/item-config.hbs'),/data-item-shape-grid/);
 assert.doesNotMatch(source('templates/item-config.hbs'),/data-item-shape-scale-number/);
});
