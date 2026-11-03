/** Pure rules for the item footprint painter. The item's existing cells are the canvas. */
export function shapeKey({x,y}) { return `${x}:${y}`; }
export function neighboringCell(cell, cells) {
  return cells.some(other => Math.abs(cell.x-other.x)+Math.abs(cell.y-other.y)===1);
}
export function connectedCells(cells) {
  if (!cells.length) return false;
  const available = new Set(cells.map(shapeKey));
  const seen = new Set([shapeKey(cells[0])]);
  const pending = [cells[0]];
  while (pending.length) {
    const {x,y}=pending.pop();
    for(const next of [{x:x+1,y},{x:x-1,y},{x,y:y+1},{x,y:y-1}]) {
      const id=shapeKey(next);
      if(available.has(id) && !seen.has(id)) { seen.add(id); pending.push(next); }
    }
  }
  return seen.size===available.size;
}
export function toggleFootprintCell(cells, point, maxDimension=8) {
  const contained=cells.some(cell=>cell.x===point.x&&cell.y===point.y);
  const next=contained?cells.filter(cell=>cell.x!==point.x||cell.y!==point.y):[...cells,point];
  if(!next.length || !connectedCells(next)) return null;
  if(!contained && !neighboringCell(point,cells)) return null;
  const minX=Math.min(...next.map(c=>c.x)),maxX=Math.max(...next.map(c=>c.x));
  const minY=Math.min(...next.map(c=>c.y)),maxY=Math.max(...next.map(c=>c.y));
  if(maxX-minX+1>maxDimension || maxY-minY+1>maxDimension) return null;
  return next;
}
export function footprintBounds(cells) {
  const minX=Math.min(...cells.map(c=>c.x)),minY=Math.min(...cells.map(c=>c.y));
  return {minX,minY,width:Math.max(...cells.map(c=>c.x))-minX+1,height:Math.max(...cells.map(c=>c.y))-minY+1};
}
