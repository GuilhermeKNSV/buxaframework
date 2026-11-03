import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {openPhysicalLootMenu, closePhysicalLootMenu} from '../scripts/apps/physical-item-ui.js';
import {physicalMenuPointer} from '../scripts/integrations/physical-item-canvas.js';
import {createPhysicalItemLabel} from '../scripts/integrations/physical-item-label.js';
import {createPhysicalItemFx} from '../scripts/integrations/physical-item-fx.js';
const record={id:'chest',size:80,quantity:1,data:{name:'Crate',img:'crate.webp'}};
const rarity={id:'rare',label:'RARE',color:'#28d09b'};
class Element {
  constructor(){this.listeners=new Map();this.style={setProperty(){}};this.attributes=new Map();this.buttons=new Map();this.removed=false;}
  setAttribute(key,value){this.attributes.set(key,value);}
  getBoundingClientRect(){return {width:260,height:48};}
  addEventListener(key,fn){this.listeners.set(key,fn);}
  contains(target){return target===this;}
  querySelector(query){if(!this.innerHTML.includes(query.replace(/\[|\]|data-/g,''))){ // fallback exact attribute check
    const key=query.slice(1,-1);if(!this.innerHTML.includes(key))return null;
  }
    if(!this.buttons.has(query))this.buttons.set(query,{disabled:false,addEventListener:(event,fn)=>{this.buttons.get(query).click=fn;}});
    return this.buttons.get(query);
  }
  remove(){this.removed=true;}
}
function mockDOM(){const elements=[],listeners={};return {
  elements,listeners,doc:{body:{append(el){elements.push(el);}},createElement:()=>new Element(),
    addEventListener(key,fn){listeners[key]=fn;},removeEventListener(key,fn){if(listeners[key]===fn)delete listeners[key];}}
};}
test('scene loot label is compact and contextual: storage opens, loot clicks, no extra menu chrome',()=>{
  const prior={document:globalThis.document,window:globalThis.window,game:globalThis.game};
  const dom=mockDOM();let opened=0,edited=0;
  globalThis.document=dom.doc;globalThis.window={innerWidth:1000,innerHeight:760};
  globalThis.game={settings:{get:()=>({lootEnabled:true})}};
  try{
    const ok=openPhysicalLootMenu({item:record,sceneId:'scene',point:{x:100,y:100},rarity,canLoot:true,canEdit:true,
      hasStorage:true,onOpen:()=>opened++,onEdit:()=>edited++});
    assert.equal(ok,true);
    const menu=dom.elements[0];
    assert.equal(dom.elements.length,1,'the canvas owns the rarity beam; the menu adds no overlay beam');
    assert.match(menu.innerHTML,/data-open/);
    assert.doesNotMatch(menu.innerHTML,/data-loot/);
    assert.doesNotMatch(menu.innerHTML,/RARE|Take item|fa-solid|img src/);
    assert.match(menu.innerHTML,/Crate/);
    menu.querySelector('[data-open]').click();
    assert.equal(opened,1);assert.equal(edited,0);assert.equal(menu.removed,true);
    assert.equal(dom.listeners.keydown,undefined);
  }finally{closePhysicalLootMenu();Object.assign(globalThis,prior);}
});
test('scene loot label offers open for storage and loot for normal items',()=>{
  const prior={document:globalThis.document,window:globalThis.window,game:globalThis.game};
  const dom=mockDOM();globalThis.document=dom.doc;globalThis.window={innerWidth:350,innerHeight:240};
  globalThis.game={settings:{get:()=>({lootEnabled:true})}};
  try{
    openPhysicalLootMenu({item:record,sceneId:'scene',point:{x:340,y:220},rarity,
      disableLooting:true,canLoot:true,hasStorage:true});
    assert.match(dom.elements[0].innerHTML,/data-open/);
    assert.doesNotMatch(dom.elements[0].innerHTML,/data-loot/);
    assert.equal(dom.elements[0].style.left,'82px');
    closePhysicalLootMenu();
    openPhysicalLootMenu({item:record,sceneId:'scene',point:{x:10,y:10},rarity,canLoot:true});
    assert.match(dom.elements[1].innerHTML,/data-loot/);
    assert.doesNotMatch(dom.elements[1].innerHTML,/data-edit|data-open|Take item|RARE/);
    const key={key:'Escape',preventDefault(){this.prevented=true;}};
    dom.listeners.keydown(key);
    assert.equal(key.prevented,true);
    assert.equal(dom.elements[1].removed,true);
  }finally{closePhysicalLootMenu();Object.assign(globalThis,prior);}
});
test('scene item pointer translates canvas coordinates and keeps screen-native clicks exact',()=>{
  assert.deepEqual(physicalMenuPointer({nativeEvent:{clientX:32,clientY:46}}),{x:32,y:46});
  const canvas={app:{renderer:{canvas:{getBoundingClientRect(){return {left:20,top:30,width:400,height:200};}},screen:{width:800,height:400}}}};
  assert.deepEqual(physicalMenuPointer({global:{x:120,y:200}},canvas),{x:80,y:130});
  assert.equal(physicalMenuPointer({},canvas),null);
});
test('ground label no longer stacks an uppercase OPEN button above a crate',()=>{
  const original={PIXI:globalThis.PIXI,game:globalThis.game};
  class Node{constructor(opts={}){this.children=[];this.position={set(){}};this.anchor={set(){}};this.listeners={};this.width=90;this.text=opts.text;}
    rect(){return this;}fill(){return this;}addChild(...children){this.children.push(...children);return children[0];}
    on(name,fn){this.listeners[name]=fn;}}
  globalThis.PIXI={VERSION:'8',Text:Node,Graphics:Node,Container:Node};globalThis.game={user:{isGM:false}};
  try {
    const parent=new Node();
    const label=createPhysicalItemLabel({record,parent,rarity,hasStorage:true,onOpen(){}});
    assert.equal(label.children.length,2,'name plate and text only');
    assert.equal(label.children.some(entry=>entry.text==='OPEN'),false);
  }finally{Object.assign(globalThis,original);}
});
test('ground effects keep a neutral shadow instead of a bright opaque rarity pancake',()=>{
  const old=globalThis.PIXI;
  class Node {constructor(){this.children=[];this.position={set(){}};this.scale={set(){}};this.draws=[];}
    ellipse(){return this;}fill(args){this.draws.push(args);return this;}stroke(args){this.draws.push(args);return this;}
    addChild(...xs){this.children.push(...xs);}}
  globalThis.PIXI={Container:Node,Graphics:Node};
  try {
    const fx=createPhysicalItemFx(record,rarity,'shadow');
    assert.ok(fx);assert.equal(fx._beam,null);
    assert.ok(fx._rings[0].draws.every(v=>v.color===0x010307 && v.alpha<.2));
    assert.equal(fx._rings.at(-1).draws[0].color,0x28d09b);
    assert.ok(fx._rings.at(-1).draws[0].alpha<.25);
    const css=readFileSync(new URL('../styles/164-scene-item-menu.css',import.meta.url),'utf8');
    assert.match(css,/\.buxa-scene-item-nameplate/);
    assert.match(css,/prefers-reduced-motion/);
  }finally{if(old===undefined)delete globalThis.PIXI;else globalThis.PIXI=old;}
});


test('scene menu reveals the canvas rarity beam without adding a DOM overlay',()=>{
  const previous={document:globalThis.document,window:globalThis.window,game:globalThis.game};
  const dom=mockDOM();globalThis.document=dom.doc;
  globalThis.window={innerWidth:800,innerHeight:600};
  globalThis.game={settings:{get:()=>({lootEnabled:true})}};
  let reveals=0,closes=0;
  try{
    assert.equal(openPhysicalLootMenu({item:record,sceneId:'scene',point:{x:300,y:250},rarity,canLoot:true,
      onReveal:()=>reveals++,onClose:()=>closes++}),true);
    assert.equal(dom.elements.length,1);
    assert.match(dom.elements[0].innerHTML,/data-loot/);
    assert.equal(reveals,1);
    closePhysicalLootMenu();
    assert.equal(dom.elements[0].removed,true);
    assert.equal(closes,1);
    const css=readFileSync(new URL('../styles/167-item-card-rework.css',import.meta.url),'utf8');
    assert.match(css,/buxa-nameplate-expand/);
  }finally{closePhysicalLootMenu();Object.assign(globalThis,previous);}
});


test('rarity beam stays in the canvas even when a legacy anchor point is supplied',()=>{
  const previous={document:globalThis.document,window:globalThis.window,game:globalThis.game};
  const dom=mockDOM();globalThis.document=dom.doc;
  globalThis.window={innerWidth:800,innerHeight:600};
  globalThis.game={settings:{get:()=>({lootEnabled:true})}};
  try{
    assert.equal(openPhysicalLootMenu({item:record,sceneId:'scene',point:{x:300,y:250},anchorPoint:{x:410,y:155},rarity,canLoot:true}),true);
    assert.equal(dom.elements.length,1);
    assert.match(dom.elements[0].className,/^buxa-physical-loot-label buxa-scene-item-menu\b/);
    assert.ok(dom.elements[0].className.split(' ').includes('buxa-material-etched'));
  }finally{closePhysicalLootMenu();Object.assign(globalThis,previous);}
});

test('scene renderer uses configured rarity visuals and GM E uses the on-scene editor',()=>{
  const code=readFileSync(new URL('../scripts/integrations/physical-item-canvas.js',import.meta.url),'utf8');
  assert.match(code,/createPhysicalItemFx\(item,rarityForItem\(item\),visualMode,\{revealBeam:true\}\)/);
  assert.match(code,/sprite\.on\('pointerover'/);
  assert.match(code,/event\.key\?\.toLowerCase\(\)==='e'/);
  assert.match(code,/openPhysicalItemEditor\(\{record:parent\._buxaRecord,sprite,parent,sceneId:canvas\.scene\.id\}\)/);
});
