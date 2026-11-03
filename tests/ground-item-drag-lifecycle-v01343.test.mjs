import test from 'node:test';
import assert from 'node:assert/strict';
import { bindGroundItem } from '../scripts/apps/ground-container-window.js';

class ClassList {
  values=new Set();
  add(value){this.values.add(value);}
  remove(value){this.values.delete(value);}
  contains(value){return this.values.has(value);}
  toggle(value,force){
    const enabled=force??!this.contains(value);
    if(enabled)this.add(value);else this.remove(value);
    return enabled;
  }
}
class FakeElement {
  constructor(){
    this.listeners=new Map();this.classList=new ClassList();this.children=[];
    this.style={setProperty(){},cssText:''};this.dataset={};
  }
  addEventListener(name,fn){this.listeners.set(name,fn);}
  removeEventListener(name,fn){if(this.listeners.get(name)===fn)this.listeners.delete(name);}
  querySelector(){return null;}
  append(...nodes){this.children.push(...nodes);}
  appendChild(node){this.append(node);}
  replaceChildren(...nodes){this.children=nodes;}
  setAttribute(){}
  remove(){this.removed=true;}
  fire(name,event){this.listeners.get(name)?.(event);}
}
const ev=(x,y,extra={})=>({button:0,pointerId:3,clientX:x,clientY:y,
  target:{closest:()=>({dataset:{buxaPieceX:'0',buxaPieceY:'0'}})},
  preventDefault(){},stopPropagation(){},...extra});

// Exercise the actual browser event wiring, not a source-code regular expression.
// In v0.13.42 pointerdown installed the move listener, then its first real move
// threw ReferenceError: el is not defined, leaving contents impossible to drag.
test('ground storage content starts and cancels a real pointer drag without stale listeners',()=>{
  const original={document:globalThis.document,window:globalThis.window};
  const fakeWindow=new FakeElement();
  const body=new FakeElement();
  const fakeDoc={body,createElement:()=>new FakeElement(),createElementNS:()=>new FakeElement(),
    elementFromPoint:()=>null};
  globalThis.window=fakeWindow;globalThis.document=fakeDoc;
  try {
    const tile=new FakeElement();
    const state={dragging:false};
    const entry={sourceId:'axe-1',rotation:0,data:{name:'Axe',img:'axe.png',
      flags:{buxaframework:{item:{shape:{cells:[{x:0,y:0},{x:0,y:1}]}}}}}};
    bindGroundItem(state,tile,entry);
    assert.ok(tile.listeners.has('pointerdown'));
    tile.fire('pointerdown',ev(100,100));
    assert.equal(state.dragging,false);
    fakeWindow.fire('pointermove',ev(102,102));
    assert.equal(state.dragging,false,'less than five pixels does not start drag');
    assert.doesNotThrow(()=>fakeWindow.fire('pointermove',ev(120,125)));
    assert.equal(state.dragging,true);
    assert.equal(tile.classList.contains('is-dragging'),true);
    assert.equal(body.children.length,1,'floating item ghost appears');
    assert.doesNotThrow(()=>fakeWindow.fire('keydown',{key:'r',preventDefault(){}}));
    assert.doesNotThrow(()=>fakeWindow.fire('pointercancel',ev(120,125)));
    assert.equal(state.dragging,false);
    assert.equal(tile.classList.contains('is-dragging'),false);
    assert.equal(body.children[0].removed,true,'drag ghost is discarded');
    assert.equal(fakeWindow.listeners.has('pointermove'),false);
    assert.equal(fakeWindow.listeners.has('pointerup'),false);
  }finally{
    for(const key of Object.keys(original)){
      if(original[key]===undefined)delete globalThis[key];else globalThis[key]=original[key];
    }
  }
});
