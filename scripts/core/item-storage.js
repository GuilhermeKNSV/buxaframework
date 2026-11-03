/** Storage is attached to an equipped item's Buxa rules; no Actor migrations. */
import {normalizeItemShape, rotatedCells} from './inventory-shapes.js';
import { numericField, safeGridIndex, booleanField } from './numeric-field.js';

const limit = (v, fallback, min, max) => numericField(v, fallback, min, max, true);
const safeColor = (v, fallback = '#344b68') => /^#[0-9a-f]{6}$/i.test(String(v)) ? String(v).toLowerCase() : fallback;

/** Compartment IDs cannot contain colons, but imported Item IDs may. */
export function storageProviderId(storageId) {
  const value = String(storageId ?? '');
  const separator = value.lastIndexOf(':');
  return separator > 0 && separator < value.length - 1 ? value.slice(0, separator) : null;
}

const tooltipText = (value,max) => String(value??'').trim().slice(0,max);
function normalizeTooltipRows(rows) {
  const used=new Set();
  return (Array.isArray(rows)?rows:[]).slice(0,8).map((row,index)=>{
    const base=tooltipText(row?.id,40)||`row-${index+1}`;
    let id=base,suffix=2;
    while(used.has(id)) id=`${base.slice(0,Math.max(1,40-String(suffix).length-1))}-${suffix++}`;
    used.add(id);
    return {id,label:tooltipText(row?.label,64),value:tooltipText(row?.value,140)};
  }).filter(row=>row.label||row.value);
}
export function normalizeStorageTooltip(input) {
  const raw=input && typeof input==='object' && !Array.isArray(input) ? input : {};
  return {
    enabled:booleanField(raw.enabled),
    title:tooltipText(raw.title||'STORAGE DETAILS',64)||'STORAGE DETAILS',
    description:tooltipText(raw.description,300),
    style:['item','neutral','rarity','custom'].includes(raw.style) ? raw.style : 'item',
    rarityId:tooltipText(raw.rarityId,80),
    color:safeColor(raw.color,'#b8c3d2'),
    showCapacity:booleanField(raw.showCapacity,true),
    showCompartments:booleanField(raw.showCompartments,true),
    showBonuses:booleanField(raw.showBonuses,true),
    rows:normalizeTooltipRows(raw.rows)
  };
}

export function normalizeItemStorage(input) {
  const raw = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const equipped = raw.equipped && typeof raw.equipped === 'object' ? raw.equipped : {};
  const slots = raw.slots && typeof raw.slots === 'object' ? raw.slots : {};
  const external = Array.isArray(slots.external) ? slots.external : [];
  const used = new Set();
  return {
    tooltip: normalizeStorageTooltip(raw.tooltip),
    equipped: { slotIds: [...new Set((Array.isArray(equipped.slotIds) ? equipped.slotIds : [])
      .filter(id=>typeof id==='string' && id.trim()).map(id=>id.trim()))].slice(0,128) },
    slots: {
      add: limit(slots.add, 0, 0, 300),
      external: external.slice(0, 12).map((source, i) => {
        const e = source && typeof source === 'object' ? source : {};
        const candidate = String(e.id || `bag-${i+1}`).replace(/[^a-z0-9_-]/gi, '-').slice(0, 48) || `bag-${i+1}`;
        let id=candidate, n=2;
        while(used.has(id)) {
          const suffix=`-${n++}`;
          id=`${candidate.slice(0,48-suffix.length)}${suffix}`;
        }
        used.add(id);
        const columns=limit(e.columns, 4, 1, 12),rows=limit(e.rows, 4, 1, 12);
        const complex=e.mode==='complex';
        const cells = complex ? [...new Set((Array.isArray(e.cells) ? e.cells : []).map(v=>safeGridIndex(v,columns*rows)).filter(v=>v!==null))].slice(0,144) : [];
        return {
          id, label:String(e.label || `Pouch ${i+1}`).trim().slice(0,48) || `Pouch ${i+1}`,
          mode:complex?'complex':'simple',
          // Item occupancy is independent of the compartment's outline.
          // Missing (legacy) preference inherits the Actor inventory mode.
          itemMode:['simple','complex'].includes(e.itemMode)?e.itemMode:'inherit', columns,rows,
          cells:complex ? (cells.length ? cells : [0]) : [],
          rarityStyle:['item','neutral','custom'].includes(e.rarityStyle)?e.rarityStyle:'item',
          color:safeColor(e.color),border:booleanField(e.border,true),background:booleanField(e.background,true)
        };
      })
    }
  };
}

/**
 * Compact the *display* of a shaped compartment to its occupied bounds.
 *
 * The saved slot indices and original columns are deliberately unchanged.
 * Reindexing them would relocate existing contents and desynchronize drop
 * coordinates, particularly for shapes drawn away from the upper-left.
 */
export function storageVisibleBounds(compartment) {
  const columns = Math.max(1, Math.round(Number(compartment?.columns) || 1));
  const rows = Math.max(1, Math.round(Number(compartment?.rows) || 1));
  if (compartment?.mode !== 'complex') {
    return { x: 0, y: 0, columns, rows };
  }
  const indices = (Array.isArray(compartment?.cells) ? compartment.cells : [])
    .map(value=>safeGridIndex(value,columns*rows)).filter(index=>index!==null);
  if (!indices.length) return { x: 0, y: 0, columns: 1, rows: 1 };
  const xs = indices.map(index => index % columns);
  const ys = indices.map(index => Math.floor(index / columns));
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, columns: Math.max(...xs) - x + 1, rows: Math.max(...ys) - y + 1 };
}

/** Only the currently active loadout of equipped items grants space. */
export function buildStorageGrants(actor, rawPlacements={}, activePositions={}, getRules=()=>null, validEquipped=()=>true) {
  const unlocked=new Set();let additional=0;
  const compartments=[];
  const containingIds=new Set(Object.values(rawPlacements).filter(p=>p?.area==='storage')
    .map(p=>storageProviderId(p.storageId)));
  // An item owns its external compartments even when unequipped. Only the
  // active equipped loadout supplies bonus grid slots and unlocks equipment.
  // This keeps a filled backpack intact when moved to the main inventory or
  // into another backpack instead of orphaning its contents.
  for(const item of [...(actor?.items ?? [])]) {
    const placement=rawPlacements[item.id];
    if(!placement || !['equipment','inventory','storage'].includes(placement.area))continue;
    const equipped=placement.area==='equipment' && validEquipped(item,placement);
    if(placement.area==='equipment' && !equipped)continue;
    // Don't normalize every ordinary inventory item's rules several times
    // per render. Raw Foundry flags reveal configured empty backpacks, while
    // existing storage placements reveal an unequipped bag with contents.
    if(!equipped && !containingIds.has(item.id) &&
       !item.flags?.buxaframework?.item?.storage?.slots?.external?.length) continue;
    const active=equipped && Number(placement.position||0)===Number(activePositions[placement.slotId]||0);
    const storage=normalizeItemStorage(getRules(item)?.storage);
    if(active) {
      storage.equipped.slotIds.forEach(id=>unlocked.add(id));
      additional=Math.min(300,additional+storage.slots.add);
    }
    for(const spec of storage.slots.external) compartments.push({
      ...spec,storageId:`${item.id}:${spec.id}`,providerId:item.id,
      sourceName:item.name||'Item',img:item.img||'',active
    });
  }
  return {unlocked,additional,compartments};
}

/** Tests entire occupied footprint, not just the top-left square. */
export function fitsExternalStorage(compartment, placements, shapes, movingId, index, rotation=0) {
  const columns=Number(compartment?.columns), rows=Number(compartment?.rows);
  if(!Number.isSafeInteger(columns) || !Number.isSafeInteger(rows) || columns<1 || rows<1 ||
      !Number.isSafeInteger(index) || index<0 || index>=columns*rows ||
      !Number.isInteger(rotation) || rotation<0 || rotation>3)return false;
  if(movingId===compartment.providerId)return false; // A pouch cannot hold itself.
  // Nor can it be placed into an indirect descendant: A > B > C > A.
  const seen=new Set();
  let provider=compartment.providerId;
  while(provider) {
    if(provider===movingId || seen.has(provider))return false;
    seen.add(provider);
    const place=placements?.[provider];
    provider=place?.area==='storage' ? storageProviderId(place.storageId) : null;
  }
  const mask=new Set(compartment.mode==='complex'?compartment.cells:Array.from({length:columns*rows},(_,i)=>i));
  const complexItems=(compartment.itemMode ?? compartment.mode)==='complex';
  const parts=id=>complexItems ? rotatedCells(normalizeItemShape(shapes?.[id]),id===movingId?rotation:Number(placements?.[id]?.rotation||0)) : [{x:0,y:0}];
  const footprint=parts(movingId);
  const occupied=new Set();
  for(const [id,p] of Object.entries(placements||{})) {
    if(id===movingId || p?.area!=='storage' || p.storageId!==compartment.storageId)continue;
    const origin=safeGridIndex(p.index,columns*rows);
    // Bad legacy rotation must not invent an occupied footprint in a free slot.
    const savedRotation=p.rotation??0;
    if(origin===null || !Number.isInteger(savedRotation) || savedRotation<0 || savedRotation>3)continue;
    const originX=origin%columns,originY=Math.floor(origin/columns);
    const cells=parts(id).map(cell=>({x:originX+cell.x,y:originY+cell.y}));
    // Reconcile legacy/corrupt saved placements exactly as the visible grid
    // does: invalid or overlapping items go to recovery, not occupancy.
    // Otherwise invisible items block cells that look genuinely empty.
    const indices=cells.map(cell=>cell.y*columns+cell.x);
    if(cells.some(cell=>cell.x<0||cell.y<0||cell.x>=columns||cell.y>=rows) ||
       indices.some(cell=>!mask.has(cell)||occupied.has(cell)))continue;
    for(const index of indices)occupied.add(index);
  }
  const x=index%columns,y=Math.floor(index/columns);
  return footprint.every(c=>x+c.x<columns && y+c.y<rows &&
    mask.has((y+c.y)*columns+x+c.x) && !occupied.has((y+c.y)*columns+x+c.x));
}

/** Compartment data must remain valid while a backpack is unequipped, but
 * only equipment-active roots (and their nested pouches) belong in the
 * always-open Actor Sheet storage area. Hiding a compartment is never a
 * deletion or repacking operation. */
export function visibleEquippedCompartments(compartments = [], placements = {}) {
  const byStorageId = new Map(compartments.map(bag => [bag.storageId, bag]));
  const cache = new Map();
  function visible(bag) {
    let current = bag;
    const chain = [], ancestors = new Set();
    let result = false;
    while (current) {
      if (current.active) {result=true;break;}
      if (cache.has(current.storageId)) {result=cache.get(current.storageId);break;}
      if (ancestors.has(current.storageId)) break;
      ancestors.add(current.storageId);
      chain.push(current.storageId);
      const placement=placements[current.providerId];
      current=placement?.area==='storage' ? byStorageId.get(placement.storageId) : null;
    }
    for(const id of chain) cache.set(id,result);
    return result;
  }
  return compartments.filter(bag => visible(bag));
}
