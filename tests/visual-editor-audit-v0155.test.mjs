import test from 'node:test';
import assert from 'node:assert/strict';
import { bindItemBoardImageEditor } from '../scripts/apps/item-board-image-editor.js';
import { bindItemSceneFxPreview } from '../scripts/apps/item-scene-fx-preview.js';
import { normalizeItemBoardImage } from '../scripts/core/item-board-image.js';

class FakeNode {
  constructor(name='') {
    this.name=name;this.dataset={};this.value='';this.hidden=false;this.disabled=false;this.textContent='';
    this.style={setProperty:(k,v)=>this.vars.set(k,String(v))};this.vars=new Map();
    this.classes=new Set();this.classList={toggle:(k,on)=>{if(on)this.classes.add(k);else this.classes.delete(k);return !!on},contains:k=>this.classes.has(k)};
    this.attrs=new Map();this.handlers=new Map();this.children=new Map();this.depth=0;this.callCount=0;
  }
  addEventListener(name,fn){if(!this.handlers.has(name))this.handlers.set(name,[]);this.handlers.get(name).push(fn)}
  removeEventListener(name,fn){this.handlers.set(name,(this.handlers.get(name)||[]).filter(x=>x!==fn))}
  dispatchEvent(e){this.callCount++;if(++this.depth>20)throw new Error('Recursive redraw detected');try{for(const cb of this.handlers.get(e.type)||[])cb(e)}finally{this.depth--}}
  setAttribute(k,v){this.attrs.set(k,String(v))}
  getAttribute(k){return this.attrs.get(k)??null}
  toggleAttribute(k,on){if(on)this.attrs.set(k,'');else this.attrs.delete(k)}
  querySelector(s){return this.children.get(s)||null}
  getBoundingClientRect(){return {left:0,top:0,width:500,height:500}}
  closest(){return null}
  click(){this.dispatchEvent({type:'click',button:0,preventDefault(){},stopPropagation(){}})}
}
function fakeFixture(seed=0){
  const root=new FakeNode('root');const map=new Map();
  const add=(selector,name=selector)=>{const el=new FakeNode(name);map.set(selector,el);return el};
  const stage=add('[data-board-image-stage]'); const art=add('[data-board-image-art]');
  const preview=add('[data-board-scene-preview]'); preview.hidden=true;
  const toggle=add('[data-board-preview-toggle]');toggle.setAttribute('aria-pressed','false');
  const beam=new FakeNode('beam');beam.dataset.boardFxTarget='beam';beam.children.set('span',new FakeNode('beamspan'));
  const label=new FakeNode('label');label.dataset.boardFxTarget='label';label.children.set('span',new FakeNode('labelspan'));
  preview.children.set('[data-board-fx-target="beam"]',beam);
  preview.children.set('[data-board-fx-target="label"]',label);
  for(const s of ['[data-board-image-size]','[data-board-image-angle]','[data-board-image-opacity]','[data-board-image-opacity-number]','[data-board-image-opacity-text]','[data-board-image-src]','[data-item-image]','[data-item-rarity]','[data-item-name]','[data-board-fx-reset]'])add(s);
  const selectors=['image','beam','label'].map(name=>{const btn=new FakeNode(name);btn.dataset.boardPreviewSelect=name;return btn});
  root.querySelector=s=>map.get(s)||null;
  root.querySelectorAll=s=>s==='[data-board-preview-select]'?selectors:[];
  root.addEventListener=()=>{};
  const originalWindow=globalThis.window;
  globalThis.window=new FakeNode('window');
  const app={_boardImageDraft:normalizeItemBoardImage({size:20+(seed*7)%780,rotation:(seed*17)%360,opacity:.25+(seed%7)*.1,
    sceneFx:{beam:{x:seed-60,y:60-seed,scale:1+(seed%12)/10},label:{x:seed%40,y:seed%20,scale:.5+(seed%12)/12}}}),
    _configRarities:[{id:'rare',color:'#4599dd'}],item:{name:'Item '+seed},_boardPreviewTarget:'image'};
  map.get('[data-item-rarity]').value='rare';map.get('[data-item-name]').value='Item '+seed;
  return {root,stage,art,preview,toggle,beam,label,selectors,map,app,restore:()=>{globalThis.window=originalWindow}};
}

// These are 120 independent user-input combinations whose old code all enter
// a feedback loop between the board editor redraw and scene-preview selection.
// They are regression SCENARIOS, not 120 unrelated root-cause bugs.
for(let n=0;n<120;n++){
  test(`visual editor interaction remains bounded: size/rotation/rarity/offset scenario ${n+1}`,()=>{
    const f=fakeFixture(n);
    try{
      bindItemBoardImageEditor(f.root,f.app);
      assert.ok(f.stage.callCount<20,'should not recursively emit state changes during redraw');
      f.toggle.click();
      assert.equal(f.preview.hidden,false);
      const selected=f.selectors[n%3];selected.click();
      assert.equal(f.app._boardPreviewTarget,selected.dataset.boardPreviewSelect);
      f.map.get('[data-item-name]').value='Renamed '+n;
      f.map.get('[data-item-name]').dispatchEvent({type:'input'});
      f.map.get('[data-board-image-size]').value=String(20+(n*7)%780);
      f.map.get('[data-board-image-size]').dispatchEvent({type:'input'});
      assert.ok(f.stage.callCount<20);
      assert.equal(f.label.querySelector('span').textContent,'Renamed '+n);
      assert.equal(f.beam.classes.has('is-editing'),n%3===1);
      assert.equal(f.label.classes.has('is-editing'),n%3===2);
      assert.equal(f.art.classes.has('is-editing'),n%3===0);
      f.toggle.click();
      assert.equal(f.preview.hidden,true);
      assert.equal(f.art.classes.has('is-editing'),true);
    }finally{f.restore()}
  });
}
