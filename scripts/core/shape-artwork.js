/** Shared artwork geometry for the editor, inventory and drag ghost.
 * Preserve aspect ratio: a single square image canvas is clipped by the
 * occupied footprint. All positions are relative to the entire footprint.
 */
import {normalizeItemShape, rotatedCells, shapeBounds} from "./inventory-shapes.js";

export function shapeMaskUrl(cells) {
  const {width,height}=shapeBounds(cells);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width*100} ${height*100}">${cells.map(({x,y})=>`<rect x="${x*100}" y="${y*100}" width="100" height="100" fill="white"/>`).join('')}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function shapeArtworkGeometry(raw, turns=0) {
  const shape=normalizeItemShape(raw);
  const rotation=((Number(turns)||0)%4+4)%4;
  const cells=rotatedCells(shape,rotation);
  const {width,height}=shapeBounds(cells);
  const original=shapeBounds(shape.cells);
  const dx=(shape.imageX-50)/100*original.width;
  const dy=(shape.imageY-50)/100*original.height;
  const [rx,ry]=rotation===1?[-dy,dx]:rotation===2?[-dx,-dy]:rotation===3?[dy,-dx]:[dx,dy];
  // Both pixel dimensions are equal, even if the item's shape is 1x4 or 3x1.
  // An image can never be stretched by the number of occupied cells.
  const side=Math.max(width,height);
  return {
    cells,width,height,mask:shapeMaskUrl(cells),
    imageWidth:side/width*100,imageHeight:side/height*100,
    imageScale:shape.imageScale/100,
    imageX:rx/width*100||0,imageY:ry/height*100||0,
    imageRotation:(shape.imageRotation+90*rotation)%360
  };
}

export function shapeArtworkStyle(shape,turns=0) {
  const art=shapeArtworkGeometry(shape,turns);
  return `--buxa-art-w:${art.imageWidth}%;--buxa-art-h:${art.imageHeight}%;--buxa-art-scale:${art.imageScale};--buxa-art-x:${art.imageX}%;--buxa-art-y:${art.imageY}%;--buxa-art-angle:${art.imageRotation}deg;mask-image:url("${art.mask}");-webkit-mask-image:url("${art.mask}");mask-size:100% 100%;-webkit-mask-size:100% 100%;mask-repeat:no-repeat;-webkit-mask-repeat:no-repeat`;
}

/** A Simple pouch does not rewrite the source shape; it only displays an
 * ordinary, unmasked icon in its one occupied slot. */
export function storageArtworkStyle(shape,turns=0,itemMode='complex') {
  if(itemMode!=='simple')return shapeArtworkStyle(shape,turns);
  return shapeArtworkStyle({...normalizeItemShape(shape),
    cells:[{x:0,y:0}],imageScale:100,imageX:50,imageY:50,imageRotation:0},0);
}
