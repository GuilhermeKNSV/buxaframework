import { resolveRarityVisual } from '../core/rarity-visuals.js';
import { rarityBeamTraces, rarityBeamMotion } from '../core/rarity-beam-geometry.js';
/** Rarity-tiered ARPG effects for dropped items.
 * The ground footprint follows each sprite's visible geometry; the beam,
 * ornament count and reveal motion grow by rarity tier.
 * One canvas ticker updates transforms; no scene writes occur per frame. */
import { rarityTier } from '../core/rarity-tier.js';
import { itemBoardImageOf } from '../core/item-board-image.js';
import { groundFxSize } from '../core/scene-item-visual-layout.js';

const tint = value => /^#[0-9a-f]{6}$/i.test(String(value)) ? Number.parseInt(value.slice(1), 16) : 0x91acc4;
const clamp = (n,min,max) => Math.min(max,Math.max(min,n));
const blend = (a,b,t) => {
  const ch=shift=>Math.round(((a>>shift)&255)*(1-t)+((b>>shift)&255)*t);
  return (ch(16)<<16)|(ch(8)<<8)|ch(0);
};
const ADD_BLEND = globalThis.PIXI?.BLEND_MODES?.ADD;
function ellipse(g, x, y, rx, ry, color, alpha) {
  if (typeof g.ellipse === 'function' && typeof g.fill === 'function')
    g.ellipse(x,y,rx,ry).fill({color,alpha});
  else if (typeof g.drawEllipse === 'function') {
    g.beginFill(color,alpha);g.drawEllipse(x,y,rx,ry);g.endFill();
  }
}
function ring(g, x, y, rx, ry, width, color, alpha) {
  if (typeof g.ellipse === 'function' && typeof g.stroke === 'function')
    g.ellipse(x,y,rx,ry).stroke({color,width,alpha});
  else if (typeof g.drawEllipse === 'function' && typeof g.lineStyle === 'function') {
    g.lineStyle(width,color,alpha);g.drawEllipse(x,y,rx,ry);
  }
}
function polygon(g, coords, color, alpha) {
  if (typeof g.poly === 'function' && typeof g.fill === 'function')
    g.poly(coords,true).fill({color,alpha});
  else if (typeof g.drawPolygon === 'function') {
    g.beginFill(color,alpha);g.drawPolygon(coords);g.endFill();
  }
}
function disc(g, x, y, r, color, alpha) {
  if (typeof g.circle === 'function' && typeof g.fill === 'function')
    g.circle(x,y,r).fill({color,alpha});
  else if (typeof g.drawCircle === 'function') {
    g.beginFill(color,alpha);g.drawCircle(x,y,r);g.endFill();
  }
}
function linePath(g, points, width, color, alpha) {
  if (typeof g.lineStyle !== 'function' || typeof g.moveTo !== 'function') return;
  g.lineStyle(width,color,alpha);
  g.moveTo(points[0][0], points[0][1]);
  if (typeof g.bezierCurveTo === 'function' && points.length===4) {
    g.bezierCurveTo(points[1][0],points[1][1],points[2][0],points[2][1],points[3][0],points[3][1]);
    return;
  }
  for (let i=1;i<points.length;i++) g.lineTo(points[i][0], points[i][1]);
}
function addBlend(node) {
  if (ADD_BLEND !== undefined) node.blendMode = ADD_BLEND;
  return node;
}
export function createPhysicalItemFx(record, rarity, visualMode='beam', { revealBeam = false } = {}) {
  const pixi=globalThis.PIXI;
  if (typeof pixi?.Container !== 'function' || typeof pixi?.Graphics !== 'function') return null;
  const fx=new pixi.Container();
  fx.label='Buxa ground rarity light';
  fx.eventMode='none';fx.interactiveChildren=false;
  const theme=resolveRarityVisual(rarity);
  fx._theme=theme;
  const color=tint(theme.glowColor);
  const tier=rarityTier(rarity);
  const rarityId=String(rarity?.id||'common').toLowerCase();
  const divine=['divine','godly','transcendent'].includes(rarityId);
  // Refined to the actual visible sprite bounds in positionPhysicalItemFx.
  const factor=groundFxSize(Number(record?.size)||76,Number(record?.size)||76,tier).factor;
  const shadowOnly=visualMode==='shadow';
  // Fine beam strands and motes sit above the artwork; the light shaft stays
  // in the back layer so the item remains the focal point.
  const frontFx=new pixi.Container();
  frontFx.label='Buxa item light wisps';
  frontFx.eventMode='none';frontFx.interactiveChildren=false;
  frontFx.visible=!shadowOnly;

  // Contact shadow is neutral and translucent; Beam mode retains additive light.
  const ground=shadowOnly ? new pixi.Container() : addBlend(new pixi.Container());
  const outer=new pixi.Graphics();
  const mid=new pixi.Graphics();
  const inner=new pixi.Graphics();
  const outline=new pixi.Graphics();
  if (shadowOnly) {
    // Neutral translucent contact shadow: never a solid neon oval beneath a
    // chest. Rarity is present only as a restrained edge accent.
    ellipse(outer,0,0,31+tier,9.6+tier*.35,0x010307,.13);
    ellipse(mid,0,0,25+tier,7.4+tier*.3,blend(0x020409,color,.07),.20);
    ellipse(inner,0,0,17+tier*.6,5+tier*.2,0x02050a,.25);
    ring(outline,0,0,24+tier,7.1+tier*.3,1.1,tint(rarity?.color),.18);
  } else {
    ellipse(outer,0,0,28+tier*2,10+tier,blend(color,0x000000,.23),.2);
    ellipse(mid,0,0,22+tier*2,7.4+tier*.7,color,.26);
    ellipse(inner,0,0,14+tier*1.6,4.6+tier*.4,blend(color,0xffffff,.2),.34);
    ring(outline,0,0,20+tier*2,6.8+tier*.55,1.8,blend(color,0xffffff,.14),.54);
  }
  ground.addChild(outer,mid,inner,outline);
  fx.addChild(ground);
  fx._ground=ground; fx._rings=[outer,mid,inner,outline];

  fx._beam=null;fx._wisps=[];fx._sparks=[];fx._groundMarks=[];fx._ripples=[];fx._rays=[];fx._pulseBands=[];
  const rippleLayer=new pixi.Container();rippleLayer.visible=false;
  if(tier>=1)for(let i=0;i<(tier>=3?2:1);i++){
    const ripple=new pixi.Graphics();
    ring(ripple,0,0,29+tier*2,9+tier*.5,1+tier*.25,blend(color,0xffffff,.2),.72);
    rippleLayer.addChild(ripple);fx._ripples.push(ripple);
  }
  if(fx._ripples.length){ground.addChild(rippleLayer);fx._rippleLayer=rippleLayer;}
  if (!shadowOnly || revealBeam) {
    const h=[120,170,225,285,350][tier];
    const tip=h*.055;
    const beamWidth=[12,16,20,24,28][tier]*theme.spread;
    fx._beamHeight=h+tip;
    const beam=addBlend(new pixi.Container());beam.eventMode='none';beam.interactiveChildren=false;
    beam.visible=!shadowOnly;
    if(tier>=2){
      const rayCount=theme.rays || (divine?12:4);
      for(let i=0;i<rayCount;i++){
        const ray=addBlend(new pixi.Graphics());
        const spread=(i-(rayCount-1)/2)/(rayCount-1);
        polygon(ray,[-beamWidth*.12,0,-beamWidth*.08,-h*.6,beamWidth*.18,-h*.34,beamWidth*.12,0],
          blend(color,0xffffff,divine?.56:.18),divine?.12:tier===4?.09:.055);
        // Keep rays inside the local footprint instead of spreading into a giant cone.
        ray.rotation=spread*(tier===4 ? .25 : .18);
        beam.addChild(ray);fx._rays.push({node:ray,seed:i/rayCount,base:ray.rotation});
      }
    }
    const haze=new pixi.Graphics();
    polygon(haze,[-beamWidth*1.35,0,-beamWidth*.75,-h*.36,-beamWidth*.44,-h*.76,-beamWidth*.18,-h*.94,
      0,-h-tip,beamWidth*.18,-h*.94,beamWidth*.44,-h*.76,beamWidth*.75,-h*.36,beamWidth*1.35,0],color,0.07+tier*.014);
    const glow=new pixi.Graphics();
    polygon(glow,[-beamWidth*.72,0,-beamWidth*.48,-h*.32,-beamWidth*.31,-h*.74,-beamWidth*.11,-h*.95,
      0,-h-tip*.9,beamWidth*.11,-h*.95,beamWidth*.31,-h*.74,beamWidth*.48,-h*.32,beamWidth*.72,0],blend(color,0xffffff,.16),0.13+tier*.018);
    const core=new pixi.Graphics();
    polygon(core,[-Math.max(1.6,beamWidth*.14),0,-beamWidth*.12,-h*.3,-beamWidth*.08,-h*.74,-beamWidth*.045,-h*.95,
      0,-h-tip,beamWidth*.045,-h*.95,beamWidth*.08,-h*.74,beamWidth*.12,-h*.3,Math.max(1.6,beamWidth*.14),0],0xffffff,0.36+tier*.035);
    beam.addChild(haze,glow,core);
    // Traveling shaft highlights are essential for low-rarity beams: without
    // these, plain graphics polygons look static even while softly pulsing.
    // Build two lightweight graphics objects once, move them on the ticker.
    for (let i=0; i<2; i++) {
      const band=addBlend(new pixi.Graphics());
      const bandW=Math.max(1.5,beamWidth*.12);
      polygon(band,[-bandW,11,0,-13,bandW,11,0,4],0xffffff,i===0?.42:.25);
      beam.addChild(band);
      fx._pulseBands.push({node:band,offset:i*.53,height:h});
    }
    const engraving=addBlend(new pixi.Graphics());
    for (const path of rarityBeamTraces(theme,h,beamWidth)) {
      // Explicit polylines preserve the sharp prism/forge silhouettes.
      if (typeof engraving.moveTo !== 'function') break;
      engraving.lineStyle?.(1.2,blend(color,0xffffff,.35),.46);
      engraving.moveTo(path[0][0],path[0][1]);
      for(const point of path.slice(1)) engraving.lineTo?.(point[0],point[1]);
      if(typeof engraving.lineStyle !== 'function') engraving.stroke?.({width:1.2,color:blend(color,0xffffff,.35),alpha:.46});
    }
    beam.addChild(engraving);
    fx._identityTraces=engraving;

    for (const side of [-1,1]) {
      const wispWrap=new pixi.Container();
      const bright=new pixi.Graphics();
      linePath(bright, [[side*beamWidth*.2,-8],[side*(beamWidth*.4+tier),-h*.26],[side*(beamWidth*.64+tier*1.4),-h*.58],[side*(beamWidth*.4+tier*.7),-h*.95]], 1.3+tier*.08, 0xffffff, 0.32);
      const soft=new pixi.Graphics();
      linePath(soft, [[side*beamWidth*.4,-2],[side*(beamWidth*.7+tier*1.4),-h*.24],[side*(beamWidth+tier*2),-h*.56],[side*(beamWidth*.65+tier*1.2),-h*.92]], 2.2+tier*.16, color, 0.24);
      wispWrap.addChild(soft,bright);
      wispWrap.alpha=0.74;
      frontFx.addChild(wispWrap);
      fx._wisps.push({node:wispWrap,side,seed:side<0?0.7:2.05});
    }
    fx.addChild(beam);fx._beam=beam;fx._beamHeight=h+tip;fx._beamGeometryHeight=h+tip;

    // Faceted ground marks make uncommon-and-better drops read as crafted
    // rarity tiers without putting another opaque layer over the item art.
    if (tier >= 2) {
      const marks = new pixi.Container();
      for (const side of [-1, 1]) for (const forward of [-1, 1]) {
        const mark = addBlend(new pixi.Graphics());
        const size = tier >= 4 ? 3.2 : 2.5;
        polygon(mark, [0,-size,size*.62,0,0,size,-size*.62,0], blend(color,0xffffff,.24), .58);
        mark.position.set(side * (25 + tier * 1.2), forward * (3 + tier * .35));
        marks.addChild(mark);
        fx._groundMarks.push({node:mark,seed:(side < 0 ? .7 : 2.05) + (forward < 0 ? 1.1 : 0)});
      }
      marks.visible=!shadowOnly;
      fx.addChild(marks);
      fx._groundOrnaments=marks;
    }

    const sparkCount=divine?14:Math.min(12, 3+tier*2);
    const sparkLayer=new pixi.Container();sparkLayer.visible=!shadowOnly;
    for (let i=0;i<sparkCount;i++) {
      const g=addBlend(new pixi.Graphics());
      disc(g,0,0,i%3===0?1.9:1.15,i%3===0?0xffffff:blend(color,0xffffff,.28),.9);
      sparkLayer.addChild(g);
      fx._sparks.push({node:g,seed:i*1.761+(Number(record?.x)||0)*.001+(Number(record?.y)||0)*.0007,rise:62+tier*18});
    }
    frontFx.addChild(sparkLayer);fx._sparkLayer=sparkLayer;
  }
  fx._visualMode=shadowOnly ? 'shadow' : 'beam';
  fx._rarityId=rarityId;
  fx._isDivine=divine;
  fx._frontFx=frontFx;
  fx._rarityTier=tier;
  fx._reducedMotion=Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  fx._phase=((Number(record?.x)||0)*.016+(Number(record?.y)||0)*.009)%6.283;
  fx._baseOpacity=clamp(.77+tier*.055,.77,.99);
  const rawBeamOpacity=Number(rarity?.beamOpacity ?? 100);
  fx._beamOpacity=clamp(Number.isFinite(rawBeamOpacity)?rawBeamOpacity:100,0,100)/100;
  fx._baseSize=factor;
  fx.scale.set(factor);
  positionPhysicalItemFx(fx,record);
  return fx;
}
export function positionPhysicalItemFx(fx,record,sprite=null) {
  if (!fx) return;
  const size=Math.max(20,Number(record?.size)||76);
  const angle=Number(sprite?.rotation)||0;
  const artWidth=sprite ? Math.abs(Number(sprite.width)||size) : size;
  const artHeight=sprite ? Math.abs(Number(sprite.height)||size) : size;
  // Fit the ground bloom to the item's footprint, including its rotation.
  const visibleWidth=Math.abs(Math.cos(angle))*artWidth+Math.abs(Math.sin(angle))*artHeight;
  const visibleHeight=sprite ? Math.abs(Math.cos(angle))*artHeight+
    Math.abs(Math.sin(angle))*artWidth : size;
  const maxDimension=Math.max(visibleWidth,visibleHeight,1);
  const safe=groundFxSize(visibleWidth,visibleHeight,fx._rarityTier);
  const factor=safe.factor;
  const visual=itemBoardImageOf(record?.data).sceneFx.beam;
  const footprintScale=clamp(visibleWidth/maxDimension,.08,1);
  fx._baseSize=factor;
  fx._groundScaleX=safe.groundX;
  fx._groundScaleY=safe.groundY;
  fx._ground?.scale?.set?.(fx._groundScaleX,fx._groundScaleY);
  // An independent lower bound prevents very small coins from collapsing the
  // shaft and its base ring into a near-invisible sliver.
  // The ground uses the item's visible footprint, while the beam is a separate
  // sized effect. Never scale a 350px high beam by a 2-3x item scale: doing so
  // produced beams larger than the scene and left the ground ring tiny by
  // comparison. Scene overrides can still enlarge/reposition the beam.
  const baseBeamWidth=([12,16,20,24,28][fx._rarityTier]||12) * (fx._theme?.spread || 1);
  const artSize=Math.max(visibleWidth,visibleHeight);
  const intensity=[1.35,1.55,1.75,1.9,2.05][fx._rarityTier] || 1.55;
  const height=clamp(artSize*intensity,95,280);
  const width=clamp(Math.min(visibleWidth,artSize)*.30,10,38);
  const originalHeight=fx._beamGeometryHeight || fx._beamHeight || 170;
  const scale=visual.scale;
  fx._beamScaleX=width/(Math.max(1,baseBeamWidth)*factor)*scale;
  fx._beamScaleY=height/(Math.max(1,originalHeight)*factor)*scale;
  fx._beamHeight=height*scale; // Canvas label position follows the displayed beam.
  // Front wisps and motes are siblings of the beam. Match their transforms to
  // the beam instead of leaving them at the old unbounded geometry size.
  fx._frontFx?.scale?.set?.(factor*fx._beamScaleX,factor*fx._beamScaleY);
  fx.scale?.set?.(factor);
  fx._beam?.scale?.set?.(fx._beamScaleX,fx._beamScaleY);
  fx._groundOrnaments?.scale?.set?.(footprintScale,footprintScale);
  fx._sparkLayer?.scale?.set?.(footprintScale,1);
  const y=size/2+Math.max(1,visibleHeight)/2;
  fx.position?.set?.(size/2+visual.x,y+visual.y);
  fx._frontFx?.position?.set?.(size/2+visual.x,y+visual.y);
}
/** Replay a short rarity-scaled reveal when a player opens the ground-item menu. */
export function revealPhysicalItemFx(fx,seconds=0) {
  if (!fx || fx.destroyed || (fx._visualMode === 'shadow' && !fx._beam)) return;
  fx._menuReveal=true;
  fx._rippleAt=Number(seconds)||0;
  if (fx._frontFx && !fx._reducedMotion) fx._frontFx.alpha=0;
  for (const {node} of fx._sparks) node.alpha=0;
  if (fx._beam && !fx._reducedMotion) { fx._beam.alpha=0;fx._beam.scale.set(fx._beamScaleX||1,(fx._beamScaleY||1)*.08); }
  if (fx._beam) fx._beam.visible=true;
  if (fx._frontFx) fx._frontFx.visible=true;
  if (fx._groundOrnaments) fx._groundOrnaments.visible=true;
  if (fx._sparkLayer) fx._sparkLayer.visible=true;
  if (fx._rippleLayer) fx._rippleLayer.visible=!fx._reducedMotion;
  for(const ripple of fx._ripples||[])ripple.scale.set(.3,.3);
  fx._revealAt = fx._reducedMotion ? null : Number(seconds) || 0;
  if (fx._reducedMotion) {
    fx.alpha = 1;
    if (fx._frontFx) fx._frontFx.alpha=(fx._visualMode==='shadow' ? 0.95 : Math.min(1,fx._baseOpacity+.08))*fx._beamOpacity;
    if (fx._beam) { fx._beam.alpha = fx._baseOpacity*fx._beamOpacity; fx._beam.scale.set(fx._beamScaleX||1,fx._beamScaleY||1); }
    return;
  }
}
/** Hide the click-only beam again when the configured mode is shadow. */
export function hidePhysicalItemFxReveal(fx) {
  if (!fx || fx._visualMode !== 'shadow') return;
  fx._menuReveal=false;
  if (fx._beam) fx._beam.visible=false;
  if (fx._frontFx) fx._frontFx.visible=false;
  if (fx._groundOrnaments) fx._groundOrnaments.visible=false;
  if (fx._sparkLayer) fx._sparkLayer.visible=false;
  if (fx._rippleLayer) fx._rippleLayer.visible=false;
  fx._rippleAt=null;
  fx._revealAt=null;
}
export function tickPhysicalItemFx(fx,seconds) {
  if (!fx || fx.destroyed) return;
  const shadow=fx._visualMode === 'shadow';
  if (shadow) {
    // No fading/pulsing in Shadow mode, regardless of rarity or frame time.
    fx.alpha=1;
    fx._ground.alpha=1;
    fx._ground.scale.set(fx._groundScaleX||1,fx._groundScaleY||1);
    for (const layer of fx._rings||[]) if (layer) layer.alpha=1;
    if (!fx._menuReveal || !fx._beam) return;
  }
  // Animated glow/glint are *item card* options, not the scene beam's motion
  // switch. Common through Epic had both off and were frozen on every tick.
  if (fx._reducedMotion) {
    if (!shadow) {
      fx._ground.alpha=1;
      fx._ground.scale.set(fx._groundScaleX||1,fx._groundScaleY||1);
    }
    for (const layer of fx._rings||[]) if (layer) layer.alpha=1;
    if (fx._frontFx) fx._frontFx.alpha=(fx._visualMode==='shadow' ? 0.95 : Math.min(1,fx._baseOpacity+.08))*fx._beamOpacity;
    if (fx._beam) { fx._beam.alpha=fx._baseOpacity; fx._beam.scale.set(fx._beamScaleX||1,fx._beamScaleY||1); }
    for (const wisp of fx._wisps) wisp.node.alpha=.74;
    for (const mark of fx._groundMarks) mark.node.alpha=.58;
    for (const {node} of fx._sparks) node.alpha=0;
    for (const {node} of fx._pulseBands||[]) node.alpha=0;
    return;
  }
  const ambientTime=seconds;
  const speed=fx._theme?.speed > 0 ? fx._theme.speed : .65;
  const t=ambientTime*speed+fx._phase;
  const pulse=Math.sin(t*2.12);
  if (!shadow) {
    fx._ground.alpha=.88+.12*pulse;
    fx._ground.scale.set((fx._groundScaleX||1)*(1+.05*pulse),(fx._groundScaleY||1)*(1+.035*pulse));
    const [outer,mid,inner,outline]=fx._rings||[];
    if (outer) outer.alpha = 0.24 + 0.05*Math.sin(t*1.6);
    if (mid) mid.alpha = 0.28 + 0.06*Math.sin(t*1.8+0.4);
    if (inner) inner.alpha = 0.36 + 0.08*Math.sin(t*2.2+0.9);
    if (outline) outline.alpha = 0.52 + 0.08*Math.sin(t*1.4+0.2);
  }
  if (!fx._beam) return;
  let reveal=1;
  if (Number.isFinite(fx._revealAt)) {
    const duration=[.28,.38,.52,.72,.94][fx._rarityTier];
    const p=clamp((seconds-fx._revealAt)/duration,0,1);
    const ease=1-Math.pow(1-p,3);
    reveal=fx._rarityTier===0 ? 1-(1-p)*(1-p)
      : fx._rarityTier===1 ? ease
      : fx._rarityTier===2 ? clamp(ease+Math.sin(p*Math.PI)*.08,0,1)
      : fx._rarityTier===3 ? clamp(ease+Math.sin(p*Math.PI*2)*.07*(1-p),0,1)
      : clamp(ease+Math.sin(p*Math.PI*3)*.08*(1-p),0,1);
    if (p>=1) fx._revealAt=null;
  }
  const tier=fx._rarityTier;
  const pulseWidth=tier>=3?1+.07*Math.sin(t*1.12):tier>=1?1+.035*Math.sin(t*1.12):1;
  fx._beam.alpha=fx._baseOpacity*fx._beamOpacity*(.82+.18*Math.sin(t*(tier>=3?1.8:1.48)))*reveal;
  if (fx._frontFx) fx._frontFx.alpha=(shadow ? 0.95 : Math.min(1,fx._baseOpacity+.08)*(.82+.18*Math.sin(t*(tier>=3?1.8:1.48))))*reveal*fx._beamOpacity;
  fx._beam.scale.set((fx._beamScaleX||1)*pulseWidth,(fx._beamScaleY||1)*(.08+.92*reveal)*(.985+.02*Math.sin(t*1.74)));
  for (const {node,offset,height} of fx._pulseBands||[]) {
    const progress=((ambientTime*speed*.32+offset+fx._phase*.11)%1+1)%1;
    node.y=-height*progress;
    node.alpha= (.20+.35*Math.sin(progress*Math.PI))*reveal;
  }
  for (const wisp of fx._wisps) {
    wisp.node.alpha = 0.55 + 0.30*(.5+.5*Math.sin(t*1.35 + wisp.seed));
    wisp.node.x = Math.sin(t*1.16 + wisp.seed) * 1.8 * wisp.side;
    wisp.node.rotation = Math.sin(t*0.74 + wisp.seed) * 0.025 * wisp.side;
  }
  for(const ray of fx._rays){
    ray.node.alpha=fx._isDivine
      ? .34+.18*(.5+.5*Math.sin(t*1.1+ray.seed*6.28))
      : (tier===4?.18:.11)+.12*(.5+.5*Math.sin(t*1.45+ray.seed*6.28));
    ray.node.rotation=ray.base+Math.sin(t*.72+ray.seed*6.28)*.035;
  }
  for (const {node,seed} of fx._groundMarks) node.alpha=.42+.24*(.5+.5*Math.sin(t*1.4+seed));
  for (const {node,seed,rise} of fx._sparks) {
    const movement=rarityBeamMotion(fx._theme,ambientTime,seed);
    const v=movement.phase;
    node.x=movement.x;
    node.y=-v*rise;
    node.alpha=Math.sin(v*Math.PI)*.96;
    node.scale.set(0.8+0.35*Math.sin(v*Math.PI));
  }
  if(Number.isFinite(fx._rippleAt)){
    const duration=.55+fx._rarityTier*.08;
    const p=clamp((seconds-fx._rippleAt)/duration,0,1);
    fx._ripples.forEach((ripple,index)=>{
      const phase=clamp((p-index*.22)/(1-index*.22),0,1);
      ripple.visible=phase<1;
      ripple.scale.set(.3+phase*2.15,.3+phase*1.9);
      ripple.alpha=(1-phase)*.8;
    });
    if(p>=1){fx._rippleAt=null;if(fx._rippleLayer)fx._rippleLayer.visible=false;}
  }
}
