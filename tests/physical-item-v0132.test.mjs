import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canDropPhysical,canInteractPhysical,normalizePhysicalArtwork,normalizePhysicalSettings} from '../scripts/core/physical-items.js';
import {applyPhysicalArtworkGeometry} from '../scripts/integrations/physical-item-editor.js';
import {drawPhysicalSelectionBorder} from '../scripts/integrations/physical-item-canvas.js';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const scene={id:'scene',grid:{size:100,distance:5},width:1500,height:1500};
const actors=[{id:'actor',getFlag:(scope,key)=>key==='linkedUsers'?['player']:[]}];
const tokens=[{actorId:'actor',x:0,y:0,width:1,height:1,hidden:false}];
const user={id:'player',isGM:false},gm={id:'gm',isGM:true};

test('distance-limited dropping applies to players, not to GM, and disabled range is unrestricted',()=>{
 const at={x:650,y:500};
 assert.equal(normalizePhysicalSettings({}).playerDropRangeEnabled,false);
 assert.equal(canDropPhysical({user,actorId:'actor',scene,point:at,actors,tokens,settings:{playerDropRangeEnabled:false}}).allowed,true);
 const bounded={playerDropRangeEnabled:true,dropDistance:10};
 assert.equal(canDropPhysical({user,actorId:'actor',scene,point:at,actors,tokens,settings:bounded}).allowed,false);
 assert.equal(canDropPhysical({user,actorId:'actor',scene,point:{x:75,y:50},actors,tokens,settings:bounded}).allowed,true);
 assert.equal(canDropPhysical({user:gm,actorId:'actor',scene,point:at,actors,tokens,settings:bounded}).allowed,true);
 assert.equal(canDropPhysical({user,actorId:'somebodyelse',scene,point:at,actors,tokens,settings:bounded}).allowed,false);
});
test('GM always can move, even when movement disabled, out of range, or no linked token',()=>{
 assert.equal(canInteractPhysical({user:gm,scene,item:{x:1100,y:1100,size:76},settings:{playerMoveEnabled:false,maxMoveDistance:0},actors:[],tokens:[],operation:'move',destination:{x:1200,y:1200}}).allowed,true);
});
test('editor normalizes persistent size, rotation and position and uses a single proportional texture',()=>{
 const draft=normalizePhysicalArtwork({x:123.7,y:222.4,size:900,rotation:470});
 assert.deepEqual(draft,{x:124,y:222,size:800,rotation:110});
 const parent={position:{set(x,y){parent.x=x;parent.y=y;}}};
 const sprite={texture:{width:60,height:150},anchor:{set(v){sprite.anchorX=v;}},position:{set(x,y){sprite.x=x;sprite.y=y;}}};
 applyPhysicalArtworkGeometry({x:24,y:30,size:100,rotation:90},sprite,parent);
 assert.equal(sprite.width,40);assert.equal(sprite.height,100);
 assert.equal(sprite.rotation,Math.PI/2);assert.equal(sprite.x,50);assert.equal(parent.x,24);
});
test('scene border supports legacy PIXI Graphics API and native Item drops suppress Foundry scene embedding',()=>{
 const canvas=source('scripts/integrations/physical-item-canvas.js');
 assert.match(canvas,/graphics\.drawRect/);
 assert.match(canvas,/e\.stopImmediatePropagation\(\)/);
 assert.match(canvas,/handleItemDrop/);
 assert.match(canvas,/applyPhysicalArtworkGeometry/);
 assert.match(source('scripts/integrations/physical-item-transfers.js'),/async function editOnScene/);
 assert.match(source('scripts/apps/gm-physical-panel.js'),/playerDropRangeEnabled/);
 assert.doesNotMatch(source('scripts/apps/physical-item-ui.js'),/data-edit/);
 assert.match(source('scripts/apps/inventory-controls.js'),/showPhysicalDropGhost/);
});

test('legacy Pixi7 right-click border uses drawRect instead of throwing on rect()',()=>{
 const commands=[];
 const pixi7={lineStyle:(width,color,alpha)=>commands.push(['lineStyle',width,color,alpha]),
   drawRect:(...coords)=>commands.push(['drawRect',...coords])};
 drawPhysicalSelectionBorder(pixi7,{width:70,height:44},0xaa55bb);
 assert.deepEqual(commands[1],['drawRect',-37,-24,74,48]);
 const commands8=[];
 const pixi8={rect:(...coords)=>{commands8.push(['rect',...coords]);return pixi8;},stroke:style=>commands8.push(['stroke',style.color])};
 drawPhysicalSelectionBorder(pixi8,{width:30,height:20},0x123456);
 assert.deepEqual(commands8[1],['stroke',0x123456]);
});

test('distance-limited drop measures the source actor, not a different linked token',()=>{
 const extra=[...actors,{id:'other',getFlag:(scope,key)=>key==='linkedUsers'?['player']:[]}];
 const crowd=[...tokens,{actorId:'other',x:20,y:0,width:1,height:1,hidden:false}];
 const allowed=canDropPhysical({user,actorId:'actor',scene,point:{x:150,y:90},actors:extra,tokens:crowd,
   settings:{playerDropRangeEnabled:true,dropDistance:10}});
 assert.equal(allowed.allowed,true);
});
