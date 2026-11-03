/**
 * Lightweight token-attached Pixi HUD. Its parent is the actual Token PIXI
 * container: Foundry performs translation, zoom, visibility and animation for
 * us. No DOM tracking, movement listeners or independent per-frame loops.
 */
import { getSheetConfig } from "../core/config.js";
import { getEffectiveResourceState } from "../core/resources.js";
import { trackedHudResources } from "../core/resource-hud.js";
import { planResourceHudLayout } from "../core/resource-hud-layout.js";
import { estimateResourceHudWidth, resourceHudZoomMultiplier } from "../core/resource-hud-zoom.js";
import { MODULE_ID } from "../core/constants.js";

const HUD_KEY = "_buxaResourceOverlay";
const clamp01 = x => Math.max(0, Math.min(1, Number(x) || 0));
const hex = x => parseInt(String(x).replace("#", ""), 16) || 0x58bdec;
const blend = (a, b, amount) => {
  const t = clamp01(amount);
  const c = (shift) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return (c(16) << 16) | (c(8) << 8) | c(0);
};
const round = n => Math.round(n * 100) / 100;

function fillRect(g, x, y, w, h, color, alpha = 1, radius = 0) {
  if (typeof g.fill === "function") {
    if (radius) g.roundRect(x, y, w, h, radius); else g.rect(x, y, w, h);
    g.fill({ color, alpha });
  } else {
    g.beginFill(color, alpha);
    if (radius) g.drawRoundedRect(x, y, w, h, radius); else g.drawRect(x, y, w, h);
    g.endFill();
  }
}
function polygon(g, coords, color, alpha = 1) {
  if (typeof g.fill === "function") {
    g.poly(coords, true).fill({ color, alpha });
  } else {
    g.beginFill(color, alpha); g.drawPolygon(coords); g.endFill();
  }
}
function label(container, text, x, y, fontSize, color = 0xe8f5ff, anchorX = 0.5, anchorY = 0.5) {
  if (!text || !globalThis.PIXI?.Text) return;
  const style = { fontFamily: "Arial, sans-serif", fontSize: Math.max(8, fontSize), fontWeight: "bold",
    fill: color, stroke: { color: 0x070d17, width: 2 }, dropShadow: { color: 0x000000, alpha: 0.65, blur: 3, distance: 1 } };
  const txt = String(globalThis.PIXI?.VERSION || "").startsWith("7")
    ? new PIXI.Text(text, { ...style, stroke: "#070d17", strokeThickness: 2 })
    : new PIXI.Text({ text, style });
  txt.anchor?.set(anchorX, anchorY);
  txt.position.set(x, y);
  txt.eventMode = "none";
  container.addChild(txt);
}
function numeric(entry) {
  const { current, max, settings } = entry;
  if (!settings.showValue) return "";
  return settings.showMax ? `${current} / ${max}` : String(current);
}
function placeNumber(container, entry, centerX, centerY, width, height, fontSize, { vertical = false } = {}) {
  const settings = entry.settings;
  const text = numeric(entry);
  if (!text) return;
  const edge = Math.max(11, fontSize + 3);
  const position = settings.valuePosition;
  const pos = {
    inside: [centerX, centerY],
    above: [centerX, centerY - height / 2 - edge],
    below: [centerX, centerY + height / 2 + edge],
    left: [centerX - width / 2 - 8, centerY],
    right: [centerX + width / 2 + 8, centerY]
  }[position];
  label(container, text, pos[0], pos[1], fontSize, 0xf5f9ff,
    position === "left" ? 1 : position === "right" ? 0 : 0.5);
}
function barGeometry(entry, token, offset) {
  const s = entry.settings;
  const scale = s.scale;
  const width = Math.max(90, Math.min(330, token.w * (s.style === "sao" ? 1.5 : 1.15))) * scale;
  const height = Math.max(5, s.thickness * scale);
  const gap = Math.max(25, height + 16);
  let x = (token.w - width) / 2;
  let y = -gap - offset;
  if (s.position === "bottom") y = token.h + 10 + offset;
  if (s.position === "left") { x = -width - 14; y = token.h / 2 - height / 2 + offset; }
  if (s.position === "right") { x = token.w + 14; y = token.h / 2 - height / 2 + offset; }
  return { x: x + s.offsetX, y: y + s.offsetY, width, height };
}
function drawHorizontal(container, entry, token, offset) {
  const s = entry.settings;
  const { x, y, width: w, height: h } = barGeometry(entry, token, offset);
  const g = new PIXI.Graphics();
  container.addChild(g);
  const color = hex(s.color);
  const pct = clamp01(entry.max ? entry.current / entry.max : 0);
  const sao = s.style === "sao";
  if (sao) {
    const cut = Math.min(12, h * 0.85);
    polygon(g, [x-4,y-4,x+w-cut+6,y-4,x+w+9,y+h/2,x+w-cut+6,y+h+4,x-4,y+h+4], 0x8191a5, 0.48);
    polygon(g, [x,y,x+w-cut,y,x+w,y+h/2,x+w-cut,y+h,x,y+h], 0x0c1829, 0.97);
    const filled = w * pct;
    const flat = Math.max(0, Math.min(w - cut - 1, filled - 2));
    if (flat > 0) {
      const strips = Math.max(1, Math.ceil(flat / 9));
      for (let i = 0; i < strips; i++) {
        const sx = x + 2 + i * flat / strips;
        const sw = Math.min(flat / strips + 0.5, x + 2 + flat - sx);
        fillRect(g, sx, y + 2, sw, Math.max(1,h - 4), blend(color, 0xffffff, 0.23 * (1 - i / strips)), 0.98);
      }
    }
    // Do not draw a rectangular fill over the beveled tip.
    if (filled > w - cut + 1) {
      const tip = Math.min(1, (filled - (w - cut)) / cut);
      polygon(g,[x+w-cut,y+2,x+w-cut+(cut-3)*tip,y+h/2,x+w-cut,y+h-2],color,0.96);
    }
    fillRect(g, x+1, y+1, Math.max(0, w-cut-2), Math.max(1,h*0.15), 0xffffff, 0.18);
    polygon(g, [x-18,y+h/2,x-9,y,x,y+h/2,x-9,y+h], color, 0.96);
    fillRect(g, x-10,y+h/2-2,4,4,0xffffff,0.8,1);
  } else {
    fillRect(g,x-2,y-2,w+4,h+4,0x030914,0.8,Math.min(5,h/2));
    fillRect(g,x,y,w,h,0x1b2b3e,0.98,Math.min(3,h/2));
    if (pct > 0) fillRect(g,x,y,Math.max(1,w*pct),h,color,0.98,Math.min(3,h/2));
    fillRect(g,x,y,w,Math.max(1,h*0.18),0xffffff,0.18);
  }
  const font = Math.max(9, 10*s.scale);
  if (s.showLabel) label(container, entry.label, x+5, y-10*s.scale, font*.9, 0xe9f6ff, 0);
  placeNumber(container, entry, x+w/2, y+h/2, w, h, font);
}
function drawVertical(container, entry, token, offset) {
  const s=entry.settings;
  const color=hex(s.color);
  const size=Math.max(45,Math.min(220,token.h*0.85))*s.scale;
  const width=Math.max(5,s.thickness*s.scale);
  const x=(s.position === "left" || s.position === "top")
    ? -18-width-offset : token.w+16+offset;
  const y=(token.h-size)/2 + (s.position === "top" ? -15 : s.position === "bottom" ? 15 : 0);
  const px=x+s.offsetX,py=y+s.offsetY;
  const pct=clamp01(entry.max ? entry.current/entry.max : 0);
  const g=new PIXI.Graphics();container.addChild(g);
  fillRect(g,px-3,py-3,width+6,size+6,0x8199b4,0.45,3);
  fillRect(g,px,py,width,size,0x101e30,0.95,2);
  if (pct>0) fillRect(g,px,py+size*(1-pct),width,Math.max(1,size*pct),color,0.98,2);
  fillRect(g,px,py,Math.max(1,width*0.22),size,0xffffff,0.18);
  if (s.showLabel) label(container,entry.label,px+width/2,py-12*s.scale,9*s.scale,0xe4f0ff);
  placeNumber(container,entry,px+width/2,py+size/2,width,size,10*s.scale,{vertical:true});
}

function getTokenHudData(token) {
  const actor=token?.actor;
  if (!actor || !game?.user) return [];
  const config=getSheetConfig();
  return trackedHudResources(actor,config.resources,game.user).map(({resource,settings}) => {
    const state=getEffectiveResourceState(actor,resource,config);
    return { label:resource.label, id:resource.id, current:round(state.current),
      max:round(state.max),settings };
  });
}

/** Update only a PIXI transform, without recreating a graphics object or text. */
export function updateTokenHudZoom(token) {
  const hud = token?.[HUD_KEY];
  if (!hud?.container?.parent) return;
  const stageZoom = globalThis.canvas?.stage?.scale?.x;
  const viewportWidth = globalThis.canvas?.app?.renderer?.screen?.width
    ?? globalThis.canvas?.app?.screen?.width;
  const factor = resourceHudZoomMultiplier(stageZoom, {
    baseWidth: hud.estimatedWidth,
    viewportWidth
  });
  if (hud.zoomFactor === factor) return;
  hud.zoomFactor = factor;
  hud.container.scale?.set?.(factor);
}

export function clearTokenHud(token) {
  const existing=token?.[HUD_KEY];
  if (!existing) return;
  token[HUD_KEY]=null;
  try { existing.container.destroy({ children:true }); } catch { existing.container?.parent?.removeChild?.(existing.container); }
}
export function refreshTokenHud(token) {
  if (!token || !globalThis.PIXI?.Graphics || !globalThis.canvas?.ready) return;
  // Hidden tokens stay governed by their Foundry parent visibility. Never
  // create extra canvas objects or DOM elements which bypass token visibility.
  const width=Number(token.w),height=Number(token.h);
  if (!(width>0 && height>0)) return;
  token._buxaHudLastDimensions=`${width}x${height}`;
  const data=getTokenHudData(token);
  if (!data.length) { clearTokenHud(token); return; }
  const signature=JSON.stringify([width,height,data]);
  if (token[HUD_KEY]?.signature===signature && token[HUD_KEY]?.container?.parent===token) {
    updateTokenHudZoom(token);
    return;
  }
  clearTokenHud(token);
  const container=new PIXI.Container();
  container.label="Buxa resource HUD";
  container.eventMode="none";
  container.interactiveChildren=false;
  container.sortableChildren=false;
  container.zIndex=9999;
  // Pivot on the token center: compensating for zoom must not make the bar
  // drift away from its token (scaling around 0,0 would move it diagonally).
  container.pivot?.set?.(width / 2, height / 2);
  container.position?.set?.(width / 2, height / 2);
  token.addChild(container);
  token[HUD_KEY]={container,signature,estimatedWidth:estimateResourceHudWidth(token,data)};
  updateTokenHudZoom(token);
  const planned = planResourceHudLayout(data);
  for (const { entry, offset } of planned) {
    const style=entry.settings.style;
    const part=new PIXI.Container();
    part.eventMode="none";
    part.alpha=entry.settings.opacity;
    container.addChild(part);
    if(style==="vertical") drawVertical(part,entry,token,offset);
    else drawHorizontal(part,entry,token,offset);
    // One-shot transition when the value or design changes. No permanent tick.
    if(globalThis.gsap?.fromTo) {
      globalThis.gsap.fromTo(part,{alpha:Math.max(0,part.alpha*.25)},
        {alpha:entry.settings.opacity,duration:0.22,ease:"power2.out",overwrite:true});
    }
  }
}

export function installTokenResourceHud() {
  const refresh=token => {
    try { refreshTokenHud(token); } catch(error) { console.warn(`${MODULE_ID} | Token HUD`,error); }
  };
  Hooks.on("drawToken", refresh);
  Hooks.on("refreshToken", token => {
    updateTokenHudZoom(token);
    // Position changes are handled by Pixi's parent transform. Only rebuild
    // after an actual size change, first draw or document/Actor change.
    if (`${Number(token.w)}x${Number(token.h)}` !== token._buxaHudLastDimensions) refresh(token);
  });
  Hooks.on("updateActor", actor => {
    for(const token of canvas?.tokens?.placeables ?? []) {
      if(token.actor?.id===actor.id) refresh(token);
    }
  });
  Hooks.on("updateToken", tokenDocument => {
    const token=tokenDocument?.object;
    if(token) refresh(token);
  });
  // Only act on zoom changes, not pan-only events. Setting PIXI scale is
  // cheap and takes effect with Foundry's own camera animation immediately.
  let lastPanZoom;
  Hooks.on("canvasPan", () => {
    const zoom = globalThis.canvas?.stage?.scale?.x;
    if (zoom === lastPanZoom) return;
    lastPanZoom = zoom;
    for (const token of globalThis.canvas?.tokens?.placeables ?? []) updateTokenHudZoom(token);
  });
  Hooks.on("canvasReady", () => {
    lastPanZoom = undefined;
    for(const token of canvas?.tokens?.placeables ?? []) refresh(token);
  });
  Hooks.on("destroyToken", clearTokenHud);
  Hooks.on("canvasTearDown", () => {
    for(const token of canvas?.tokens?.placeables ?? []) clearTokenHud(token);
  });
}
