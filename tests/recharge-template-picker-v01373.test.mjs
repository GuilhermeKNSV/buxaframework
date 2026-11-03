import test from 'node:test';
import assert from 'node:assert/strict';
import { createRechargeTemplatePicker, itemFromRechargeDrop, worldItemFromDragData } from '../scripts/apps/item-recharge-template-picker.js';

const item = {id:'gold', uuid:'Item.gold', documentName:'Item', name:'Golden Coin', img:'icons/gold.webp', parent:null};
const other = {id:'silver', uuid:'Item.silver', documentName:'Item', name:'Silver Coin', img:'icons/silver.webp', parent:null};
const world = {get:id=>[item,other].find(i=>i.id===id), contents:[item,other]};
const transfer = (data, mode='copyMove') => ({
  types:['text/plain'],effectAllowed:mode,dropEffect:'none',getData:kind=>kind==='text/plain'?JSON.stringify(data):''
});

test('recharge Item selector only accepts existing World Item templates',()=>{
  assert.equal(worldItemFromDragData({type:'Item',uuid:'Item.gold'},world), item);
  assert.equal(worldItemFromDragData({type:'Item',id:'gold'},world), item);
  for (const payload of [
    {type:'Folder',uuid:'Folder.gold'},
    {type:'Item',uuid:'Actor.actor.Item.gold'},
    {type:'Item',uuid:'Compendium.module.pack.Item.gold'},
    {type:'Item',uuid:'Item.missing'},
    {type:'Actor',uuid:'Actor.gold'}, null
  ]) assert.equal(worldItemFromDragData(payload,world),null);
  assert.equal(itemFromRechargeDrop(transfer({type:'Item',uuid:'Item.silver'}),world),other);
  assert.equal(itemFromRechargeDrop({getData:()=>'{'},world),null);
});

class FakeNode {
  constructor(tag,doc) {this.tagName=tag;this.ownerDocument=doc;this.children=[];this.listeners={};this.dataset={};this.attrs={};this.hidden=false;this.disabled=false;this.value='';this.textContent='';this.classList={set:new Set(),add:n=>this.classList.set.add(n),remove:n=>this.classList.set.delete(n),toggle:(n,on)=>{if(on)this.classList.set.add(n);else this.classList.set.delete(n);}};}
  append(...children) {this.children.push(...children);return this;}
  setAttribute(k,v) {this.attrs[k]=v;}
  addEventListener(k,fn) {this.listeners[k]=fn;}
  dispatchEvent(ev) {this.lastEvent=ev;return true;}
  contains(node) {return this===node||this.children.some(child=>child.contains?.(node));}
  get allChildren() {return [this,...this.children.flatMap(child=>child.allChildren)];}
}
function documentMock() {
  const doc={defaultView:{Event:class {constructor(type,options){this.type=type;this.bubbles=options?.bubbles;}}}};
  doc.createElement=tag=>new FakeNode(tag,doc);
  return doc;
}
function eventFor(data) {return {dataTransfer:data,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;}};}

test('dragging a sidebar World Item onto the small slot saves its id, preserves other settings, and supports clear',()=>{
  const doc=documentMock();
  const field=createRechargeTemplatePicker(doc,'gold',world);
  const slot=field.children[1];
  const [icon,info,clear,input]=slot.children;
  assert.equal(input.dataset.useField,'itemTemplateId');
  assert.equal(input.value,'gold');
  assert.equal(icon.src,'icons/gold.webp');
  assert.equal(info.children[0].textContent,'Golden Coin');
  const over=eventFor(transfer({type:'Item',uuid:'Item.silver'}));
  slot.listeners.dragover(over);
  assert.equal(over.prevented,true);
  assert.equal(over.dataTransfer.dropEffect,'copy');
  assert.equal(slot.classList.set.has('is-drag-over'),true);
  const drop=eventFor(transfer({type:'Item',uuid:'Item.silver'}));
  slot.listeners.drop(drop);
  assert.equal(drop.prevented,true);
  assert.equal(drop.stopped,true);
  assert.equal(input.value,'silver');
  assert.equal(icon.src,'icons/silver.webp');
  assert.equal(input.lastEvent.type,'change');
  assert.equal(slot.classList.set.has('is-drag-over'),false);
  const invalid=eventFor(transfer({type:'Item',uuid:'Actor.char.Item.silver'}));
  slot.listeners.drop(invalid);
  assert.equal(input.value,'silver');
  clear.listeners.click(eventFor(null));
  assert.equal(input.value,'');
  assert.equal(clear.hidden,true);
  assert.equal(info.children[0].textContent,'Drop an Item here');
});

test('existing selection survives missing world source without silently clearing saved template ID',()=>{
  const field=createRechargeTemplatePicker(documentMock(),'missing',world);
  const slot=field.children[1];
  assert.equal(slot.children[3].value,'missing');
  assert.equal(slot.classList.set.has('is-missing'),true);
});
