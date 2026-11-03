import test from 'node:test';
import assert from 'node:assert/strict';
import {rotationStart, motionAllowed, animateGhostRotation, cancelGhostRotation} from '../scripts/apps/inventory-drag-motion.js';
import {prepareEquipmentDropMotion, commitEquipmentDropMotion} from '../scripts/apps/equipment-drop-motion.js';

const close = (a,b) => assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`);
test('rotation maps the final footprint back onto the old footprint before easing', () => {
  const before={left:100,top:70,width:58,height:174};
  const after={left:42,top:128,width:174,height:58};
  const start=rotationStart(before,after);
  assert.equal(start.angle,-90);
  assert.equal(start.scaleX,1);assert.equal(start.scaleY,1);
  for(const [x,y] of [[0,0],[174,0],[174,58],[0,58]]) {
    close(after.left+start.x+y,before.left+y);
    close(after.top+start.y-x,before.top+before.height-x);
  }
});
test('rapid turns retain the visible pose and keep turning clockwise through wraparound', () => {
  const angle=-55, radians=angle*Math.PI/180;
  const pose={a:Math.cos(radians),b:Math.sin(radians),c:-Math.sin(radians),d:Math.cos(radians),e:13,f:27};
  const before={left:100,top:50,width:116,height:116}, after={left:158,top:108,width:116,height:116};
  const start=rotationStart(before,after,pose,angle);
  assert.equal(start.angle,-145);
  const r=start.angle*Math.PI/180;
  for(const [x,y] of [[0,0],[116,0],[116,116],[0,116]]){
    const oldX=y,oldY=before.height-x;
    close(after.left+start.x+Math.cos(r)*x-Math.sin(r)*y,before.left+pose.a*oldX+pose.c*oldY+pose.e);
    close(after.top+start.y+Math.sin(r)*x+Math.cos(r)*y,before.top+pose.b*oldX+pose.d*oldY+pose.f);
  }
  assert.equal(rotationStart(before,after,pose,-260).angle,-350);
});
test('reduced motion and missing animation support still perform the logical rotation immediately', () => {
  let calls=0;
  for(const node of [null,{}, {animate(){},ownerDocument:{defaultView:{matchMedia:()=>({matches:true})}}}]){
    assert.equal(motionAllowed(node),false);
    animateGhostRotation(node,()=>calls++);
    cancelGhostRotation(node);
  }
  assert.equal(calls,3);
});
test('inventory destinations and reduced motion never capture an equipment flight', () => {
  assert.equal(prepareEquipmentDropMotion({},'item',{area:'inventory'},null,null),null);
  assert.equal(prepareEquipmentDropMotion({},'item',{area:'equipment'},null,null),null);
});
test('equipment presentation starts only after the actual move resolves', async () => {
  const events=[];let release;
  const result=commitEquipmentDropMotion({complete:value=>events.push(value)},()=>new Promise(resolve=>{release=resolve;}));
  assert.deepEqual(events,[]);
  release(true);assert.equal(await result,true);assert.deepEqual(events,[true]);
});
test('a rejected move is reported to presentation without inventing success', async () => {
  let received;
  assert.equal(await commitEquipmentDropMotion({complete:value=>received=value},async()=>false),false);
  assert.equal(received,false);
});
test('failed persistence cleans the flight and retains the original error', async () => {
  const failure=Error('update failed');let cancelled=0;
  await assert.rejects(commitEquipmentDropMotion({cancel:()=>cancelled++},async()=>{throw failure;}),error=>error===failure);
  assert.equal(cancelled,1);
});
test('failed animation cannot turn a completed equipment move into a failed action', async () => {
  let cancelled=0;
  assert.equal(await commitEquipmentDropMotion({complete(){throw Error('render failed');},cancel:()=>cancelled++},async()=>true),true);
  assert.equal(cancelled,1);
});
