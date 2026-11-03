import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSheetClickSafety, sheetButtonIdentity, installSheetClickSafety} from '../scripts/core/sheet-click-safety.js';

test('a genuine double-click and a brief click sequence remain responsive', () => {
  const guard=createSheetClickSafety();
  assert.equal(guard.accept('levelUp',0),true);
  assert.equal(guard.accept('levelUp',80),true);
  assert.equal(guard.accept('levelUp',160),true);
  assert.equal(guard.accept('levelUp',240),true);
});

test('auto-click macro enters cooldown, cannot flood sheet mutations, and recovers', () => {
  const guard=createSheetClickSafety();
  let applied=0;
  for(let i=0;i<1000;i++) if(guard.accept('attributeIncrease|attributeId=strength',i*10)) applied++;
  assert.equal(applied,4);
  assert.equal(guard.accept('attributeIncrease|attributeId=strength',10400),false);
  assert.equal(guard.accept('attributeIncrease|attributeId=strength',11500),true);
});

test('cycling across different buttons does not bypass whole-sheet burst protection', () => {
  const guard=createSheetClickSafety();
  let accepted=0;
  for(let i=0;i<50;i++) if(guard.accept(`action=button-${i}`,i*20)) accepted++;
  assert.equal(accepted,12);
  assert.equal(guard.accept('brandNewButton',1001),false);
  assert.equal(guard.accept('brandNewButton',2100),true);
});

test('stable button identity survives redraw, but unrelated attributes are independent', () => {
  const make=(attrs={})=>({localName:'button',dataset:attrs,getAttribute(){return null;}});
  const a=make({action:'attributeIncrease',attributeId:'strength'});
  const redraw=make({action:'attributeIncrease',attributeId:'strength'});
  const b=make({action:'attributeIncrease',attributeId:'dexterity'});
  assert.equal(sheetButtonIdentity(a),sheetButtonIdentity(redraw));
  assert.notEqual(sheetButtonIdentity(a),sheetButtonIdentity(b));
});

test('capture listener blocks a flood before normal button handlers and unbinds safely', () => {
  const subscriptions=new Map();
  const root={
    contains:()=>true,
    addEventListener:(type,listener,capture)=>{assert.equal(capture,true);subscriptions.set(type,listener);},
    removeEventListener:(type,listener)=>{if(subscriptions.get(type)===listener)subscriptions.delete(type);}
  };
  const guard=createSheetClickSafety({perControlLimit:2});
  const button={localName:'button',dataset:{action:'levelUp'},disabled:false,getAttribute:()=>null};
  let blocked=0;
  const makeEvent=()=>({target:{closest:()=>button},preventDefault(){blocked++},stopImmediatePropagation(){},stopPropagation(){}});
  let t=0;
  const oldDateNow=Date.now;
  try {
    Date.now=()=>t;
    const detach=installSheetClickSafety(root,guard);
    subscriptions.get('click')(makeEvent());t=10;
    subscriptions.get('click')(makeEvent());t=20;
    subscriptions.get('click')(makeEvent());
    assert.equal(blocked,1);
    detach();
    assert.equal(subscriptions.has('click'),false);
    const newRoot={...root};
    const detachNew=installSheetClickSafety(newRoot,guard);
    t=30;subscriptions.get('click')(makeEvent());
    assert.equal(blocked,2,'redraw must not reset the limiter');
    detachNew();
  } finally { Date.now=oldDateNow; }
});

test('actor, NPC, and item sheet controllers wire the limiter and a bounded mutation queue', () => {
  const actor=readFileSync(new URL('../scripts/apps/player-sheet.js',import.meta.url),'utf8');
  const npc=readFileSync(new URL('../scripts/apps/npc-sheet.js',import.meta.url),'utf8');
  const item=readFileSync(new URL('../scripts/apps/item-sheet.js',import.meta.url),'utf8');
  assert.match(actor,/installSheetClickSafety\(this\.element, this\._clickSafety\)/);
  assert.match(actor,/this\._pendingMutations >= 5/);
  assert.match(actor,/this\._pendingMutations--/);
  assert.match(npc,/extends BuxaPlayerSheet/);
  assert.match(item,/installSheetClickSafety\(this\.element, this\._clickSafety\)/);
});

test('same sheet action on different item rows has independent click limits',()=>{
  const make=(itemId)=>{
    const owner={dataset:{itemId}};
    const button={localName:'button',dataset:{action:'useItem'},getAttribute:()=>null,closest:()=>owner};
    return button;
  };
  const first=make('potionA'),second=make('potionB');
  assert.notEqual(sheetButtonIdentity(first),sheetButtonIdentity(second));
  assert.equal(sheetButtonIdentity(first),sheetButtonIdentity(make('potionA')));
  const guard=createSheetClickSafety();
  for(let t=0;t<4;t++)assert.equal(guard.accept(sheetButtonIdentity(first),t*20),true);
  assert.equal(guard.accept(sheetButtonIdentity(second),90),true);
  assert.equal(guard.accept(sheetButtonIdentity(first),100),false);
});
