/** Item-sheet storage presentation. Pure and independent of inventory writes. */
import { normalizeItemStorage, normalizeStorageTooltip, storageVisibleBounds } from './item-storage.js';

const hex = (value, fallback='#b8c3d2') => /^#[\da-f]{6}$/i.test(String(value)) ? String(value).toLowerCase() : fallback;
function gridSummary(compartment) {
  const bounds=storageVisibleBounds(compartment);
  const count=compartment.mode==='complex' ? compartment.cells.length : compartment.rows*compartment.columns;
  return {
    label:compartment.label,
    value:`${count} ${count===1?'slot':'slots'} · ${bounds.columns} × ${bounds.rows}`,
    hint:compartment.mode==='complex' ? 'Shaped compartment' : 'Storage compartment',
    icon:'fa-solid fa-table-cells-large'
  };
}

/** Only storage-bearing items get the panel; exact masks determine slot count. */
export function buildStorageTooltip(storageInput, rarityColor='#b8c3d2', rarities=[]) {
  const storage=normalizeItemStorage(storageInput);
  const { equipped, slots }=storage;
  if(!slots.external.length && !slots.add && !equipped.slotIds.length) return null;
  const tooltip=normalizeStorageTooltip(storage.tooltip);
  if(!tooltip.enabled) return null;
  const chosen=Array.isArray(rarities) ? rarities.find(r=>r.id===tooltip.rarityId) : null;
  const accent=tooltip.style==='custom' ? tooltip.color
    : tooltip.style==='neutral' ? '#b8c3d2'
    : tooltip.style==='rarity' ? hex(chosen?.color,hex(rarityColor)) : hex(rarityColor);
  const rows=[];
  const capacity=slots.external.reduce((count,spec)=>count+(spec.mode==='complex'?spec.cells.length:spec.columns*spec.rows),0);
  if(tooltip.showCapacity && slots.external.length)
    rows.push({label:'TOTAL CAPACITY',value:`${capacity} ${capacity===1?'slot':'slots'}`,hint:'Space across all compartments',icon:'fa-solid fa-boxes-stacked'});
  if(tooltip.showCompartments) rows.push(...slots.external.map(gridSummary));
  if(tooltip.showBonuses) {
    if(slots.add) rows.push({label:'EQUIPPED BONUS',value:`+${slots.add} inventory ${slots.add===1?'slot':'slots'}`,hint:'Only while equipped in the active loadout',icon:'fa-solid fa-plus'});
    if(equipped.slotIds.length) rows.push({label:'UNLOCKS',value:`${equipped.slotIds.length} equipment ${equipped.slotIds.length===1?'slot':'slots'}`,hint:'Only while equipped in the active loadout',icon:'fa-solid fa-lock-open'});
  }
  rows.push(...tooltip.rows.map(row=>({...row,icon:'fa-solid fa-circle-info',custom:true})));
  return { title:tooltip.title, description:tooltip.description, accent,
    rows, hasRows:rows.length>0, compartments:slots.external.length, capacity };
}
