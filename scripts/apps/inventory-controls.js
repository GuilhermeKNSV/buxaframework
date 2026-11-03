import { trashcanDropActorItem } from './gm-trashcan.js';
import { inventoryRechargeTarget, performInventoryRecharge, queueInventoryRecharge } from './inventory-recharge-drop.js';
import { measureComplexBoard, isOverComplexBoard } from "../core/complex-drag-geometry.js";
import { cellIndexAt } from "../core/inventory-pointer-hit.js";
import { getSheetConfig } from "../core/config.js";
import { normalizeItemShape, rotatedCells, shapeBounds, createPlacementScanner } from "../core/inventory-shapes.js";
import { shapeArtworkStyle } from "../core/shape-artwork.js";
import { createComplexStackHover } from "./complex-stack-hover.js";
import { createComplexDecorationSvg } from "./complex-shape-decoration.js";
import { grabbedShapeCell, pickedOccupiedShapeCell, rotateGrabbedShapeCell, grabbedCellFraction, rotateGrabFraction, resolveAnchoredComplexPlacement } from "../core/complex-grid-anchor.js";
import { InventoryFootprintPreview } from "./inventory-footprint-preview.js";
import { getInventoryState, getActorStorage, getEffectiveInventoryConfig } from "../core/inventory.js";
import { fitsExternalStorage } from "../core/item-storage.js";
import { storageBoardAt, storagePlacementAt } from "../core/storage-drop-geometry.js";
import { createInventoryContainerHit, createInventoryContainerMarker } from "./inventory-container-hit.js";
import {
  moveInventoryItem,
  reconcileInventoryState,
  setEquipmentActivePosition,
  setInventoryAutoSort,
  setInventorySortMode
} from "../core/inventory.js";
import { canStackItems, stackActorItems, canEquipItem } from "../core/item-runtime.js";
import { notifyWarning } from "../core/notifications.js";
import { autoStackMovedItem } from "../core/stack-on-move.js";
import { openBuxaItemSheet } from "./item-sheet.js";
import { bindItemHoverTooltips } from "./item-tooltip.js";
import { closeItemContextMenu, openItemContextMenu } from "./item-context-menu.js";
import { dropInventoryItemOnBoard } from "../integrations/physical-item-canvas.js";
import { dropInventoryIntoGroundContainer, showGroundTransferAtPoint, clearGroundTransferGhost } from "./ground-container-window.js";
import { transferInventoryItemToDirectory } from "../integrations/physical-item-handoff.js";
import { physicalDropTargetFromClient } from "../integrations/physical-item-drop-targets.js";
import { showPhysicalDropGhost, clearPhysicalDropGhost } from "../integrations/physical-item-ghost.js";
import { equipmentGhostCellSize, transitionEquipmentDragGhost } from "./equipment-drag-preview.js";
import { transitionStorageOccupancyGhost } from './inventory-occupancy-ghost.js';
import { bindComplexInventoryBoardHits } from "./inventory-board-hit-bindings.js";
import { assignInventoryHotbarDrop } from "./hotbar.js";
import { clearComplexRarityHover } from "./inventory-rarity-hover.js";
import { makeDragGhost, animateGhostRotation, cancelGhostRotation } from './inventory-drag-motion.js';
import { handleNpcPointerDrop, npcDropTargetAt } from "./npc-drop-editor.js";
import { prepareEquipmentDropMotion, commitEquipmentDropMotion } from './equipment-drop-motion.js';
const BUXA_ITEM_MIME = "application/x-buxa-item";
const POINTER_DRAG_THRESHOLD = 5;
import { getInventoryDropDestination, compatibleStorageStackTarget } from "./inventory-drop-target.js";
import { inventoryPickupBoard, simpleStoragePickupCell } from "../core/inventory-pickup-target.js";
import { pointerStorageDestination, canDropIntoStorage, storageDragShapes } from "./inventory-storage-drop.js";
export { getInventoryDropDestination, getInventoryDropTargetItemId } from "./inventory-drop-target.js";
export async function placeDroppedInventoryItem(sheet, item, destination) {
  if (!destination || !item?.id || item.parent?.id !== sheet.actor?.id) return null;
  return moveInventoryItem(sheet.actor, item.id, destination, getSheetConfig());
}
function clearDropTargets(root) {
  root?.querySelectorAll?.(".is-inventory-drop-target").forEach((element) => element.classList.remove("is-inventory-drop-target"));
}
function markPointerDropTarget(previous, target) {
  const slot = target?.closest?.("[data-inventory-index], [data-storage-index], [data-equipment-slot]") ?? null;
  if (slot === previous) return previous;
  previous?.classList.remove("is-inventory-drop-target");
  slot?.classList.add("is-inventory-drop-target");
  return slot;
}
async function handleInternalDrop(sheet, sourceId, target, destination, { stackTargetId = null } = {}) {
  const config = getSheetConfig();
  const source = sheet.actor?.items?.get?.(sourceId);
  // For Complex, the stack target comes from the occupied pointer cell,
  // rather than the topmost DOM element (which may be a transparent cell).
  // Normal moves still pass through footprint collision validation.
  const recharge=inventoryRechargeTarget(sheet.actor,sourceId,target,stackTargetId,config);
  if(recharge) {await performInventoryRecharge(sheet.actor,recharge,config);return true;}
  const targetId = destination?.containerDrop ? null : (stackTargetId || (config.inventory?.mode !== 'complex' || destination?.area==='storage'
    ? (target?.closest?.('[data-item-id]')?.dataset?.itemId || target?.closest?.('[data-hit-item-id]')?.dataset?.hitItemId) : null));
  const targetItem = targetId && targetId !== sourceId ? sheet.actor?.items?.get?.(targetId) : null;
  if (source && targetItem && canStackItems(source, targetItem, config)) {
    const merged = await stackActorItems(sheet.actor, source, targetItem, { deleteSource: true, config });
    if (!merged) return false;
    await reconcileInventoryState(sheet.actor, config);
    if (sheet.actor.items?.get?.(sourceId)) await autoStackMovedItem(sheet.actor,sourceId,config);
    return true;
  }
  if (!destination) return false;
  const moved=await moveInventoryItem(sheet.actor, sourceId, destination, config);
  if (moved && ['inventory','storage'].includes(destination.area))
    await autoStackMovedItem(sheet.actor,sourceId,config);
  return Boolean(moved);
}
function bindPointerItemDrag(sheet, element, queueMutation, root) {
  const beginDrag = (event) => {
    if (event.button !== 0 || !sheet.actor?.isOwner) return;
    const itemId = element.dataset.itemId;
    if (!sheet.actor?.items?.get?.(itemId)) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    const view = element.ownerDocument?.defaultView ?? window;
    let dragging = false;
    let ghost = null;
    let offsetX = 0;
    let offsetY = 0;
    let latestPoint = null;
    let frame = 0;
    let activeDropTarget = null;
    const containerMarker=createInventoryContainerMarker(root);
    let rotation = Number(element.dataset.rotation || 0);
    const sourceRect=element.getBoundingClientRect();
    const grabbedX=Math.max(0,Math.min(sourceRect.width,startX-sourceRect.left));
    const grabbedY=Math.max(0,Math.min(sourceRect.height,startY-sourceRect.top));
    let grabbedCell = null;
    let grabFraction = {x:.5,y:.5};
    // Prefer the actual occupied square that received pointerdown. Reading
    // only the bounding rectangle is unreliable for L/T-shaped footprints.
    const sourcePiece = event.target.closest?.('[data-buxa-piece-x][data-buxa-piece-y]');
    const sourceHit = event.target.closest?.('[data-hit-item-id]');
    const rawShape = sheet.actor.items.get(itemId)?.getFlag?.('buxaframework', 'item')?.shape;
    const sourceCells = rotatedCells(rawShape, rotation);
    const sourceIsStorage = Boolean(element.closest('[data-storage-board]'));
    // Only items actually IN a board are subject to occupied-cell pickup
    // validation. Equipment artwork is outside that board: testing it against
    // the global inventory rectangle prevented EVERY equipped item from
    // starting a drag (and therefore prevented unequipping backpacks).
    const sourceBoard = inventoryPickupBoard(element);
    const sourceColumns = Number(sourceBoard?.style.getPropertyValue(sourceIsStorage ? '--buxa-storage-columns' : '--buxa-complex-columns'));
    // The visible texture may extend across empty mask cells. The authoritative
    // pickup cell is always the underlying logical slot at the cursor, never
    // whichever transparent/oversized artwork node received the event.
    const sourceGeometry = sourceIsStorage ? (() => {
      const r=sourceBoard?.getBoundingClientRect?.();
      const rows=Number(sourceBoard?.style?.getPropertyValue('--buxa-storage-rows'));
      if(!r || !(sourceColumns>0) || !(rows>0))return null;
      return {left:r.left,top:r.top,columns:sourceColumns,rows,
        cellSize:r.width/sourceColumns,cellHeight:r.height/rows};
    })() : measureComplexBoard(sourceBoard);
    const actualHitIndex=cellIndexAt(sourceGeometry,startX,startY);
    grabbedCell = simpleStoragePickupCell(element, sourceBoard) || pickedOccupiedShapeCell(sourceCells, {
      hitIndex: actualHitIndex,
      originIndex: Number(element.dataset.complexIndex), columns: sourceColumns
    });
    // Refuse clicks in an item's bounding rectangle but outside its shape.
    if (sourceBoard && !grabbedCell) return;
    if (!grabbedCell) grabbedCell = pickedOccupiedShapeCell(sourceCells, {
      pieceX: sourcePiece && element.contains(sourcePiece) ? Number(sourcePiece.dataset.buxaPieceX) : undefined,
      pieceY: sourcePiece && element.contains(sourcePiece) ? Number(sourcePiece.dataset.buxaPieceY) : undefined,
      hitIndex: sourceHit?.dataset.hitItemId === itemId
        ? Number(sourceHit.dataset[sourceIsStorage ? 'storageIndex' : 'inventoryIndex']) : undefined,
      originIndex: Number(element.dataset.complexIndex), columns: sourceColumns
    });
    if (grabbedCell) {
      const bounds=shapeBounds(sourceCells);
      grabFraction=grabbedCellFraction({pointerX:startX,pointerY:startY,geometry:sourceGeometry,
        originIndex:Number(element.dataset.complexIndex),columns:sourceColumns,
        grabCell:grabbedCell,sourceRect,shapeWidth:bounds.width,shapeHeight:bounds.height});
    }
    const previewImage = element.querySelector('img')?.currentSrc || element.querySelector('img')?.src || '';
    const equipmentPreviewSize = equipmentGhostCellSize(root);
    let lastValidityIndex="";
    const cfg=getSheetConfig();
    // Mouse press and double-click must not rebuild the entire actor inventory.
    // Snapshot its occupied cells only once the pointer crosses the drag threshold.
    let dragShapes = null;
    let collisionScanner = null;
    let footprintPreview = null;
    let stackHover = null;
    const isComplex = Boolean(root.querySelector('[data-complex-board]'));
    const fromComplexStorage = Boolean(element.closest('[data-storage-board].is-complex'));
    const prepareComplexDrag = () => {
      if ((!isComplex && !fromComplexStorage) || collisionScanner) return;
      const inventoryState = getInventoryState(sheet.actor, cfg);
      dragStorageState=inventoryState;
      dragStorageGrants=getActorStorage(sheet.actor,cfg);
      dragShapes = Object.fromEntries([...sheet.actor.items].map(item => [
        item.id, normalizeItemShape(item.getFlag?.('buxaframework', 'item')?.shape)
      ]));
      const sourceStorageId = !isComplex ? board?.dataset.storageBoard : null;
      const sourceDimensions = sourceStorageId ? {
        columns:Number(board.style.getPropertyValue('--buxa-storage-columns'))||4,
        rows:Number(board.style.getPropertyValue('--buxa-storage-rows'))||4
      } : getEffectiveInventoryConfig(sheet.actor,cfg).complex;
      collisionScanner = createPlacementScanner(dragShapes, sourceDimensions);
      for (const [otherId, position] of Object.entries(inventoryState.placements)) {
        if (otherId === itemId || (isComplex ? position?.area!=='inventory' : (position?.area!=='storage'||position.storageId!==sourceStorageId))) continue;
        collisionScanner.occupy(otherId, Number(position.index), position.rotation || 0);
      }
      boardGeometry = measureComplexBoard(board);
      if (isComplex && board) footprintPreview = new InventoryFootprintPreview(board, collisionScanner, itemId);
      if (isComplex) stackHover = createComplexStackHover({
        actor: sheet.actor, sourceId: itemId, config: cfg, scanner: collisionScanner,
        getGeometry: () => boardGeometry,
        getCells: () => footprintPreview?.cells,
        getGhost: () => ghost
      });
    };
    const board = isComplex ? root.querySelector('[data-complex-board]') : element.closest('[data-storage-board]');
    let boardGeometry = null;
    let boardMeasureDirty = false;
    let storagePreviewCells = [];
    let dragStorageGrants = null;
    let dragStorageState = null;
    let dragStorageShapes = null;
    let lastStoragePreviewKey = '';
    let cachedStorageBoards=null;
    const readStorageBoards=()=>[...root.querySelectorAll('[data-storage-board]')].map(node=>({
      node,rect:node.getBoundingClientRect(),
      visibleRect:node.closest('.buxa-storage-board-viewport')?.getBoundingClientRect(),
      clipRect:node.closest('.buxa-storage-board-scroll')?.getBoundingClientRect(),
      storageId:node.dataset.storageBoard,
      columns:Number(node.style.getPropertyValue('--buxa-storage-columns'))||4,
      rows:Number(node.style.getPropertyValue('--buxa-storage-rows'))||4,
      complex:node.classList.contains('is-complex')
    }));
    // Scroll/resize changes viewport coordinates without changing the actor.
    // Re-measure only at the next pointer event, not during every scroll tick.
    const invalidateStorageBoards=()=>{cachedStorageBoards=null;boardMeasureDirty=true;};
    const clearStoragePreview=()=>{ for(const cell of storagePreviewCells)cell.classList.remove('is-storage-drop-target','is-storage-invalid');storagePreviewCells=[]; };
    const storageTarget=(x,y)=>storageBoardAt(cachedStorageBoards ||= readStorageBoards(),x,y);
    const renderGhostShape = () => {
      if (!ghost || (!isComplex && !fromComplexStorage) || !board) return;
      const shape = dragShapes?.[itemId];
      const cells = rotatedCells(shape, rotation);
      const bounds = shapeBounds(cells);
      const cell = boardGeometry?.cellSize || board.getBoundingClientRect().width / collisionScanner.columns;
      const cellHeight = boardGeometry?.cellHeight || cell;
      ghost.style.width = `${bounds.width * cell}px`;
      ghost.style.height = `${bounds.height * cellHeight}px`;
      ghost.classList.add('is-complex-ghost');
      ghost.classList.toggle('is-rectangular-shape', cells.length === bounds.width * bounds.height && (bounds.width > 1 || bounds.height > 1));
      ghost.style.aspectRatio = 'auto';
      if (!grabbedCell) {
        grabbedCell = grabbedShapeCell(cells, bounds.width, bounds.height,
          grabbedX, grabbedY, sourceRect.width, sourceRect.height);
        grabFraction=grabbedCellFraction({pointerX:startX,pointerY:startY,grabCell:grabbedCell,
          sourceRect,shapeWidth:bounds.width,shapeHeight:bounds.height});
      }
      // The cell grabbed is authoritative inside the board. Outside it the
      // normal floating ghost is centered on the same cell.
      offsetX = (grabbedCell.x + grabFraction.x) * cell;
      offsetY = (grabbedCell.y + grabFraction.y) * cellHeight;
      cancelGhostRotation(ghost);
      ghost.replaceChildren();
      // Rarity variables were copied once at ghost creation. They survive
      // reshaping, rotation, equipment transitions and Simple storage.
      for (const rarityClass of ['has-rarity-ornament', 'has-rarity-glint',
        'is-rarity-spectrum', 'is-rarity-animated', 'buxa-rarity-bg-full',
        'buxa-rarity-bg-glint']) {
        ghost.classList.toggle(rarityClass, element.classList.contains(rarityClass));
      }
      // The exact same masked background and unbroken artwork are used in
      // the settled inventory and its ghost. Only perimeter edges are drawn.
      const backdrop = ghost.ownerDocument.createElement('div');
      backdrop.className = 'buxa-complex-backdrop';
      backdrop.style.cssText = shapeArtworkStyle(shape, rotation);
      ghost.append(backdrop);
      const source = element.querySelector('img')?.src;
      if (source) {
        const surface = ghost.ownerDocument.createElement('div');
        surface.className = 'buxa-complex-art';
        surface.style.cssText = shapeArtworkStyle(shape, rotation);
        const image = ghost.ownerDocument.createElement('img');
        image.src = source;
        image.alt = '';
        image.draggable = false;
        surface.append(image);
        ghost.append(surface);
      }
      ghost.append(createComplexDecorationSvg(ghost.ownerDocument, cells));
      for (const part of cells) {
        const tile = ghost.ownerDocument.createElement('span');
        tile.className = 'buxa-complex-ghost-cell';
        tile.style.cssText = `left:${part.x * cell}px;top:${part.y * cellHeight}px;width:${cell}px;height:${cellHeight}px;`;
        ghost.append(tile);
      }
    };
    const refreshBoardGeometry = () => {
      if (boardMeasureDirty && isComplex && board) {
        boardGeometry = measureComplexBoard(board);
        boardMeasureDirty = false;
      }
    };
    const inventoryContainerHit=createInventoryContainerHit({itemId,isComplex,
      geometry:()=>boardGeometry,scanner:()=>collisionScanner,
      grants:()=>dragStorageGrants ||= getActorStorage(sheet.actor,cfg),
      state:()=>dragStorageState ||= getInventoryState(sheet.actor,cfg),
      shapes:()=>dragShapes || (dragStorageShapes ||= storageDragShapes(sheet.actor))
    });
    const dropAt = (x, y, pointerTarget) => {
      refreshBoardGeometry();
      // Dropping directly onto an inventory backpack is the same intentional
      // storage action as dropping onto the backpack's external slot grid.
      const container=inventoryContainerHit.at(x,y,pointerTarget,rotation);
      if(container)return container.destination;
      if (isComplex && isOverComplexBoard(boardGeometry, x, y)) {
        // Keep the exact occupied cell picked up under the cursor. Resolving
        // at pointerup uses the same grid anchor; no hidden magnetic movement.
        return resolveAnchoredComplexPlacement(boardGeometry, x, y, grabbedCell,
          collisionScanner, itemId, rotation);
      }
      const bag=storageTarget(x,y);
      if(bag) return storagePlacementAt(bag,x,y,grabbedCell,rotation);
      const destination = getInventoryDropDestination({ target: pointerTarget, clientX: x, clientY: y });
      return pointerStorageDestination(destination, itemId,
        () => dragStorageGrants ||= getActorStorage(sheet.actor, cfg),
        () => dragStorageState ||= getInventoryState(sheet.actor, cfg),
        () => dragShapes || (dragStorageShapes ||= storageDragShapes(sheet.actor)));
    };
    const rotate = e => {
      if (dragging && e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cancel();
        return;
      }
      if (!dragging || (!isComplex && !fromComplexStorage) || e.key.toLowerCase() !== 'r') return;
      e.preventDefault();
      e.stopPropagation();
      animateGhostRotation(ghost, () => {
      const previousCells = rotatedCells(dragShapes?.[itemId], rotation);
      const previousHeight = shapeBounds(previousCells).height;
      rotation = (rotation + 1) % 4;
      grabbedCell = rotateGrabbedShapeCell(grabbedCell, previousHeight);
      grabFraction = rotateGrabFraction(grabFraction);
      if (!ghost?.classList.contains('is-equipment-ghost') && !ghost?.classList.contains('is-simple-storage-ghost')) renderGhostShape();
      lastValidityIndex = '';
      if (latestPoint) paintDrag(latestPoint);
      });
    };
    const paintDrag = (point) => {
      if (!ghost || !point) return;
      const { x, y } = point;
      refreshBoardGeometry();
      const overBoard = isComplex && isOverComplexBoard(boardGeometry, x, y);
      // Avoid hit-testing and layout measurements while inside the board;
      // those forced browser work on every mouse movement.
      const pointerTarget = overBoard ? board : element.ownerDocument.elementFromPoint(x, y);
      const location = dropAt(x, y, pointerTarget);
      // Shape-morphing a live rotation surface would detach its children and
      // leave a WAAPI animation targeting a dead node. Settle it first.
      if (ghost.classList.contains('is-rotating-ghost') &&
          (location?.area==='equipment' || (location?.area==='storage' &&
            (dragStorageGrants ||= getActorStorage(sheet.actor,cfg)).compartments.find(
              b=>b.storageId===location.storageId)?.itemMode==='simple'))) cancelGhostRotation(ghost);
      const {equipmentGhost,changed:modeChange}=transitionEquipmentDragGhost({
        ghost,target:pointerTarget,destination:location,image:previewImage,
        cellSize:equipmentPreviewSize,shaped:isComplex||fromComplexStorage,
        renderShape:renderGhostShape,currentOffsets:()=>({offsetX,offsetY})
      });
      if(modeChange) {offsetX=modeChange.offsetX;offsetY=modeChange.offsetY;lastValidityIndex='';}
      const slotChange=transitionStorageOccupancyGhost({ghost,destination:location,compartments:(dragStorageGrants ||= getActorStorage(sheet.actor,cfg)).compartments,image:previewImage,shaped:isComplex||fromComplexStorage,restoreShape:renderGhostShape,offsets:()=>({offsetX,offsetY})});if(slotChange){offsetX=slotChange.offsetX;offsetY=slotChange.offsetY;}
      if (location?.area==='storage') {
        footprintPreview?.clear();
        stackHover?.highlight(null, null);
        ghost.classList.remove('is-merge-hover');
      }
      const storageKey=location?.area==='storage'?`${location.storageId}:${location.index}:${location.rotation||0}`:'';
      if(storageKey!==lastStoragePreviewKey)clearStoragePreview();
      lastStoragePreviewKey=storageKey;
      if(location?.area==='storage' && !storagePreviewCells.length) {
        const bag=(dragStorageGrants ||= getActorStorage(sheet.actor,cfg)).compartments.find(b=>b.storageId===location.storageId);
        if(bag) {
          const allState=dragStorageState ||= getInventoryState(sheet.actor,cfg);
          const shapes=dragShapes || (dragStorageShapes ||= storageDragShapes(sheet.actor));
          const valid=fitsExternalStorage(bag,allState.placements,shapes,itemId,location.index,location.rotation||0);
          const board=root.querySelectorAll('[data-storage-board]');
          const container=[...board].find(e=>e.dataset.storageBoard===bag.storageId);
          const cells=container?.querySelectorAll('[data-storage-index]');
          const footprint=bag.itemMode==='complex'?rotatedCells(shapes[itemId],location.rotation||0):[{x:0,y:0}];
          const baseX=location.index%bag.columns,baseY=Math.floor(location.index/bag.columns);
          for(const part of footprint){
            const x=baseX+part.x,y=baseY+part.y;
            if(x<0||x>=bag.columns||y<0||y>=bag.rows)continue;
            const cell=cells?.[y*bag.columns+x];
            if(cell){cell.classList.add(valid?'is-storage-drop-target':'is-storage-invalid');storagePreviewCells.push(cell);}
          }
          ghost.classList.toggle('is-invalid',!valid);
        }
      }
      if(location?.containerDrop)ghost.classList.toggle('is-invalid',location.index<0);
      // Exactly ONE ghost: snapped to the committed cell while over the board,
      // and cursor-following elsewhere. No duplicate translucent projection.
      // Never show a ghost in a different slot than the pending drop.
      const showSnap = overBoard && location?.area === 'inventory';
      const drawX = showSnap ? location.left : x - offsetX;
      const drawY = showSnap ? location.top : y - offsetY;
      ghost.style.transform = `translate3d(${drawX}px, ${drawY}px, 0)`;
      ghost.classList.toggle('is-over-board', showSnap);
      if (equipmentGhost) {
        const equipSlot = cfg.inventory?.equipmentLayout?.slots?.find(slot=>slot.id===location?.slotId);
        const compatible = location?.area==='equipment' && equipSlot &&
          canEquipItem(sheet.actor,sheet.actor.items.get(itemId),equipSlot,cfg).ok;
        ghost.classList.toggle('is-invalid',!compatible);
        footprintPreview?.clear();
        stackHover?.highlight(null,null);
      }
      const cellIndex = overBoard ? stackHover?.cellAt(x, y) : null;
      const mergeId = location?.containerDrop ? null : (overBoard ? stackHover?.targetAt(x, y) : null);
      const key = `${location?.area}:${location?.index}:${location?.slotId}:${rotation}:${mergeId ?? ''}:${mergeId ? cellIndex : ''}`;
      containerMarker.show(location);
      activeDropTarget = markPointerDropTarget(activeDropTarget,
        overBoard || location?.containerDrop ? null : pointerTarget);
      if (isComplex && key !== lastValidityIndex && location?.area!=='storage') {
        lastValidityIndex = key;
        // On a compatible stack the pointer's destination wins even if the
        // source's bounding box would otherwise collide with the target.
        const valid = Boolean(mergeId) || (location?.area === 'inventory'
          ? (footprintPreview?.update(location.index, rotation) ?? location.valid)
          : location?.area === 'equipment' || location?.area==='storage');
        if (mergeId || location?.area !== 'inventory') footprintPreview?.clear();
        stackHover?.highlight(mergeId, cellIndex);
        ghost.classList.toggle('is-invalid', !valid);
        // Merge feedback is carried by the green target tile; the ghost is
        // hidden to avoid obscuring the item that will receive this stack.
        ghost.classList.toggle('is-merge-hover', Boolean(mergeId));
      }
    };
    const schedule = (point) => {
      latestPoint = point;
      if (isComplex) {
        // Moving just a compositor transform / changing cells at grid
        // boundaries is cheaper than delaying the feedback by a full frame.
        paintDrag(point);
        return;
      }
      if (frame) return;
      frame = view.requestAnimationFrame(() => {
        frame = 0;
        paintDrag(latestPoint);
      });
    };

    const move = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      if (!element.isConnected) { cancel(); return; }
      const distance = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
      if (!dragging && distance < POINTER_DRAG_THRESHOLD) return;
      if (!dragging) {
        dragging = true;
        prepareComplexDrag();
        const created = makeDragGhost(element, root, moveEvent.clientX, moveEvent.clientY);
        ghost = created.ghost;
        offsetX = created.offsetX;
        offsetY = created.offsetY;
        renderGhostShape();
        clearComplexRarityHover(element.closest?.('[data-complex-board], [data-storage-board]'));
        element.classList.add("is-dragging");
        element.ownerDocument.body.classList.add("buxa-inventory-pointer-dragging");
      }
      moveEvent.preventDefault();
      const npcZone=root.querySelector('[data-npc-drop-zone]');
      npcZone?.classList.toggle('is-npc-drag-over',npcDropTargetAt(root,moveEvent.clientX,moveEvent.clientY)!==null);
      const shapeBoundsNow=shapeBounds(rotatedCells(dragShapes?.[itemId] || sheet.actor.items.get(itemId)?.getFlag?.('buxaframework','item')?.shape,rotation));
      const chestGrip={rotation,
        gripX:((grabbedCell?.x ?? Math.floor(grabbedX/Math.max(1,sourceRect.width)*shapeBoundsNow.width))+.5)/shapeBoundsNow.width,
        gripY:((grabbedCell?.y ?? Math.floor(grabbedY/Math.max(1,sourceRect.height)*shapeBoundsNow.height))+.5)/shapeBoundsNow.height};
      const chestPreview=showGroundTransferAtPoint(sheet.actor.items.get(itemId),moveEvent.clientX,moveEvent.clientY,chestGrip);
      const sceneGhost=chestPreview?null:showPhysicalDropGhost(sheet.actor.items.get(itemId),moveEvent.clientX,moveEvent.clientY,{actor:sheet.actor});
      if(chestPreview)clearPhysicalDropGhost();
      if (ghost) ghost.style.visibility=(sceneGhost||chestPreview?.valid)?'hidden':'';
      schedule({ x: moveEvent.clientX, y: moveEvent.clientY });
    };

    const cleanup = () => {
      clearPhysicalDropGhost();clearGroundTransferGhost();
      root.querySelector('[data-npc-drop-zone]')?.classList.remove('is-npc-drag-over');
      dragStorageGrants=null;dragStorageState=null;dragStorageShapes=null;lastStoragePreviewKey='';
      if (frame) view.cancelAnimationFrame(frame);
      frame = 0;
      latestPoint = null;
      activeDropTarget?.classList.remove("is-inventory-drop-target");
      containerMarker.clear();
      inventoryContainerHit.clear();
      activeDropTarget = null;
      element.classList.remove("is-dragging");
      element.ownerDocument.body.classList.remove("buxa-inventory-pointer-dragging");
      clearStoragePreview();
      stackHover?.clear();
      stackHover = null;
      cancelGhostRotation(ghost);
      ghost?.remove();
      cachedStorageBoards=null;
      view.removeEventListener('scroll',invalidateStorageBoards,true);
      view.removeEventListener('resize',invalidateStorageBoards,true);
      boardGeometry = null;
      footprintPreview?.destroy();
      footprintPreview = null;
      clearDropTargets(root);
    };

    const finish = (endEvent) => {
      if (endEvent.pointerId !== pointerId) return;
      view.removeEventListener("keydown", rotate, true);
      view.removeEventListener("pointermove", move, true);
      view.removeEventListener("pointerup", finish, true);
      view.removeEventListener("pointercancel", cancel, true);
      view.removeEventListener("blur", cancel, true);
      if (!dragging) { cleanup(); return; }
      endEvent.preventDefault();
      endEvent.stopPropagation();
      if (trashcanDropActorItem(sheet.actor,sheet.actor.items.get(itemId),endEvent.clientX,endEvent.clientY,element.ownerDocument)) {cleanup();return;}
      if(handleNpcPointerDrop(sheet,root,itemId,endEvent.clientX,endEvent.clientY,queueMutation)){
        cleanup();return;
      }
      // A drop on the hotbar creates a shortcut, not an inventory move.
      if (assignInventoryHotbarDrop(sheet.actor, sheet.actor.items.get(itemId),
        endEvent.clientX, endEvent.clientY, element.ownerDocument)) { cleanup(); return; }
      const underPointer = element.ownerDocument.elementFromPoint(endEvent.clientX, endEvent.clientY);
      const finalBounds=shapeBounds(rotatedCells(dragShapes?.[itemId] || sheet.actor.items.get(itemId)?.getFlag?.('buxaframework','item')?.shape,rotation));
      const groundGrip={rotation,
        gripX:((grabbedCell?.x ?? Math.floor(grabbedX/Math.max(1,sourceRect.width)*finalBounds.width))+.5)/finalBounds.width,
        gripY:((grabbedCell?.y ?? Math.floor(grabbedY/Math.max(1,sourceRect.height)*finalBounds.height))+.5)/finalBounds.height};
      if (dropInventoryIntoGroundContainer(sheet.actor,sheet.actor.items.get(itemId),endEvent.clientX,endEvent.clientY,element.ownerDocument,groundGrip)) {cleanup();return;}
      // Board transfer uses the same mouse/pen/touch interaction as inventory
      // placement. The source document changes only after GM confirmation.
      const droppedOnScene = dropInventoryItemOnBoard(sheet.actor, sheet.actor.items.get(itemId),
        endEvent.clientX, endEvent.clientY);
      if (droppedOnScene) { cleanup(); return; }
      // The Item Directory is a cross-surface MOVE, not a local inventory
      // placement. Only remove the source after the authoritative GM confirms
      // that the newly created world Item exists.
      const directoryTarget=physicalDropTargetFromClient(endEvent.clientX,endEvent.clientY);
      if(directoryTarget?.kind==='world') {
        cleanup();
        void transferInventoryItemToDirectory(sheet.actor,sheet.actor.items.get(itemId),endEvent.clientX,endEvent.clientY);
        return;
      }
      // Never use the last animation frame: pointerup may arrive before rAF.
      // Resolve the saved destination from exactly the same cursor/grip math.
      const occupiedId=collisionScanner?.occupied?.get?.(stackHover?.cellAt(endEvent.clientX,endEvent.clientY));
      const recharge=inventoryRechargeTarget(sheet.actor,itemId,underPointer,
        occupiedId || stackHover?.targetAt(endEvent.clientX,endEvent.clientY));
      if(recharge){cleanup();queueInventoryRecharge(queueMutation,sheet.actor,recharge);return;}
      const destination = dropAt(endEvent.clientX, endEvent.clientY, underPointer);
      if(destination?.area==='inventory' && isComplex) destination.rotation=rotation;
      // A stack merge is deliberately resolved from the occupied cell UNDER
      // THE POINTER, not the source shape's origin nor an obscured DOM node.
      const storageStackId = destination?.area === 'storage' && !destination.containerDrop
        ? compatibleStorageStackTarget(destination, underPointer, sheet.actor, itemId,
          (dragStorageState ||= getInventoryState(sheet.actor, cfg)).placements, cfg, canStackItems)
        : null;
      const mergeId = destination?.containerDrop ? null :
        (stackHover?.targetAt(endEvent.clientX, endEvent.clientY) || storageStackId);
      const valid = Boolean(mergeId) || (destination?.area === 'storage'
        ? canDropIntoStorage(sheet.actor, destination, itemId, cfg, dragShapes)
        : (!isComplex || destination?.area !== 'inventory' || (destination?.valid && collisionScanner?.fits(itemId, destination.index, rotation))));
      // Snapshot the final pointer position before the drag ghost is removed.
      if (valid && destination?.area === 'equipment') paintDrag({x:endEvent.clientX,y:endEvent.clientY});
      const equipMotion = valid && !mergeId ? prepareEquipmentDropMotion(sheet, itemId, destination, ghost, underPointer) : null;
      cleanup();
      if (!valid || (!destination && !mergeId)) {
        if(destination?.containerDrop)notifyWarning('This backpack has no room for that item.');
        return;
      }
      void queueMutation(async () => {
        await commitEquipmentDropMotion(equipMotion, () => handleInternalDrop(sheet, itemId, underPointer, destination, { stackTargetId: mergeId }));
        // The Actor's document update already refreshes its open sheets.
        // A second forced render here made inventory drops stutter.
      });
    };

    const cancel = (cancelEvent) => {
      if (cancelEvent?.pointerId != null && cancelEvent.pointerId !== pointerId) return;
      view.removeEventListener("keydown", rotate, true);
      view.removeEventListener("pointermove", move, true);
      view.removeEventListener("pointerup", finish, true);
      view.removeEventListener("pointercancel", cancel, true);
      view.removeEventListener("blur", cancel, true);
      cleanup();
    };

    view.addEventListener('scroll',invalidateStorageBoards,true);
    view.addEventListener('resize',invalidateStorageBoards,true);
    view.addEventListener("keydown", rotate, true);
    view.addEventListener("pointermove", move, true);
    view.addEventListener("pointerup", finish, true);
    view.addEventListener("pointercancel", cancel, true);
    view.addEventListener("blur", cancel, true);
  };
  element.addEventListener("pointerdown", beginDrag);
  return beginDrag;
}

function bindNativeDragFallback(_sheet, element) {
  // The custom pointer interaction handles mouse, pen and touch. Starting
  // HTML Drag & Drop on the same element also creates a second native drag
  // image and may swallow pointerup, leaving a stranded preview.
  element.setAttribute("draggable", "false");
  element.addEventListener("dragstart", (event) => event.preventDefault());
}

export function bindInventoryControls(sheet, { queueMutation }) {
  const root = sheet.element;
  if (!root) return;
  closeItemContextMenu(sheet);

  root.querySelector("[data-action='toggleInventoryAutoSort']")?.addEventListener("click", (event) => {
    event.preventDefault();
    const enabled = event.currentTarget.dataset.autoSort !== "true";
    void queueMutation(async () => {
      await setInventoryAutoSort(sheet.actor, enabled, getSheetConfig());
      // Foundry redraws the open Actor sheet on document updates.
    });
  });

  root.querySelectorAll("[data-action='sortInventory']").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const mode = button.dataset.sortMode || "alphabetic";
      void queueMutation(async () => {
        await setInventorySortMode(sheet.actor, mode, getSheetConfig());
        // Foundry redraws the open Actor sheet on document updates.
      });
    });
  });

  root.querySelectorAll('[data-equipment-tab]').forEach(button=>button.addEventListener('click',()=>{
    const id=button.dataset.equipmentTab;
    sheet._activeEquipmentTab = id;
    root.querySelectorAll('[data-equipment-tab]').forEach(el=>el.classList.toggle('is-active',el.dataset.equipmentTab===id));
    root.querySelectorAll('[data-equipment-tab-panel]').forEach(el=>el.hidden=el.dataset.equipmentTabPanel!==id);
  }));

  root.querySelectorAll("[data-action='selectEquipmentPosition']").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void queueMutation(async () => {
        await setEquipmentActivePosition(sheet.actor, button.dataset.equipmentSlotId, Number(button.dataset.equipmentPosition), getSheetConfig());
        // The document update triggers the sheet refresh.
      });
    });
  });

  const complexDragHandlers=new Map();
  root.querySelectorAll("[data-item-id]").forEach((element) => {
    element.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openBuxaItemSheet(sheet.actor?.items?.get?.(element.dataset.itemId));
    });
    // Show the action popup on the first right-button press. The subsequent
    // browser contextmenu event is suppressed for pointer invocation, while
    // keyboard Context Menu / Shift+F10 still works via contextmenu below.
    let lastRightPointer = null;
    element.addEventListener("pointerdown", (event) => {
      if (event.button !== 2) return;
      event.preventDefault();
      event.stopPropagation();
      const item = sheet.actor?.items?.get?.(element.dataset.itemId);
      if (!item) return;
      lastRightPointer = { time: Date.now(), x: event.clientX, y: event.clientY };
      openItemContextMenu(sheet, item, event, { queueMutation });
    });
    element.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (lastRightPointer && Date.now() - lastRightPointer.time < 650
          && Math.abs(event.clientX - lastRightPointer.x) < 3
          && Math.abs(event.clientY - lastRightPointer.y) < 3) {
        lastRightPointer = null;
        return;
      }
      lastRightPointer = null;
      const item = sheet.actor?.items?.get?.(element.dataset.itemId);
      if (item) openItemContextMenu(sheet, item, event, { queueMutation });
    });
    const start=bindPointerItemDrag(sheet, element, queueMutation, root);
    if(element.matches("[data-complex-item]"))complexDragHandlers.set(element.dataset.itemId,start);
    bindNativeDragFallback(sheet, element);
  });

  bindComplexInventoryBoardHits(sheet,root,complexDragHandlers,queueMutation);

  root.querySelectorAll("[data-inventory-index], [data-storage-index], [data-equipment-slot]").forEach((slot) => {
    slot.addEventListener("dragenter", () => { clearDropTargets(root); slot.classList.add("is-inventory-drop-target"); });
    slot.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      slot.classList.add("is-inventory-drop-target");
    });
    slot.addEventListener("dragleave", (event) => {
      if (event.relatedTarget && slot.contains(event.relatedTarget)) return;
      slot.classList.remove("is-inventory-drop-target");
    });
    slot.addEventListener("drop", (event) => {
      slot.classList.remove("is-inventory-drop-target");
      const itemId = event.dataTransfer?.getData(BUXA_ITEM_MIME);
      if (!itemId) return;
      const destination = getInventoryDropDestination(event);
      if(!destination && !inventoryRechargeTarget(sheet.actor,itemId,event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      void queueMutation(async () => {
        const changed = await handleInternalDrop(sheet, itemId, event.target, destination);
        // The Actor's document update already refreshes its open sheets.
        // A second forced render here made inventory drops stutter.
      });
    });
  });

  bindItemHoverTooltips(sheet);
}
