import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ITEM_RARITIES } from '../scripts/core/item-config.js';
import { rarityBeamMotion } from '../scripts/core/rarity-beam-geometry.js';
import { resolveRarityVisual } from '../scripts/core/rarity-visuals.js';
import { createPhysicalItemFx, positionPhysicalItemFx, tickPhysicalItemFx } from '../scripts/integrations/physical-item-fx.js';

class Display {
  constructor() {
    this.children=[];this.alpha=1;this.visible=true;
    this.scale={x:1,y:1,set:(x,y=x)=>{this.scale.x=x;this.scale.y=y;}};
    this.position={set:(x,y)=>{this.x=x;this.y=y;}};
  }
  addChild(...children) {this.children.push(...children);return children[0];}
  ellipse(){return this;}circle(){return this;}poly(){return this;}rect(){return this;}
  fill(){return this;}stroke(){return this;}
  lineStyle(){return this;}moveTo(){return this;}lineTo(){return this;}
  bezierCurveTo(){return this;}
}
function withPixi(fn) {
  const previous=globalThis.PIXI;
  globalThis.PIXI={Container:Display,Graphics:Display,BLEND_MODES:{ADD:'add'}};
  try {return fn();} finally { if(previous===undefined) delete globalThis.PIXI; else globalThis.PIXI=previous; }
}
const item=size=>({x:80,y:50,size,data:{name:'Item'}});

test('all default loot rarities animate their beams without requiring Item Animated glow/glint',()=>withPixi(()=>{
  for (const rarity of DEFAULT_ITEM_RARITIES) {
    const noCardEffects={...rarity,animated:false,glint:false};
    const fx=createPhysicalItemFx(item(76),noCardEffects,'beam');
    assert.ok(fx._beam,rarity.id);
    assert.equal(fx._pulseBands.length,2,rarity.id);
    tickPhysicalItemFx(fx,1.0);
    const before=fx._pulseBands[0].node.y;
    const spark=fx._sparks[0]?.node.y;
    tickPhysicalItemFx(fx,2.2);
    assert.notEqual(fx._pulseBands[0].node.y,before,`${rarity.id}: light travels up the beam`);
    assert.notEqual(fx._sparks[0]?.node.y,spark,`${rarity.id}: particle movement is alive`);
    const theme=resolveRarityVisual(noCardEffects);
    assert.notEqual(rarityBeamMotion(theme,1,.1).phase,rarityBeamMotion(theme,2,.1).phase,`${rarity.id}: motion phase changes`);
  }
}));

test('default beams remain proportionate to their items and ground shadows even for large artwork',()=>withPixi(()=>{
  const rarity={id:'masterwork',color:'#df4e56',animated:false,glint:false};
  for(const size of [20,35,76,140,220,500]){
    const fx=createPhysicalItemFx(item(size),rarity,'beam');
    positionPhysicalItemFx(fx,item(size),{width:size,height:size,rotation:0});
    const visualHeight=fx._beamHeight;
    assert.ok(visualHeight>=95 && visualHeight<=280,`size ${size}: beam ${visualHeight}px exceeds limit`);
    const rawWidth=[12,16,20,24,28][fx._rarityTier]*fx._theme.spread;
    const worldWidth=fx._beamScaleX*fx.scale.x*rawWidth;
    assert.ok(worldWidth>=9 && worldWidth<=39,`size ${size}: shaft width ${worldWidth}`);
    // The front strands must follow the same dimensions as the shaft.
    assert.ok(Math.abs(fx._frontFx.scale.x-worldWidth/rawWidth)<1e-7);
    assert.equal(fx._frontFx.scale.y,fx.scale.y*fx._beamScaleY);
    assert.ok(fx._ground.scale.x>0 && fx._ground.scale.y>0,`size ${size}: ground footprint`);
  }
}));

test('shadow-only mode stays steady, while the beam reveal can animate',()=>withPixi(()=>{
  const rarity={id:'common',color:'#9098a6',animated:false,glint:false};
  const shadow=createPhysicalItemFx(item(76),rarity,'shadow');
  tickPhysicalItemFx(shadow,1);
  assert.equal(shadow._beam,null);
  assert.equal(shadow._ground.alpha,1);
  const fx=createPhysicalItemFx(item(76),rarity,'beam');
  fx._reducedMotion=true;
  tickPhysicalItemFx(fx,2);
  assert.equal(fx._pulseBands[0].node.alpha,0,'reduced motion stops traveling light');
}));

test('saved beam scale changes its own dimensions, without resizing the ground',()=>withPixi(()=>{
  const rarity={id:'legendary',color:'#f2ca43'};
  const original=item(76);
  const enlarged={...item(76),data:{flags:{buxaframework:{item:{boardImage:{sceneFx:{beam:{scale:1.7}}}}}}}};
  const one=createPhysicalItemFx(original,rarity,'beam');
  const two=createPhysicalItemFx(enlarged,rarity,'beam');
  assert.ok(two._beamHeight>one._beamHeight);
  assert.equal(two._ground.scale.x,one._ground.scale.x);
}));

test('rarity beam opacity affects animated shaft and light without hiding the ground ring',()=>withPixi(()=>{
  const base={id:'rare',color:'#4d98f0'};
  const off=createPhysicalItemFx(item(76),{...base,beamOpacity:0},'beam');
  const half=createPhysicalItemFx(item(76),{...base,beamOpacity:50},'beam');
  const full=createPhysicalItemFx(item(76),{...base,beamOpacity:100},'beam');
  for (const fx of [off,half,full]) tickPhysicalItemFx(fx,2.7);
  assert.equal(off._beam.alpha,0);
  assert.equal(off._frontFx.alpha,0);
  assert.ok(off._ground.alpha>0);
  assert.ok(half._beam.alpha>0 && half._beam.alpha<full._beam.alpha);
  assert.ok(half._frontFx.alpha>0 && half._frontFx.alpha<full._frontFx.alpha);
  assert.ok(full._beam.alpha>0);
}));
