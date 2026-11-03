import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ITEM_RARITIES } from '../scripts/core/item-config.js';
import { createPhysicalItemFx, tickPhysicalItemFx } from '../scripts/integrations/physical-item-fx.js';
import { createPhysicalItemLabel } from '../scripts/integrations/physical-item-label.js';

class Display {
  constructor() {
    this.children=[];this.alpha=1;this.draws=[];this.listeners={};
    this.position={set:(x,y)=>{this.x=x;this.y=y}};
    this.scale={x:1,y:1,set:(x,y=x)=>{this.scale.x=x;this.scale.y=y}};
    this.anchor={set(){}};
  }
  addChild(...items) {for (const item of items){this.children.push(item);item.parent=this;}return items[0];}
  on(event,handler){this.listeners[event]=handler;return this;}
}
class Graphics extends Display {
  ellipse(){return this;}circle(){return this;}poly(){return this;}rect(){return this;}
  fill(opts){this.draws.push({kind:'fill',...opts});return this;}
  stroke(opts){this.draws.push({kind:'stroke',...opts});return this;}
}
class Text extends Display {
  constructor({text,style}){super();this.text=text;this.style=style;this.width=text.length*8;}
}
const item={id:'shadow',x:90,y:120,size:76,quantity:1,data:{name:'Ruby Sword'}};

test('Shadow draws translucent neutral contact layers and stays steady without animation ticks',()=>{
  const old=globalThis.PIXI;
  try {
    globalThis.PIXI={VERSION:'8.0.0',Container:Display,Graphics,Text,BLEND_MODES:{ADD:'add'}};
    for (const rarity of DEFAULT_ITEM_RARITIES) {
      const fx=createPhysicalItemFx(item,rarity,'shadow');
      assert.ok(fx,`${rarity.id} creates FX`);
      assert.equal(fx._visualMode,'shadow');
      assert.equal(fx._beam,null);
      assert.notEqual(fx._ground.blendMode,'add',`${rarity.id} does not use additive blending`);
      assert.equal(fx._rings.length,4);
      for (const [index,graphic] of fx._rings.entries()) {
        assert.ok(graphic.draws.length>0,`${rarity.id} draws ring layer ${index}`);
        for(const draw of graphic.draws) assert.ok(draw.alpha>0 && draw.alpha<=.25,`${rarity.id} contact layer ${index} is restrained`);
      }
      for(const frame of [0,0.3,2,20,200]) {
        tickPhysicalItemFx(fx,frame);
        assert.equal(fx.alpha,1,`${rarity.id} group opacity`);
        assert.equal(fx._ground.alpha,1,`${rarity.id} ground opacity`);
        for(const graphic of fx._rings) assert.equal(graphic.alpha,1,`${rarity.id} layer opacity`);
      }
    }
  } finally { if(old===undefined)delete globalThis.PIXI;else globalThis.PIXI=old; }
});

test('Shadow loot labels have opaque backgrounds; Beam keeps existing translucent design',()=>{
  const old={PIXI:globalThis.PIXI,game:globalThis.game};
  try {
    globalThis.PIXI={VERSION:'8.0.0',Container:Display,Graphics,Text};
    globalThis.game={user:{isGM:false}};
    for(const rarity of DEFAULT_ITEM_RARITIES){
      const shadow=createPhysicalItemLabel({parent:new Display(),record:item,rarity,visualMode:'shadow'});
      const beam=createPhysicalItemLabel({parent:new Display(),record:item,rarity,visualMode:'beam'});
      const plateAlpha=(label)=>label.children[0].children[1].draws[0].alpha;
      assert.equal(plateAlpha(shadow),1,`${rarity.id} Shadow label`);
      assert.ok(plateAlpha(beam)<1,`${rarity.id} Beam label retains translucency`);
    }
  } finally {
    for (const [key,value] of Object.entries(old)) {
      if(value===undefined) delete globalThis[key];else globalThis[key]=value;
    }
  }
});
