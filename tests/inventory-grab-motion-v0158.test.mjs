import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {grabbedCellFraction, rotateGrabFraction, rotateGrabbedShapeCell} from '../scripts/core/complex-grid-anchor.js';
import {rotationStart, unwrapRotationAngle} from '../scripts/apps/inventory-drag-motion.js';
import {equipmentFlightFrames} from '../scripts/apps/equipment-drop-motion.js';

const eq=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9, `${actual} differs from ${expected}`);
const geometry={left:100,top:90,columns:8,cellSize:50,cellHeight:50};
const picked={x:1,y:0};
const srcRect={left:100,top:90,width:150,height:100};
test('grabbing any point within an occupied cell keeps its exact fractional position',()=>{
  for (const fx of [.01,.08,.25,.5,.83,.98]) for (const fy of [.02,.3,.65,.97]) {
    const x=100+(2+picked.x+fx)*50,y=90+(1+picked.y+fy)*50;
    const result=grabbedCellFraction({pointerX:x,pointerY:y,geometry,originIndex:10,columns:8,grabCell:picked,sourceRect:srcRect,shapeWidth:3,shapeHeight:2});
    eq(result.x,fx);eq(result.y,fy);
  }
});
test('grab fractions and occupied pickup tile return exactly after four rotations, even at edges',()=>{
  for(const x of [.001,.05,.25,.5,.87,.999]) for(const y of [.001,.09,.49,.8,.999]) {
    let frac={x,y},grab={x:1,y:0},height=2;
    for(let i=0;i<4;i++){
      frac=rotateGrabFraction(frac);
      grab=rotateGrabbedShapeCell(grab,height);
      height=i%2===0?3:2;
      assert.ok(frac.x>=0&&frac.x<=1 && frac.y>=0&&frac.y<=1);
    }
    eq(frac.x,x);eq(frac.y,y);assert.deepEqual(grab,{x:1,y:0});
  }
});
test('artwork source fallback honors noncenter pickup and clamps invalid inputs safely',()=>{
  const expected=grabbedCellFraction({pointerX:120,pointerY:105,sourceRect:srcRect,grabCell:{x:0,y:0},shapeWidth:3,shapeHeight:2});
  eq(expected.x,.4);eq(expected.y,.3);
  assert.deepEqual(grabbedCellFraction({pointerX:NaN,pointerY:Infinity}),{x:.5,y:.5});
  const clipped=grabbedCellFraction({pointerX:-200,pointerY:99999,geometry,originIndex:10,columns:8,grabCell:picked});
  assert.deepEqual(clipped,{x:.001,y:.999});
});
test('rotation unwrap preserves clockwise winding after the computed matrix wraps past 180 degrees',()=>{
  const pose=angle=>({a:Math.cos(angle*Math.PI/180),b:Math.sin(angle*Math.PI/180)});
  for (const [actual,expected] of [[-179,-176],[-185,-188],[-255,-249],[-350,-340],[-9,-7],[10,-351]]) {
    eq(unwrapRotationAngle(pose(actual),expected),actual===10 ? -350:actual);
  }
  const start=rotationStart({left:5,top:10,width:58,height:174},{left:-53,top:68,width:174,height:58});
  assert.equal(start.angle,-90);
});
test('equipping a tall weapon uses uniform scaling for both overlaid snapshots',()=>{
  const from={left:100,top:50,width:58,height:174};
  const to={left:540,top:90,width:110,height:110};
  const frames=equipmentFlightFrames(from,to);
  assert.ok(frames);
  for(const leg of [frames.source,frames.arrival]) for(const frame of leg){
    assert.ok(!/NaN|Infinity|scale\([^)]*,/.test(frame.transform),frame.transform);
    assert.match(frame.transform,/scale\([\d.]+\)/);
  }
  assert.equal(frames.source[0].opacity,1);
  assert.equal(frames.source[1].opacity,0);
  assert.equal(frames.arrival[0].opacity,0);
  assert.equal(frames.arrival[1].opacity,1);
  assert.equal(equipmentFlightFrames({left:0,top:0,width:0,height:5},to),null);
});
test('rotating complex items can paint outside the new footprint and stop on scene/storage transitions',()=>{
  const css=readFileSync(new URL('../styles/170-inventory-motion.css',import.meta.url),'utf8');
  assert.match(css,/is-rotating-ghost/);
  assert.match(css,/contain:\s*layout style !important/);
  assert.match(css,/overflow:\s*visible !important/);
  const code=readFileSync(new URL('../scripts/apps/inventory-controls.js',import.meta.url),'utf8');
  assert.match(code,/grabFraction\s*=\s*rotateGrabFraction\(grabFraction\)/);
  assert.match(code,/cancelGhostRotation\(ghost\);\s*ghost.replaceChildren/);
  assert.match(code,/location\?\.area==='equipment'/);
});
