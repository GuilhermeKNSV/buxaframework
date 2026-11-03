import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizePhysicalSettings } from '../scripts/core/physical-items.js';
import { createPhysicalItemFx, tickPhysicalItemFx, positionPhysicalItemFx } from '../scripts/integrations/physical-item-fx.js';

class Container {
  constructor(){this.children=[];this.scale={x:1,y:1,set:(x,y=x)=>{this.scale.x=x;this.scale.y=y;}};this.position={set:(x,y)=>{this.x=x;this.y=y;}};this.alpha=1;}
  addChild(child){this.children.push(child);return child;}
  get destroyed(){return false;}
}
class Graphics extends Container {
  ellipse(){return this;} poly(){return this;} circle(){return this;} fill(){return this;}
}
const item={x:110,y:70,size:76};
const rarity={id:'legendary',color:'#ffaa00',glint:true,animated:true};
test('both visual modes normalize safely and old worlds retain Beam',()=>{
  assert.equal(normalizePhysicalSettings({}).visualMode,'beam');
  assert.equal(normalizePhysicalSettings({visualMode:'shadow'}).visualMode,'shadow');
  assert.equal(normalizePhysicalSettings({visualMode:'unknown'}).visualMode,'beam');
});
test('Beam has animated particles and light; Shadow creates ground glow only',()=>{
  const original=globalThis.PIXI;
  globalThis.PIXI={Container,Graphics};
  try {
    const beam=createPhysicalItemFx(item,rarity,'beam');
    const shadow=createPhysicalItemFx(item,rarity,'shadow');
    assert.ok(beam._beam);
    assert.ok(beam._sparks.length>=3);
    assert.equal(shadow._beam,null);
    assert.equal(shadow._sparks.length,0);
    const before=beam._sparks[0].node.y;
    tickPhysicalItemFx(beam,1);
    assert.notEqual(beam._sparks[0].node.y,before);
    assert.notEqual(beam._beam.alpha,1);
    tickPhysicalItemFx(shadow,1);
    assert.ok(shadow._ground.alpha>0);
    positionPhysicalItemFx(beam,{size:140});
    assert.equal(beam.x,70);
  }finally{if(original===undefined)delete globalThis.PIXI;else globalThis.PIXI=original;}
});
test('the loot UI is a minimal clickable item-name label with GM-only edit affordance',()=>{
  const ui=readFileSync(new URL('../scripts/apps/physical-item-ui.js',import.meta.url),'utf8');
  const config=readFileSync(new URL('../templates/layout-config.hbs',import.meta.url),'utf8');
  assert.match(ui,/buxa-physical-loot-label/);
  assert.match(ui,/data-loot/);
  assert.doesNotMatch(ui,/buxa-physical-loot-card/);
  assert.match(config,/data-physical-item-visual/);
  assert.match(config,/value="shadow"/);
  assert.match(config,/value="beam"/);
});
