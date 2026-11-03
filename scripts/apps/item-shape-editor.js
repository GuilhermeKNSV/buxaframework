/** Direct manipulation item footprint & artwork editor.
 * One continuous 8x8 board: toggle cells; click image to select; drag to move,
 * resize from its edges/corners, rotate from a dedicated handle. No sliders.
 */
import {normalizeItemShape} from "../core/inventory-shapes.js";
import {footprintBounds,neighboringCell,shapeKey,toggleFootprintCell} from "../core/shape-editor-model.js";
import {shapeArtworkStyle,shapeArtworkGeometry} from "../core/shape-artwork.js";

const SIDE=8;
const cap=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const pct=(n)=>Number(n.toFixed(2));

export function bindItemShapeEditor(host,root) {
  const grid=root.querySelector('[data-item-shape-grid]');
  if(!grid)return;
  host._shapeDraft=normalizeItemShape(host._shapeDraft);
  const source=host._shapeDraft.cells;
  const initial=footprintBounds(source);
  let cells=source.map(c=>({x:c.x+Math.floor((SIDE-initial.width)/2),y:c.y+Math.floor((SIDE-initial.height)/2)}));
  let selected=false,dragging=false;
  const view=grid.ownerDocument.defaultView;
  const layer=grid.ownerDocument.createElement('div');layer.className='buxa-shape-art-layer';
  const image=grid.ownerDocument.createElement('img');image.alt='Item artwork';image.draggable=false;layer.append(image);
  // Separate, unmasked interactive frame. Handles remain visible outside an L-shape.
  const controls=grid.ownerDocument.createElement('div');controls.className='buxa-shape-art-interaction';
  controls.tabIndex=0;controls.setAttribute('role','group');controls.setAttribute('aria-label','Artwork: drag to move, pull edges to resize, rotate using the arrow');
  const hit=grid.ownerDocument.createElement('div');hit.className='buxa-art-hit-area';controls.append(hit);
  const frame=grid.ownerDocument.createElement('div');frame.className='buxa-art-selection-frame';controls.append(frame);
  for(const id of ['nw','n','ne','e','se','s','sw','w']){
    const handle=grid.ownerDocument.createElement('span');handle.className='buxa-art-handle buxa-art-handle-'+id;
    handle.dataset.artHandle=id;handle.setAttribute('aria-label','Resize '+id);frame.append(handle);
  }
  const rotate=grid.ownerDocument.createElement('span');rotate.className='buxa-art-rotate';rotate.dataset.artHandle='rotate';
  rotate.innerHTML='<i class="fa-solid fa-rotate" aria-hidden="true"></i>';rotate.setAttribute('aria-label','Rotate artwork');frame.append(rotate);
  const sourceImage=()=>root.querySelector('[data-item-image]')?.value||host.item?.img||'icons/svg/item-bag.svg';
  function sync(){const b=footprintBounds(cells);host._shapeDraft.cells=cells.map(c=>({x:c.x-b.minX,y:c.y-b.minY}));}
  function geometry(){return footprintBounds(cells);}
  function updateArt(){
    const b=geometry(),s=host._shapeDraft,artGeometry=shapeArtworkGeometry(s);
    if(image.getAttribute('src')!==sourceImage())image.src=sourceImage();
    layer.style.cssText=`left:${b.minX/SIDE*100}%;top:${b.minY/SIDE*100}%;width:${b.width/SIDE*100}%;height:${b.height/SIDE*100}%;${shapeArtworkStyle(s)}`;
    // Exactly the same image transform (including mask-independent resize box).
    controls.style.cssText=`left:${b.minX/SIDE*100}%;top:${b.minY/SIDE*100}%;width:${b.width/SIDE*100}%;height:${b.height/SIDE*100}%;--buxa-art-w:${artGeometry.imageWidth}%;--buxa-art-h:${artGeometry.imageHeight}%;--buxa-art-scale:${s.imageScale/100};--buxa-art-x:${s.imageX-50}%;--buxa-art-y:${s.imageY-50}%;--buxa-art-angle:${s.imageRotation}deg;`;
    const dims=root.querySelector('[data-item-shape-dimensions]');if(dims)dims.textContent=`${b.width} × ${b.height}`;
    const count=root.querySelector('[data-item-shape-count]');if(count)count.textContent=`${cells.length} ${cells.length===1?'cell':'cells'}`;
    grid.classList.toggle('is-art-selected',selected);
  }
  function draw(){
    const filled=new Set(cells.map(shapeKey));
    const fragment=grid.ownerDocument.createDocumentFragment();
    for(let y=0;y<SIDE;y++)for(let x=0;x<SIDE;x++){
      const point={x,y},on=filled.has(shapeKey(point));
      const tile=grid.ownerDocument.createElement('button');tile.type='button';
      tile.dataset.shapeX=String(x);tile.dataset.shapeY=String(y);
      tile.className='buxa-shape-tile '+(on?'is-filled':neighboringCell(point,cells)?'is-adjacent':'is-idle');
      tile.setAttribute('aria-pressed',String(on));tile.setAttribute('aria-label',`${on?'Remove':'Add'} cell at ${x+1}, ${y+1}`);
      fragment.append(tile);
    }
    fragment.append(layer,controls);grid.replaceChildren(fragment);updateArt();
  }
  grid.addEventListener('click',e=>{
    const tile=e.target.closest?.('[data-shape-x]');
    if(!tile)return;
    selected=false;
    const next=toggleFootprintCell(cells,{x:Number(tile.dataset.shapeX),y:Number(tile.dataset.shapeY)});
    if(next){cells=next;sync();draw();}else updateArt();
  });
  function setArt(key,value){
    const limits={imageX:[0,100],imageY:[0,100],imageScale:[20,300],imageRotation:[0,359]};
    let next=cap(value,...limits[key]);
    if(key==='imageRotation')next=((Math.round(value)%360)+360)%360;
    host._shapeDraft[key]=pct(next);
    updateArt();
  }
  function dragStart(e){
    if(e.button!==0)return;
    const handle=e.target.closest?.('[data-art-handle]')?.dataset.artHandle||'move';
    // L-shapes leave holes inside their bounding rectangles. A click in one
    // of those holes must paint a cell, not drag an invisible part of the art.
    if(handle==='move'){
      const rect=grid.getBoundingClientRect();
      const x=Math.floor((e.clientX-rect.left)/rect.width*SIDE);
      const y=Math.floor((e.clientY-rect.top)/rect.height*SIDE);
      if(x>=0&&x<SIDE&&y>=0&&y<SIDE&&!cells.some(c=>c.x===x&&c.y===y)){
        const next=toggleFootprintCell(cells,{x,y});
        if(next){e.preventDefault();e.stopPropagation();cells=next;sync();draw();return;}
      }
    }
    e.preventDefault();e.stopPropagation();
    selected=true;updateArt();
    const start={x:e.clientX,y:e.clientY};
    const saved={...host._shapeDraft};
    const bounds=layer.getBoundingClientRect();
    const center={x:bounds.left+bounds.width/2+(saved.imageX-50)/100*bounds.width,y:bounds.top+bounds.height/2+(saved.imageY-50)/100*bounds.height};
    const initialAngle=Math.atan2(e.clientY-center.y,e.clientX-center.x)*180/Math.PI;
    let changed=false;
    const move=event=>{
      const dx=event.clientX-start.x,dy=event.clientY-start.y;
      if(Math.hypot(dx,dy)>2)changed=true;
      if(handle==='move'){
        setArt('imageX',saved.imageX+dx/Math.max(1,bounds.width)*100);
        setArt('imageY',saved.imageY+dy/Math.max(1,bounds.height)*100);
      }else if(handle==='rotate'){
        let angle=saved.imageRotation+Math.atan2(event.clientY-center.y,event.clientX-center.x)*180/Math.PI-initialAngle;
        if(event.shiftKey)angle=Math.round(angle/15)*15;
        setArt('imageRotation',angle);
      }else{
        // Opposing edges grow/shrink symmetrically around the image centre.
        const wx=handle.includes('e')?1:handle.includes('w')?-1:0;
        const wy=handle.includes('s')?1:handle.includes('n')?-1:0;
        const delta=(wx?wx*dx/Math.max(1,bounds.width):0)+(wy?wy*dy/Math.max(1,bounds.height):0);
        setArt('imageScale',saved.imageScale*(1+delta*(wx&&wy?1:2)));
      }
    };
    const finish=()=>{
      view.removeEventListener('pointermove',move,true);view.removeEventListener('pointerup',finish,true);view.removeEventListener('pointercancel',finish,true);
      view.removeEventListener('blur',finish,true);
      dragging=false;
      grid.classList.remove('is-art-dragging');
    };
    dragging=true;grid.classList.add('is-art-dragging');
    view.addEventListener('pointermove',move,true);view.addEventListener('pointerup',finish,true);view.addEventListener('pointercancel',finish,true);
    view.addEventListener('blur',finish,true);
  }
  controls.addEventListener('pointerdown',dragStart);
  controls.addEventListener('click',e=>{e.stopPropagation();if(!dragging){selected=true;updateArt();}});
  // Right-clicking a covered square removes it if that does not disconnect the item.
  controls.addEventListener('contextmenu',e=>{
    e.preventDefault();e.stopPropagation();
    const r=grid.getBoundingClientRect();
    const x=Math.floor((e.clientX-r.left)/r.width*SIDE),y=Math.floor((e.clientY-r.top)/r.height*SIDE);
    if(x<0||y<0||x>=SIDE||y>=SIDE)return;
    const next=toggleFootprintCell(cells,{x,y});
    if(next){cells=next;selected=false;sync();draw();}
  });
  controls.addEventListener('keydown',e=>{
    if(e.key==='Escape'){selected=false;updateArt();return;}
    if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
    e.preventDefault();selected=true;
    const d=e.shiftKey?5:1;
    const key=e.key==='ArrowUp'||e.key==='ArrowDown'?'imageY':'imageX';
    setArt(key,host._shapeDraft[key]+(['ArrowUp','ArrowLeft'].includes(e.key)?-d:d));
  });
  root.querySelector('[data-item-image]')?.addEventListener('change',updateArt);
  root.querySelector('[data-item-shape-reset]')?.addEventListener('click',()=>{
    cells=[{x:3,y:3}];selected=false;
    Object.assign(host._shapeDraft,{imageX:50,imageY:50,imageRotation:0,imageScale:100});
    sync();draw();
  });
  draw();
}
