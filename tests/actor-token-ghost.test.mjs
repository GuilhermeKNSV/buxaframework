import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tokenFootprint, actorGhostPlacement, isCanvasDropTarget, ActorTokenGhost } from '../scripts/apps/actor-token-ghost.js';

const actor = {
  img:'portrait.png',
  uuid:'Actor.123',
  prototypeToken:{width:2,height:1,texture:{src:'token.webp'}}
};
const canvasMock = () => ({
  ready:true, dimensions:{size:100},
  canvasCoordinatesFromClient: ({x,y})=>({x:x*2,y:y*2}),
  clientCoordinatesFromCanvas:({x,y})=>({x:x/2,y:y/2}),
  tokens:{getSnappedPoint:({x,y})=>({x:Math.round(x/100)*100,y:Math.round(y/100)*100})}
});

test('token ghost uses prototype token texture and grid footprint rather than portrait', () => {
  assert.deepEqual(tokenFootprint(actor,canvasMock()),{width:200,height:100});
  assert.deepEqual(tokenFootprint({prototypeToken:{width:0,height:-1}},canvasMock()),{width:100,height:100});
  const code = fs.readFileSync(new URL('../scripts/apps/actor-token-ghost.js',import.meta.url),'utf8');
  assert.match(code,/buxa-actor-distance-label/);
  assert.doesNotMatch(code,/buxa-actor-token-ghost-art/);
});

test('snaps the actual token footprint to the grid and converts to browser pixels', () => {
  const cnv=canvasMock();
  const rect=actorGhostPlacement(actor,cnv,{x:173,y:146});
  assert.deepEqual(rect,{x:100,y:100,width:100,height:50});
  assert.deepEqual(actorGhostPlacement(actor,cnv,{x:173,y:146},{snap:false}),{x:123,y:121,width:100,height:50});
  assert.equal(actorGhostPlacement(actor,{ready:false},{x:10,y:10}),null);
  assert.equal(actorGhostPlacement(null,cnv,{x:10,y:10}),null);
});

test('uses the official V14 token placement strategy when present', () => {
  const previous=globalThis.CONFIG;
  let called=0;
  globalThis.CONFIG={Token:{objectClass:{_getDropActorPosition(token,p,options){called++;assert.equal(token,actor.prototypeToken);assert.equal(options.snap,true);return {x:40,y:80};}}}};
  try {
    assert.deepEqual(actorGhostPlacement(actor,canvasMock(),{x:10,y:10}),{x:20,y:40,width:100,height:50});
    assert.equal(called,1);
  } finally {globalThis.CONFIG=previous;}
});

class Element {
  constructor(tagName='DIV') {
    this.tagName=tagName.toUpperCase();this.children=[];this.parent=null;
    this.style={};this.dataset={};this.attrs={};this.draggable=true;
    const names=new Set();
    this.classList={add:n=>names.add(n),remove:n=>names.delete(n),contains:n=>names.has(n)};
    this.isConnected=true;
    this.events=new Map();
  }
  append(child) {this.children.push(child);child.parent=this;}
  remove() {this.removed=true;this.isConnected=false;}
  setAttribute(k,v){this.attrs[k]=v;}
  addEventListener(k,cb){this.events.set(k,cb);}
  contains(node){return this===node||this.children.includes(node);}
}
function mockDOM() {
  const board=new Element('CANVAS');
  const body=new Element('BODY');
  const listeners=new Map();
  const documentRef={body,getElementById:id=>id==='board'?board:null,createElement:t=>new Element(t),addEventListener:(k,cb)=>listeners.set(k,cb)};
  return {board,body,listeners,documentRef};
}

test('shows a single noninteractive token ghost, follows drag, never steals Foundry drop', () => {
  const dom=mockDOM();
  const savedRAF=globalThis.requestAnimationFrame,savedCAF=globalThis.cancelAnimationFrame;
  const frames=[];
  globalThis.requestAnimationFrame=cb=>{frames.push(cb);return frames.length;};
  globalThis.cancelAnimationFrame=()=>{};
  const state=new ActorTokenGhost({documentRef:dom.documentRef,canvasProvider:canvasMock});
  try {
    state.install();state.install();
    assert.equal(dom.listeners.size,5);
    let hidden=false;
    const dnd={setDragImage(){hidden=true;},dropEffect:'move'};
    assert.equal(state.start(actor,{dataTransfer:dnd}),true);
    assert.equal(hidden,true);
    assert.equal(dom.body.children.length,1,'native browser drag image placeholder');
    const event={target:dom.board,clientX:173,clientY:146,shiftKey:false,dataTransfer:dnd,preventDefault(){this.prevented=true;}};
    state.over(event);state.over(event);
    assert.equal(frames.length,1,'DOM updates are throttled to a frame');
    assert.equal(event.prevented,true);
    assert.equal(dnd.dropEffect,'copy');
    frames.shift()();
    assert.equal(dom.body.children.length,2);
    const el=state.element;
    assert.ok(el.classList.contains('is-visible'));
    assert.equal(el.style.width,'0px');
    assert.equal(el.style.height,'0px');
    assert.equal(el.style.transform,'translate3d(150px, 125px, 0)');
    assert.equal(el.children[0].className,'buxa-actor-distance-line');
    assert.equal(el.children[1].className,'buxa-actor-distance-label');
    assert.equal(el.attrs['aria-hidden'],'true');
    assert.match(el.children[1].textContent, /ft/);
    const leave={target:dom.board,relatedTarget:null};
    state.leave(leave);
    assert.equal(el.classList.contains('is-visible'),false);
    state.over(event);frames.shift()();
    // We do not call preventDefault/stopPropagation on drop: Foundry creates the token.
    const dropped={target:dom.board, preventDefault(){throw Error('stole drop');},stopPropagation(){throw Error('stole drop');}};
    state.drop(dropped);
    assert.equal(state.actor,null);
    assert.equal(state.element,null);
    assert.equal(el.classList.contains('is-landing'),true);
    // Finish the landing animation deterministically.
    el.events.get('animationend')();
    assert.equal(el.removed,true);
  } finally {globalThis.requestAnimationFrame=savedRAF;globalThis.cancelAnimationFrame=savedCAF;}
});

test('unrelated drags and off-canvas locations never show a ghost', () => {
  const dom=mockDOM();const instance=new ActorTokenGhost({documentRef:dom.documentRef,canvasProvider:canvasMock});
  const other=new Element('DIV');
  assert.equal(isCanvasDropTarget({target:dom.board},dom.board),true);
  assert.equal(isCanvasDropTarget({target:other},dom.board),false);
  instance.over({target:dom.board,clientX:10,clientY:10,preventDefault(){throw Error('unexpected');}});
  assert.equal(instance.element,null);
  instance.start(actor,{dataTransfer:{setDragImage(){}}});
  instance.over({target:other,preventDefault(){throw Error('not on canvas');}});
  assert.equal(instance.element,null);
  instance.cancel();
  assert.equal(instance.actor,null);
});
