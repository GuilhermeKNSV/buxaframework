import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhysicalItemLabel} from '../scripts/integrations/physical-item-label.js';
class Display {
 constructor(){this.children=[];this.listeners={};this.position={set:(x,y)=>{this.x=x;this.y=y}};this.anchor={set(){}};}
 addChild(...children){for(const child of children){child.parent=this;this.children.push(child)}return children[0];}
 on(key,handler){this.listeners[key]=handler;}
}
class Graphics extends Display {
 rect(){return this;}fill(){return this;}
}
class Text extends Display {
 constructor({text,style}){super();this.text=text;this.width=text.length*8;this.style=style;}
}
test('ground loot is a permanent single-line world-space item-name label, not a popup card',()=>{
 const prior={PIXI:globalThis.PIXI,game:globalThis.game};
 try {
   globalThis.PIXI={VERSION:'8.0.0',Container:Display,Graphics,Text};
   globalThis.game={user:{isGM:false}};
   const parent=new Display();
   const result=createPhysicalItemLabel({parent,record:{id:'axe',size:70,quantity:2,data:{name:'Crimson Axe'}},rarity:{id:'legendary',color:'#ff8800'}});
   assert.equal(result.parent,parent);
   assert.equal(result.x,35);assert.equal(result.y,-8);
   assert.equal(result.children[1].text,'Crimson Axe x2');
   assert.equal(typeof result.children[0].listeners.pointertap,'function');
   assert.equal(result.children.some(child=>child.text==='Loot'),false);
 }finally{for(const [k,v] of Object.entries(prior))if(v===undefined)delete globalThis[k];else globalThis[k]=v;}
});
test('GM edit glyph is available on the ground label but hidden until right-click',()=>{
 const prior={PIXI:globalThis.PIXI,game:globalThis.game};
 try {
   globalThis.PIXI={VERSION:'8.0.0',Container:Display,Graphics,Text};
   globalThis.game={user:{isGM:true}};
   const result=createPhysicalItemLabel({parent:new Display(),record:{id:'a',size:90,quantity:1,data:{name:'Tool'}},rarity:{id:'rare',color:'#4d98f0'}});
   assert.equal(result.children.length,4);
   assert.equal(result.children[2].visible,false);
   result._buxaToggleEdit(true);
   assert.equal(result.children[2].visible,true);
 }finally{for(const [k,v] of Object.entries(prior))if(v===undefined)delete globalThis[k];else globalThis[k]=v;}
});

test('multiple right-click events cannot immediately close the GM Edit affordance',()=>{
 const old={PIXI:globalThis.PIXI,game:globalThis.game};
 try {
   globalThis.PIXI={VERSION:'8.0.0',Container:Display,Graphics,Text};
   globalThis.game={user:{isGM:true}};
   const label=createPhysicalItemLabel({parent:new Display(),record:{id:'a',size:76,quantity:1,data:{name:'Axe'}},rarity:{id:'rare',color:'#4d98f0'}});
   for(const event of ['pointerdown','rightdown','rightclick']) {
     label.listeners[event]?.({button:2,stopPropagation(){},nativeEvent:{preventDefault(){}}});
   }
   assert.equal(label.children[2].visible,true);
   label._buxaToggleEdit(false);
   assert.equal(label.children[2].visible,false);
 }finally{for(const [key,value]of Object.entries(old)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
