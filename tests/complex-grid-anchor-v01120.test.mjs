import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPlacementScanner, rotatedCells, shapeBounds } from '../scripts/core/inventory-shapes.js';
import {
  grabbedShapeCell, rotateGrabbedShapeCell, resolveAnchoredComplexPlacement
} from '../scripts/core/complex-grid-anchor.js';

const geom = { left: 100, top: 150, right: 500, bottom: 450, columns: 8, rows: 6, cellSize: 50 };
const L = { cells: [{x:0,y:0},{x:0,y:1},{x:1,y:1}] };
const sword = {cells:[{x:0,y:0},{x:0,y:1},{x:0,y:2}]};
const shapes = {L,sword,coin:{cells:[{x:0,y:0}]},neighbor:{cells:[{x:0,y:0}]}};
const makeScanner = () => createPlacementScanner(shapes,{columns:8,rows:6});
const point = (col,row,dx=.5,dy=.5) => ({ x: geom.left+(col+dx)*50, y:geom.top+(row+dy)*50 });
const place = (scanner,id,anchor,col,row,rotation=0,dx=.5,dy=.5) => {
  const p=point(col,row,dx,dy);
  return resolveAnchoredComplexPlacement(geom,p.x,p.y,anchor,scanner,id,rotation);
};

test('clicking an occupied cell captures its integer footprint coordinates',()=>{
  const cells=rotatedCells(L,0);
  assert.deepEqual(grabbedShapeCell(cells,2,2,92,88,100,100),{x:1,y:1});
  assert.deepEqual(grabbedShapeCell(cells,2,2,20,78,100,100),{x:0,y:1});
  assert.deepEqual(grabbedShapeCell(cells,2,2,0,0,100,100),{x:0,y:0});
  // A hole in an L-shape can never become the origin of an item pickup.
  assert.deepEqual(grabbedShapeCell(cells,2,2,90,5,100,100),{x:0,y:0});
});

test('a multi-cell item places flush beside an occupied item from any grabbed cell',()=>{
  const scanner=makeScanner();
  scanner.occupy('sword',3*8+4,0); // vertical obstacle at (4,3)-(4,5)
  // Place the L immediately to its left at origin (2,3). No search or jumps.
  const anchor={x:1,y:1};
  const p=place(scanner,'L',anchor,3,4);
  assert.equal(p.index,3*8+2);
  assert.equal(p.valid,true);
  assert.equal(p.left,200);
  assert.equal(p.top,300);
  // Even with pointer fraction near the cell border, origin stays identical.
  for (const [dx,dy] of [[.01,.03],[.49,.49],[.99,.99]]) {
    const again=place(scanner,'L',anchor,3,4,0,dx,dy);
    assert.equal(again.index,p.index);
    assert.equal(again.valid,true);
  }
});

test('exact footprint overlap is rejected rather than teleported to nearby free space',()=>{
  const scanner=makeScanner();
  scanner.occupy('sword',3*8+4,0);
  const anchor={x:1,y:1};
  const collision=place(scanner,'L',anchor,4,4);
  assert.equal(collision.index,3*8+3);
  assert.equal(collision.valid,false);
  // One cell to the left resolves to the free origin, with no guessing.
  assert.equal(place(scanner,'L',anchor,3,4).valid,true);
});

test('single-slot items use the exact pointer cell beside large shapes',()=>{
  const scanner=makeScanner();
  scanner.occupy('sword',3*8+4,0);
  assert.equal(place(scanner,'coin',{x:0,y:0},3,3).index,3*8+3);
  assert.equal(place(scanner,'coin',{x:0,y:0},3,3).valid,true);
  assert.equal(place(scanner,'coin',{x:0,y:0},4,3).valid,false);
});

test('rotation retains the occupied grabbed tile under the pointer',()=>{
  const scanner=makeScanner();
  let grip={x:0,y:1};
  let previousBounds=shapeBounds(rotatedCells(L,0));
  const first=place(scanner,'L',grip,5,3,0);
  assert.equal(first.index,2*8+5);
  for(let turn=1;turn<=4;turn++) {
    grip=rotateGrabbedShapeCell(grip,previousBounds.height);
    const cells=rotatedCells(L,turn);
    assert.ok(cells.some(p=>p.x===grip.x&&p.y===grip.y));
    const placed=place(scanner,'L',grip,5,3,turn%4);
    assert.equal(placed.valid,true);
    assert.equal(placed.index,(3-grip.y)*8+5-grip.x);
    previousBounds=shapeBounds(cells);
  }
  assert.deepEqual(grip,{x:0,y:1});
});

test('near borders: no hidden clamping, and cannot commit an out-of-bounds origin',()=>{
  const scanner=makeScanner();
  const outside=place(scanner,'L',{x:1,y:1},0,0);
  assert.equal(outside.valid,false);
  assert.equal(outside.index,null);
  const inside=place(scanner,'L',{x:1,y:1},1,1);
  assert.equal(inside.valid,true);
  assert.equal(inside.index,0);
  assert.equal(resolveAnchoredComplexPlacement(geom,50,175,{x:0,y:0},scanner,'L'),null);
});

test('the live pointer handler uses anchored resolution in both paint and release paths',()=>{
  const src=readFileSync(new URL('../scripts/apps/inventory-controls.js',import.meta.url),'utf8');
  assert.match(src,/grabbedShapeCell\(/);
  assert.match(src,/rotateGrabbedShapeCell\(/);
  assert.match(src,/resolveAnchoredComplexPlacement\(boardGeometry, x, y, grabbedCell/);
  assert.match(src,/const destination = dropAt\(endEvent\.clientX, endEvent\.clientY, underPointer\)/);
  assert.doesNotMatch(src,/return resolveComplexPlacement\(/);
});

test('ghost location and core placement validator agree across crowded boards and every rotation',()=>{
  const scenario = createPlacementScanner({
    moving: L,
    a:{cells:[{x:0,y:0},{x:1,y:0}]},
    b:sword,
    c:{cells:[{x:0,y:0}]}
  }, {columns:8,rows:6});
  scenario.occupy('a',9,0);
  scenario.occupy('b',20,0);
  scenario.occupy('c',43,0);
  for(let rot=0;rot<4;rot++) {
    const rotated=rotatedCells(L,rot);
    for(const grip of rotated) for(let row=0;row<6;row++) for(let col=0;col<8;col++) {
      const at=place(scenario,'moving',grip,col,row,rot);
      assert.equal(at.left, geom.left + (col-grip.x)*geom.cellSize);
      assert.equal(at.top, geom.top + (row-grip.y)*geom.cellSize);
      assert.equal(at.valid, at.index !== null && scenario.fits('moving',at.index,rot));
      // If the drop can commit, every ghost tile lies within the board and
      // is free of occupied spaces. This is the exact preview->save contract.
      if (at.valid) {
        const baseCol=at.index%8,baseRow=Math.floor(at.index/8);
        for(const tile of rotated) {
          assert.ok(baseCol+tile.x>=0 && baseCol+tile.x<8);
          assert.ok(baseRow+tile.y>=0 && baseRow+tile.y<6);
          assert.equal(scenario.occupied.has((baseRow+tile.y)*8+baseCol+tile.x),false);
        }
      }
    }
  }
});
