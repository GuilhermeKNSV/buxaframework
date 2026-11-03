import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {clampGroundWindowPosition,installGroundWindowHeaderDrag} from '../scripts/apps/ground-container-window.js';

class Listeners {
  constructor(){this.handlers=new Map();this.innerWidth=800;this.innerHeight=600;}
  addEventListener(type,fn){this.handlers.set(type,fn);}
  removeEventListener(type,fn){if(this.handlers.get(type)===fn)this.handlers.delete(type);}
  fire(type,props={}){this.handlers.get(type)?.(props);}
}
const event=(x,y,target={closest:()=>null},pointerId=7)=>({
  button:0,pointerId,clientX:x,clientY:y,target,
  preventDefault(){},stopPropagation(){}
});

test('compact ground window retains every original storage/drag/drop targeting element',()=>{
  const controller=fs.readFileSync(new URL('../scripts/apps/ground-container-window.js',import.meta.url),'utf8');
  const markup=fs.readFileSync(new URL('../scripts/apps/ground-container-view.js',import.meta.url),'utf8');
  const js=controller+'\n'+markup;
  assert.match(js,/buxa-ground-scroll buxa-external-storage-area/);
  assert.match(js,/buxa-storage-compartment buxa-ground-compartment/);
  assert.match(js,/buxa-storage-board-scroll/);
  assert.match(js,/buxa-storage-grid is-complex/);
  assert.match(js,/data-ground-storage-id/);
  assert.match(js,/data-ground-index/);
  assert.match(js,/data-ground-content-id/);
  assert.match(js,/dropInventoryIntoGroundContainer/);
  assert.match(js,/groundContainerTargetFromClient/);
  assert.match(js,/installGroundWindowHeaderDrag\(state,body\.querySelector/);
  assert.match(js,/const multiple=specs\.length>1/);
  assert.match(js,/\$\{multiple\?`<header>/);
});

test('compact panel never reserves an inventory compartment header for a single pouch',()=>{
  const css=fs.readFileSync(new URL('../styles/145-physical-items.css',import.meta.url),'utf8');
  assert.match(css,/width: min\(calc\(var\(--buxa-ground-window-columns, 3\) \* 58px \+ 2px\)/);
  assert.match(css,/\.buxa-ground-container-window\.buxa \.buxa-storage-board-scroll/);
  assert.match(css,/\.buxa-ground-container-window\.buxa \.buxa-storage-compartment\.buxa-ground-compartment/);
  assert.match(css,/height: calc\(var\(--buxa-storage-rows\) \* 58px\)/);
});

test('header-only dragging moves window while leaving grid/item pointer handling alone',()=>{
  const oldWindow=globalThis.window;
  const fakeWindow=new Listeners();globalThis.window=fakeWindow;
  try {
    const head=new Listeners();
    const state={element:{style:{},getBoundingClientRect:()=>({left:200,top:120,width:176,height:218})}};
    installGroundWindowHeaderDrag(state,head);
    head.fire('pointerdown',event(220,135));
    fakeWindow.fire('pointermove',event(300,175));
    assert.equal(state.element.style.left,'280px');
    assert.equal(state.element.style.top,'160px');
    fakeWindow.fire('pointerup',event(300,175));
    assert.equal(state.cancelWindowDrag,null);
    assert.equal(fakeWindow.handlers.has('pointermove'),false);
    head.fire('pointerdown',event(220,135,{closest:()=>true}));
    assert.equal(fakeWindow.handlers.has('pointermove'),false);
  }finally{if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;}
});

test('compact window is clamped without changing drag targets or panel dimensions',()=>{
  assert.deepEqual(clampGroundWindowPosition(-80,-70,176,218,800,600),{left:6,top:6});
  assert.deepEqual(clampGroundWindowPosition(900,900,176,218,800,600),{left:618,top:376});
});

test('ground item drag uses the captured element after pointerdown currentTarget is cleared',()=>{
  const source=fs.readFileSync(new URL('../scripts/apps/ground-container-window.js',import.meta.url),'utf8');
  assert.match(source,/el\.classList\.add\('is-dragging'\)/);
  assert.match(source,/el\.classList\.remove\('is-dragging'\)/);
  assert.doesNotMatch(source,/e\.currentTarget\.classList/);
});
