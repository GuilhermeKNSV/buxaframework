import test from 'node:test';
import assert from 'node:assert/strict';
import {playerSightForPhysicalItem} from '../scripts/core/physical-item-sight-auth.js';
import {physicalItemVisible} from '../scripts/core/physical-item-visibility.js';

const scene={id:'s',tokenVision:true},item={x:100,y:100,size:80};
const actors=[{id:'a',getFlag:(ns,key)=>key==='linkedUsers'?['alice']:null}];
const tokens=[{id:'one',actorId:'a',hidden:false}];
const player={id:'alice',isGM:false};
const mock=fn=>({ready:true,scene,tokens:{placeables:[{document:{id:'one',actorId:'a',hidden:false,sight:{enabled:true}},vision:{testPoint:fn}}]}});
test('GM requester-specific vision cannot use omniscient fallback or another actor',()=>{
 assert.equal(playerSightForPhysicalItem({user:player,scene,item,actors,tokens,canvas:mock(()=>true)}).allowed,true);
 assert.equal(playerSightForPhysicalItem({user:player,scene,item,actors,tokens,canvas:mock(p=>p.x<130)}).allowed,false);
 assert.equal(playerSightForPhysicalItem({user:player,scene,item,actors,tokens,canvas:{ready:true,scene,tokens:{placeables:[]}}}).allowed,false);
 assert.equal(playerSightForPhysicalItem({user:player,scene,item,actors,tokens,canvas:{ready:true,scene:{id:'else'}}}).allowed,false);
 assert.equal(playerSightForPhysicalItem({user:player,scene,item,actors,tokens,canvas:mock(()=>{throw Error('vision');})}).allowed,false);
 assert.equal(playerSightForPhysicalItem({user:{id:'mallory',isGM:false},scene,item,actors,tokens,canvas:mock(()=>true)}).allowed,false);
 assert.equal(playerSightForPhysicalItem({user:player,scene:{...scene,tokenVision:false},item}).allowed,true);
});
test('dense edge sampling hides an item whose thin slice is out of sight',()=>{
 const visibility={tokenVision:true,testVisibility(points){return points[0].x>116;}};
 assert.equal(physicalItemVisible(item,{user:player,scene,visibility}),false);
 assert.equal(physicalItemVisible(item,{user:player,scene,visibility:{tokenVision:true,testVisibility:()=>true}}),true);
});
