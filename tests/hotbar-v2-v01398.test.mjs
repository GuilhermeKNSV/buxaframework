import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beginHotbarTokenSelection, tokenAtHotbarPointer } from '../scripts/apps/hotbar-token-selection.js';
import { defaultHotbarState, normalizeHotbarState } from '../scripts/core/hotbar-state.js';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function canvasHarness() {
  const events = new Map(), docEvents = new Map();
  const bounds = {left:20,top:40,right:820,bottom:640,width:800,height:600};
  const view = { getBoundingClientRect:()=>bounds,
    addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:(name)=>events.delete(name) };
  const actor = {id:'a',isOwner:true};
  const tokens = [
    {actor,document:{id:'t1'},getBounds:()=>({x:100,y:100,width:80,height:80})},
    {actor:{id:'private',isOwner:false},document:{id:'t2'},getBounds:()=>({x:250,y:150,width:60,height:60})}
  ];
  const canvasRef = {ready:true,scene:{id:'scene'},app:{renderer:{canvas:view,screen:{width:800,height:600}}},tokens:{placeables:tokens}};
  const documentRef = { addEventListener:(name,fn)=>docEvents.set(name,fn),removeEventListener:(name)=>docEvents.delete(name) };
  return { canvasRef,documentRef,events,docEvents,tokens };
}

test('GM canvas selector hit-tests real bounds and ignores empty/private areas', () => {
  const h=canvasHarness();
  assert.equal(tokenAtHotbarPointer(150,160,h.canvasRef),h.tokens[0]);
  assert.equal(tokenAtHotbarPointer(290,200,h.canvasRef),null);
  assert.equal(tokenAtHotbarPointer(15,160,h.canvasRef),null);
});
test('GM selection captures exactly one token click, then removes both listeners', () => {
  const h=canvasHarness();let selected=null;
  const stop=beginHotbarTokenSelection({...h,onSelect:token=>selected=token});
  assert.equal(typeof stop,'function');
  h.events.get('pointerdown')({button:0,clientX:40,clientY:80});
  assert.equal(selected,null);
  h.events.get('pointerdown')({button:0,clientX:150,clientY:160,preventDefault(){},stopPropagation(){}});
  assert.equal(selected,h.tokens[0]);
  assert.equal(h.events.size,0);assert.equal(h.docEvents.size,0);
  stop();
});
test('GM selection Escape cancels cleanly, and unavailable scene does not start listeners', () => {
  const h=canvasHarness();let canceled=0;
  beginHotbarTokenSelection({...h,onCancel:()=>canceled++});
  h.docEvents.get('keydown')({key:'Escape',stopPropagation(){}});
  assert.equal(canceled,1);assert.equal(h.events.size,0);
  assert.equal(beginHotbarTokenSelection({canvasRef:{ready:false},documentRef:h.documentRef}),null);
});
test('saved layout retains GM token target and old configs normalize safely', () => {
  const original=defaultHotbarState();
  assert.equal(normalizeHotbarState({...original,activeActorId:'a',activeTokenId:'token-1',activeSceneId:'scene'}).activeTokenId,'token-1');
  assert.equal(normalizeHotbarState({}).activeTokenId,'');
});
test('hotbar view removes branded header and Actor dropdown, adds subtle selection and living fluid', () => {
  const view=read('scripts/apps/hotbar-view.js');
  const css=read('styles/163-hotbar.css');
  assert.doesNotMatch(view,/buxa-hb-brand|buxa-hb-actor-picker/);
  assert.match(view,/buxa-hb-select-label/);
  assert.match(view,/buxa-hb-orb-fluid/);
  assert.match(css,/@keyframes buxa-hb-wave/);
  assert.match(css,/--buxa-hb-orb-size/);
  assert.match(css,/@media \(prefers-reduced-motion:reduce\)/);
});
