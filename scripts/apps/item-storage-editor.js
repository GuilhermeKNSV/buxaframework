/**
 * External storage shape painter. Uses the same connected-cell rules, dark
 * contiguous tiles as the Item Size tab, without artwork overlays.
 * Painting is local and never re-renders the whole Foundry sheet.
 */
import {
  centeredStorageCell, indicesToStorageCells, storageAdjacent,
  toggleStorageCell, resizeStorageMask, storageRemovalResult
} from '../core/storage-footprint-editor.js';
import { normalizeStorageTooltip } from '../core/item-storage.js';

const clamp=(value)=>Math.max(1,Math.min(12,Math.round(Number(value)||4)));

export function bindItemStorageEditor(root) {
  const list=root.querySelector('[data-storage-external-list]');
  if (!list) return;

  const dimensions=row=>({columns:clamp(row.querySelector('[data-storage-columns]')?.value),rows:clamp(row.querySelector('[data-storage-rows]')?.value)});
  const readCells=(row,columns,rows)=>{
    const parsed=String(row.dataset.cells??'').split(',').filter(x=>x.trim()!=='').map(Number);
    const valid=indicesToStorageCells(parsed,columns,rows);
    return valid.length ? valid.map(c=>c.y*columns+c.x).sort((a,b)=>a-b) : [centeredStorageCell(columns,rows)];
  };
  const paint=row=>{
    const grid=row.querySelector('[data-storage-cells]');
    const {columns,rows}=dimensions(row);
    const custom=row.querySelector('[data-storage-shape]')?.value==='complex';
    grid.hidden=!custom;
    row.classList.toggle('is-custom-storage',custom);
    if(!custom) return;
    const cells=readCells(row,columns,rows);
    row.dataset.cells=cells.join(',');
    grid.style.setProperty('--storage-cols',columns);
    grid.style.setProperty('--storage-rows',rows);
    grid.setAttribute('aria-label',`Storage shape: ${columns} by ${rows}`);
    const selected=new Set(cells);
    const fragment=grid.ownerDocument.createDocumentFragment();
    for(let i=0;i<columns*rows;i++){
      const on=selected.has(i),adjacent=!on&&storageAdjacent(cells,columns,rows,i);
      const button=grid.ownerDocument.createElement('button');
      button.type='button';
      button.className=`buxa-shape-tile buxa-storage-cell ${on?'is-filled':adjacent?'is-adjacent':'is-idle'}`;
      button.dataset.storageCell=String(i);
      button.setAttribute('aria-pressed',String(on));
      const removal=on?storageRemovalResult(cells,columns,rows,i):null;
      const caption=on?(removal.allowed?'Right-click to remove':removal.reason):adjacent?'Click to add':'Unavailable';
      button.setAttribute('aria-label',`${caption} cell at ${i%columns+1}, ${Math.floor(i/columns)+1}`);
      button.title=caption;
      button.classList.toggle('is-removal-locked',Boolean(on&&!removal.allowed));
      button.disabled=!on&&!adjacent;
      fragment.append(button);
    }
    // A pouch has no artwork: selected cells ARE the available storage slots.
    grid.replaceChildren(fragment);
    const count=row.querySelector('[data-storage-shape-count]');
    if(count) count.textContent=`${cells.length} ${cells.length===1?'cell':'cells'}`;
  };
  const bind=row=>{
    const slotMode=row.querySelector('[data-storage-item-mode]');
    const hint=row.querySelector('[data-storage-item-mode-hint]');
    const modeSetting=row.querySelector('[data-storage-mode-setting]');
    const syncMode=()=>{
      const mode=slotMode?.value || 'inherit';
      if(hint) hint.textContent = mode==='simple'
        ? 'One item = one cell, regardless of its original size. Moving it out restores its normal shape.'
        : mode==='complex' ? 'Each item uses its original shape, with rotation and collision checks.'
        : 'Uses the Actor inventory mode. Change to Simple or Complex to override it for this pouch.';
      if(modeSetting) modeSetting.dataset.activeMode=mode;
    };
    slotMode?.addEventListener('change',syncMode);
    syncMode();
    const grid=row.querySelector('[data-storage-cells]');
    const {columns,rows}=dimensions(row);
    row.dataset.cells=readCells(row,columns,rows).join(',');
    row.dataset.lastColumns=String(columns);
    row.dataset.lastRows=String(rows);
    for(const field of row.querySelectorAll('[data-storage-columns],[data-storage-rows],[data-storage-shape]')){
      field.addEventListener('change',()=>{
        const size=dimensions(row);
        if(field.hasAttribute('data-storage-columns')||field.hasAttribute('data-storage-rows')){
          const before=readCells(row,Number(row.dataset.lastColumns),Number(row.dataset.lastRows));
          row.dataset.cells=resizeStorageMask(before,Number(row.dataset.lastColumns),Number(row.dataset.lastRows),size.columns,size.rows).join(',');
        }
        row.dataset.lastColumns=String(size.columns);
        row.dataset.lastRows=String(size.rows);
        paint(row);
      });
    }
    grid.addEventListener('click',e=>{
      const target=e.target.closest('[data-storage-cell]');
      if(!target||target.disabled)return;
      const size=dimensions(row);
      const current=readCells(row,size.columns,size.rows);
      const index=Number(target.dataset.storageCell);
      if(current.includes(index))return; // Left click only adds cells.
      const next=toggleStorageCell(current,size.columns,size.rows,index);
      if(!next)return;
      row.dataset.cells=next.join(',');
      paint(row);
    });
    // Foundry captures native context menus in some application windows.
    // A right-button POINTERDOWN is reliable even when `contextmenu` never
    // bubbles. `contextmenu` remains as an accessibility/browser fallback.
    let rightPointerHandled=false;
    const removeCell=e=>{
      const target=e.target?.closest?.('[data-storage-cell]');
      if(!target)return false;
      e.preventDefault?.();e.stopPropagation?.();
      const size=dimensions(row);
      const current=readCells(row,size.columns,size.rows);
      const index=Number(target.dataset.storageCell);
      const decision=storageRemovalResult(current,size.columns,size.rows,index);
      if(!decision.allowed){
        const count=row.querySelector('[data-storage-shape-count]');
        if(count){count.textContent=decision.reason;count.title=decision.reason;}
        return false;
      }
      row.dataset.cells=decision.cells.join(',');
      paint(row);
      return true;
    };
    grid.addEventListener('pointerdown',e=>{
      if(e.button!==2)return;
      rightPointerHandled=removeCell(e);
    },true);
    grid.addEventListener('contextmenu',e=>{
      e.preventDefault?.();e.stopPropagation?.();
      if(rightPointerHandled){rightPointerHandled=false;return;}
      removeCell(e);
    },true);
    row.querySelector('[data-storage-reset]')?.addEventListener('click',()=>{
      const {columns,rows}=dimensions(row);
      row.dataset.cells=String(centeredStorageCell(columns,rows));
      paint(row);
    });
    row.querySelector('[data-storage-remove]')?.addEventListener('click',()=>row.remove());
    paint(row);
  };
  list.querySelectorAll('[data-storage-external]').forEach(bind);
  root.querySelector('[data-storage-add-external]')?.addEventListener('click',()=>{
    const template=root.querySelector('template[data-storage-external-template]');
    if(!template)return;
    const row=template.content.firstElementChild.cloneNode(true);
    row.dataset.storageId=`bag-${(globalThis.foundry?.utils?.randomID?.(8)||Math.random().toString(36).slice(2,10)).toLowerCase()}`;
    const {columns,rows}=dimensions(row);
    row.dataset.cells=String(centeredStorageCell(columns,rows));
    list.append(row);bind(row);row.querySelector('input')?.focus();
  });
}

export function readItemStorageEditor(root) {
  return {
    tooltip: readStorageTooltipEditor(root),
    equipped:{slotIds:[...root.querySelectorAll('[data-storage-slot-id]:checked')].map(el=>el.value)},
    slots:{add:Number(root.querySelector('[data-storage-add-slots]')?.value||0),
      external:[...root.querySelectorAll('[data-storage-external]')].map(row=>({
        id:row.dataset.storageId,
        label:row.querySelector('[data-storage-label]')?.value||'Pouch',
        mode:row.querySelector('[data-storage-shape]')?.value||'simple',
        itemMode:row.querySelector('[data-storage-item-mode]')?.value||'inherit',
        columns:clamp(row.querySelector('[data-storage-columns]')?.value),
        rows:clamp(row.querySelector('[data-storage-rows]')?.value),
        cells:readStoredCells(row),
        rarityStyle:row.querySelector('[data-storage-rarity]')?.value||'item',
        color:row.querySelector('[data-storage-color]')?.value||'#344b68',
        border:Boolean(row.querySelector('[data-storage-border]')?.checked),
        background:Boolean(row.querySelector('[data-storage-background]')?.checked)
      }))}
  };
}

function readStoredCells(row){
  const width=clamp(row.querySelector('[data-storage-columns]')?.value);
  const height=clamp(row.querySelector('[data-storage-rows]')?.value);
  const valid=indicesToStorageCells(String(row.dataset.cells||'').split(',').filter(Boolean).map(Number),width,height);
  return valid.length?valid.map(c=>c.y*width+c.x).sort((a,b)=>a-b):[centeredStorageCell(width,height)];
}

/** Storage tooltip custom rows are display-only; never alter compartment masks. */
export function readStorageTooltipEditor(root) {
  const one=selector=>root.querySelector(selector);
  return normalizeStorageTooltip({
    enabled:one('[data-storage-tooltip-enabled]')?.checked ?? false,
    title:one('[data-storage-tooltip-title]')?.value ?? 'STORAGE DETAILS',
    description:one('[data-storage-tooltip-description]')?.value ?? '',
    style:one('[data-storage-tooltip-style]')?.value ?? 'item',
    rarityId:one('[data-storage-tooltip-rarity]')?.value ?? '',
    color:one('[data-storage-tooltip-color]')?.value ?? '#b8c3d2',
    showCapacity:one('[data-storage-tooltip-capacity]')?.checked ?? true,
    showCompartments:one('[data-storage-tooltip-compartments]')?.checked ?? true,
    showBonuses:one('[data-storage-tooltip-bonuses]')?.checked ?? true,
    rows:[...root.querySelectorAll('[data-storage-tooltip-row]')].map((row,index)=>({
      id:row.dataset.tooltipRowId || `extra-${index+1}`,
      label:row.querySelector('[data-storage-tooltip-row-label]')?.value ?? '',
      value:row.querySelector('[data-storage-tooltip-row-value]')?.value ?? ''
    }))
  });
}

export function bindStorageTooltipEditor(root) {
  const editor=root.querySelector('[data-storage-tooltip-editor]');
  if(!editor)return;
  const enabled=editor.querySelector('[data-storage-tooltip-enabled]');
  const style=editor.querySelector('[data-storage-tooltip-style]');
  const fields=editor.querySelector('[data-storage-tooltip-fields]');
  const color=editor.querySelector('[data-storage-tooltip-color-wrap]');
  const rarity=editor.querySelector('[data-storage-tooltip-rarity-wrap]');
  const list=editor.querySelector('[data-storage-tooltip-rows]');
  const sync=()=>{
    if(fields)fields.hidden=!enabled?.checked;
    if(color)color.hidden=style?.value!=='custom';
    if(rarity)rarity.hidden=style?.value!=='rarity';
  };
  enabled?.addEventListener('change',sync);
  style?.addEventListener('change',sync);
  editor.querySelector('[data-storage-tooltip-add]')?.addEventListener('click',()=>{
    if(!list || list.querySelectorAll('[data-storage-tooltip-row]').length>=8)return;
    const row=root.ownerDocument.createElement('div');
    row.className='buxa-storage-tooltip-row';
    row.dataset.storageTooltipRow='';
    row.dataset.tooltipRowId=globalThis.foundry?.utils?.randomID?.(10)||`row-${Date.now()}`;
    const label=root.ownerDocument.createElement('input');
    label.type='text';label.maxLength=64;label.placeholder='LABEL';label.dataset.storageTooltipRowLabel='';
    const value=root.ownerDocument.createElement('input');
    value.type='text';value.maxLength=140;value.placeholder='Value or description';value.dataset.storageTooltipRowValue='';
    const remove=root.ownerDocument.createElement('button');
    remove.type='button';remove.dataset.storageTooltipRemove='';remove.title='Remove row';remove.setAttribute('aria-label','Remove tooltip row');
    remove.textContent='×';
    row.append(label,value,remove);
    list.append(row);label.focus();
  });
  list?.addEventListener('click',event=>{
    const remove=event.target.closest?.('[data-storage-tooltip-remove]');
    if(remove)remove.closest('[data-storage-tooltip-row]')?.remove();
  });
  sync();
}
