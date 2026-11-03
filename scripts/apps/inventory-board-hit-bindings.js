/** Occupied-cell pointer routing for irregular and rotated items.
 * Kept separate from the drag lifecycle so event capture order stays stable. */
import { measureComplexBoard } from '../core/complex-drag-geometry.js';
import { resolveComplexPointerHit } from '../core/inventory-pointer-hit.js';
import { openBuxaItemSheet } from './item-sheet.js';
import { openItemContextMenu } from './item-context-menu.js';
import { bindComplexRarityHover } from './inventory-rarity-hover.js';

export function bindComplexInventoryBoardHits(sheet,root,complexDragHandlers,queueMutation) {
  // Occupancy—not DOM z-index or rectangular artwork—is authoritative for
  // pickup, inspection and context menus. This also handles holes between
  // rotated complex items and clipped external-storage boards consistently.
  const bindComplexBoardHits=(board,storage=false)=>{
    const itemCells=new Map();
    const selector=storage ? '[data-storage-index]' : '[data-inventory-index]';
    const indexField=storage ? 'storageIndex' : 'inventoryIndex';
    for(const cell of board.querySelectorAll(selector)) {
      const index=Number(cell.dataset[indexField]);
      if(Number.isInteger(index) && cell.dataset.hitItemId) itemCells.set(index,cell.dataset.hitItemId);
    }
    const geometry=()=>{
      if(!storage)return measureComplexBoard(board);
      const rect=board.getBoundingClientRect();
      const columns=Number(board.style.getPropertyValue('--buxa-storage-columns'));
      const rows=Number(board.style.getPropertyValue('--buxa-storage-rows'));
      if(!(columns>0) || !(rows>0) || !(rect.width>0) || !(rect.height>0))return null;
      return {left:rect.left,top:rect.top,columns,rows,cellSize:rect.width/columns,cellHeight:rect.height/rows};
    };
    const locate=event=>resolveComplexPointerHit(geometry(),event.clientX,event.clientY,itemCells);
    bindComplexRarityHover(board, locate);
    const forward=(event,kind)=>{
      const {itemId}=locate(event);
      const domItem=event.target.closest?.('[data-item-id]')?.dataset?.itemId;
      // Block accidental actions in an irregular item's rectangular hole,
      // and reroute actions that hit art belonging to an adjacent item.
      if(domItem && domItem!==itemId) {
        event.preventDefault();event.stopPropagation();
      }
      if(!itemId)return;
      if (kind==='pointerdown' && event.button===0) {
        if (domItem===itemId) return; // existing item listener handles it
        complexDragHandlers.get(itemId)?.(event);
      } else if (kind==='dblclick') {
        if (domItem===itemId) return;
        event.preventDefault();event.stopPropagation();
        openBuxaItemSheet(sheet.actor?.items?.get?.(itemId));
      } else if(kind==='contextmenu' || (kind==='pointerdown'&&event.button===2)) {
        if(domItem===itemId) return;
        event.preventDefault();event.stopPropagation();
        const item=sheet.actor?.items?.get?.(itemId);
        if(item)openItemContextMenu(sheet,item,event,{queueMutation});
      }
    };
    // Capture lets us reject a false hit before an item's own pointer handler
    // opens its context menu or begins a drag.
    board.addEventListener('pointerdown',event=>forward(event,'pointerdown'),true);
    board.addEventListener('dblclick',event=>forward(event,'dblclick'),true);
    board.addEventListener('contextmenu',event=>forward(event,'contextmenu'),true);
  };
  const complexBoard=root.querySelector('[data-complex-board]');
  if(complexBoard)bindComplexBoardHits(complexBoard);
  root.querySelectorAll('[data-storage-board].is-complex').forEach(board=>bindComplexBoardHits(board,true));

}
