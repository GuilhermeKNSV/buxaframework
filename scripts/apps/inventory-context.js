import { itemIsExhausted } from "../core/item-use-config.js";
import { complexDecorationGeometry } from "../core/complex-shape-decoration.js";
import { equipmentArtworkFit, shouldEnlargeEquipmentArtwork } from "../core/equipment-artwork-zoom.js";
import { equipmentArtworkTransform } from "../core/item-equip-artwork.js";
import { getItemQuantity } from "../core/dnd5e.js";
import { rotatedCells, shapeBounds } from "../core/inventory-shapes.js";
import { shapeArtworkStyle } from "../core/shape-artwork.js";
import { stackArtworkFor } from "../core/item-stack-artwork.js";
import {
  getInventorySizePattern,
  normalizeInventoryConfig
} from "../core/inventory-config.js";
import { getInventoryState, getActorStorage, getEffectiveInventoryConfig } from "../core/inventory.js";
import { storageVisibleBounds } from "../core/item-storage.js";
import { visibleOpenedCompartments } from "../core/storage-open-state.js";
import { getEquipmentSvgIcon } from "../core/icons.js";
import { MODULE_ID } from "../core/constants.js";
import { buildComplexHitMap } from "../core/inventory-hit-map.js";
import { normalizeItemRules, rarityPresentation } from "../core/item-config.js";
import { getActorLevel } from "../core/leveling.js";

function createItemViewResolver(actor, config, editable) {
  const views = new Map();
  const rarities = config.items?.rarities ?? [];
  const rarityById = new Map(rarities.map((entry) => [entry.id, entry]));
  const visuals = new Map();
  let actorLevel;

  return (item) => {
    if (!item) return null;
    if (views.has(item)) return views.get(item);
    const rules = normalizeItemRules(item.getFlag?.(MODULE_ID, "item"), config.items);
    const rarity = rarityById.get(rules.rarityId) ?? rarities[0];
    const rarityKey = rarity?.id ?? "default";
    if (!visuals.has(rarityKey)) visuals.set(rarityKey, rarityPresentation(rarity, config.items));
    const visual = visuals.get(rarityKey);
    const quantity = getItemQuantity(item);
    const requirementEnabled = rules.levelRequirement.enabled;
    if (requirementEnabled && actorLevel === undefined) actorLevel = getActorLevel(actor, config);
    const weight = rules.weight.enabled
      ? Math.max(0, Number(rules.weight.value) || 0) * Math.max(0, quantity)
      : 0;
    const art = stackArtworkFor({img:item.img,flags:{buxaframework:{item:rules}}},quantity);
    const view = {
      shape: rules.shape,
      equipArtwork: rules.equipArtwork,
      stackLayers:art.custom ? art.layers : null,
      id: item.id,
      name: item.name,
      img: art.img,
      type: item.type,
      quantity,
      showQuantity: quantity > 1,
      draggable: editable,
      rarity,
      rarityClass: visual.className,
      exhausted:itemIsExhausted(rules.limits,item.getFlag?.(MODULE_ID,"itemUsage")),
      rarityStyle: visual.style,
      weight,
      requirement: {
        enabled: requirementEnabled,
        met: !requirementEnabled || actorLevel >= rules.levelRequirement.level,
        required: requirementEnabled ? rules.levelRequirement.level : 0,
        actorLevel: requirementEnabled ? actorLevel : null
      }
    };
    views.set(item, view);
    return view;
  };
}

function placementLookup(state) {
  const byInventory = new Map();
  const byEquipment = new Map();
  for (const itemId of state.tracked) {
    const placement = state.placements[itemId];
    if (placement?.area === "inventory") byInventory.set(Number(placement.index), itemId);
    else if (placement?.area === "equipment") {
      byEquipment.set(`${placement.slotId}:${Number(placement.position ?? 0)}`, itemId);
    }
  }
  return { byInventory, byEquipment };
}

function equipmentSlotView(slot, byEquipment, items, state, layout, svgIconsEnabled, itemView) {
  const size = getInventorySizePattern(slot.size);
  const columns = Math.max(1, Number(layout.columns) || 12);
  const rows = Math.max(1, Number(layout.rows) || 7);
  const activePosition = Math.min(slot.capacity - 1, Math.max(0, Number(state.equipmentActive?.[slot.id] ?? 0)));
  const positions = Array.from({ length: slot.capacity }, (_, position) => {
    const itemId = byEquipment.get(`${slot.id}:${position}`);
    return { position, number: position + 1, active: position === activePosition, occupied: Boolean(itemId) };
  });
  const activeItemId = byEquipment.get(`${slot.id}:${activePosition}`);
  const item = itemView(items.get(activeItemId));
  const customBackground = String(slot.background || "").trim();
  const background = customBackground || (svgIconsEnabled ? getEquipmentSvgIcon(slot.type) : "");
  const rarityClass = item ? item.rarityClass : "";
  const rarityStyle = item ? item.rarityStyle : "";
  const artFit = equipmentArtworkFit(size.width, size.height, shouldEnlargeEquipmentArtwork(slot.type, item));
  const artTransform = equipmentArtworkTransform(item?.equipArtwork?.[slot.size]);

  return {
    ...slot,
    background,
    width: size.width,
    height: size.height,
    activePosition,
    activeNumber: activePosition + 1,
    hasMultiplePositions: slot.capacity > 1,
    positions,
    rarityClass,
    style: [
      `--buxa-slot-x:${Number(slot.x) || 0}`,
      `--buxa-slot-y:${Number(slot.y) || 0}`,
      `--buxa-slot-w:${size.width}`,
      `--buxa-slot-h:${size.height}`,
      `--buxa-equipped-art-zoom:${artFit.zoom}`,
      `--buxa-equipped-art-transform:${artTransform}`,
      `--buxa-equipped-art-width:${artFit.width}`,
      `--buxa-equipped-art-height:${artFit.height}`,
      `--buxa-equipped-art-fit:${artFit.fit}`,
      `--buxa-equip-columns:${columns}`,
      `--buxa-equip-rows:${rows}`,
      `--buxa-slot-color:${slot.color || "#344052"}`,
      rarityStyle
    ].filter(Boolean).join(";"),
    hasBackground: Boolean(background),
    item
  };
}

function formatWeight(value) {
  const number = Math.round((Number(value) || 0) * 100) / 100;
  return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function prepareInventoryContext(actor, config, editable) {
  const inventoryConfig = getEffectiveInventoryConfig(actor,config);
  const state = getInventoryState(actor, config);
  const grants = getActorStorage(actor, config);
  const items = new Map([...(actor.items ?? [])].map((item) => [item.id, item]));
  const itemView = createItemViewResolver(actor, config, editable);
  const { byInventory, byEquipment } = placementLookup(state);
  const layout = inventoryConfig.equipmentLayout;
  const equipmentSlots = layout.slots.filter(slot=>!slot.hidden || grants.unlocked.has(slot.id)).map((slot) => equipmentSlotView(
    slot, byEquipment, items, state, layout,
    config.addons?.svgIcons?.enabled === true, itemView
  ));

  const complexMode = inventoryConfig.mode === 'complex';
  const inventorySlots = Array.from({ length: complexMode ? 0 : inventoryConfig.slots }, (_, index) => {
    const itemId = byInventory.get(index);
    return { index, number: index + 1, item: itemView(items.get(itemId)) };
  });
  const overflow = state.tracked.filter((itemId) => !state.placements[itemId])
    .map((itemId) => itemView(items.get(itemId))).filter(Boolean);
  const inventoryItemCount = inventorySlots.reduce((total, slot) => total + (slot.item ? 1 : 0), 0);
  const totalWeight = state.tracked.reduce((total, itemId) => total + (itemView(items.get(itemId))?.weight ?? 0), 0);
  const capacity = Math.max(0, Number(inventoryConfig.weight.capacity) || 0);

  // Hit-map is computed once per render, reusing the same normalized item
  // views. Pointerdown on a complex grid cell must not re-read every flag,
  // rebuild the Actor inventory state, and rotate every item shape.
  const complexItems = complexMode ? state.tracked.filter(id => state.placements[id]?.area === 'inventory').map(id => {
    const pos = state.placements[id], item = itemView(items.get(id));
    if (!item) return null;
    const cells = rotatedCells(item.shape, pos.rotation || 0), b = shapeBounds(cells);
    return {...item, rotation:pos.rotation||0, index:pos.index, artworkStyle:shapeArtworkStyle(item.shape,pos.rotation||0),
      shapeWidth:b.width,shapeHeight:b.height,decoration:complexDecorationGeometry(cells),rectangularShape:cells.length === b.width*b.height && (b.width > 1 || b.height > 1),
      style:`${item.rarityStyle};--buxa-shape-x:${pos.index%inventoryConfig.complex.columns};--buxa-shape-y:${Math.floor(pos.index/inventoryConfig.complex.columns)};--buxa-shape-w:${b.width};--buxa-shape-h:${b.height};--buxa-image-scale:${item.shape.imageScale/100};--buxa-image-x:${item.shape.imageX};--buxa-image-y:${item.shape.imageY}`,
      pieces:cells.map(c=>({x:c.x,y:c.y,style:`--buxa-cx:${c.x};--buxa-cy:${c.y};--buxa-shape-w:${b.width};--buxa-shape-h:${b.height}`}))
    };
  }).filter(Boolean) : [];
  const complexHitMap = complexMode ? buildComplexHitMap(complexItems, inventoryConfig.complex.columns) : new Map();
  // The Actor still owns compartments while bags are unequipped (preserving
  // their contents), but they must not remain permanently open on the sheet.
  // Nested pouches are shown only when their equipped ancestor is visible.
  const externalStorage = visibleOpenedCompartments(actor,grants.compartments,state.placements).map(bag=>{
    const storageEntries=state.tracked.filter(id=>state.placements[id]?.area==='storage' && state.placements[id].storageId===bag.storageId);
    const positioned=storageEntries.map(id=>{
      const placement=state.placements[id];const view=itemView(items.get(id));if(!view)return null;
      const cells=bag.itemMode==='complex'?rotatedCells(view.shape,placement.rotation||0):[{x:0,y:0}];
      const b=shapeBounds(cells);
      return {...view,rotation:placement.rotation||0,index:placement.index,storageId:bag.storageId,
        artworkStyle:shapeArtworkStyle(view.shape,placement.rotation||0),shapeWidth:b.width,shapeHeight:b.height,
        decoration:complexDecorationGeometry(cells),
        style:`${view.rarityStyle};--buxa-shape-x:${placement.index%bag.columns};--buxa-shape-y:${Math.floor(placement.index/bag.columns)};--buxa-shape-w:${b.width};--buxa-shape-h:${b.height}`,
        pieces:cells.map(c=>({x:c.x,y:c.y,style:`--buxa-cx:${c.x};--buxa-cy:${c.y};--buxa-shape-w:${b.width};--buxa-shape-h:${b.height}`}))
      };
    }).filter(Boolean);
    const byCell=new Map();
    for(const entry of positioned)for(const piece of entry.pieces){
      const x=entry.index%bag.columns+piece.x,y=Math.floor(entry.index/bag.columns)+piece.y;
      byCell.set(y*bag.columns+x,entry);
    }
    const visibleBounds = storageVisibleBounds(bag);
    const source=items.get(bag.providerId);
    const rarity = source ? itemView(source) : null;
    const tint=bag.rarityStyle==='item'?(rarity?.rarity?.color||'#819db8'):bag.rarityStyle==='neutral'?'#8195a8':bag.color;
    const cells=Array.from({length:bag.columns*bag.rows},(_,index)=>({
      index, enabled:bag.mode!=='complex'||bag.cells.includes(index),
      item:bag.itemMode==='simple'?byCell.get(index):null,
      hitItemId:byCell.get(index)?.id || ''
    }));
    return {...bag, isComplex:bag.itemMode==='complex',cells,
      compactHeader:visibleBounds.columns<=2,
      items:positioned,
      borderClass:bag.border?'with-border':'without-border',backgroundClass:bag.background?'with-background':'without-background',
      style:`--buxa-storage-columns:${bag.columns};--buxa-storage-rows:${bag.rows};--buxa-storage-color:${tint};--buxa-complex-columns:${bag.columns};--buxa-complex-rows:${bag.rows};--buxa-storage-visible-columns:${visibleBounds.columns};--buxa-storage-visible-rows:${visibleBounds.rows};--buxa-storage-crop-x:${visibleBounds.x};--buxa-storage-crop-y:${visibleBounds.y}`};
  });

  return {
    slots: inventoryConfig.mode === "complex" ? (inventoryConfig.complex.activeCells??inventoryConfig.complex.columns*inventoryConfig.complex.rows) : inventoryConfig.slots,
    used: inventoryConfig.mode === "complex" ? state.tracked.reduce((sum,id)=>sum+(state.placements[id]?.area==="inventory" ? (itemView(items.get(id))?.shape?.cells?.length || 1) : 0),0) : inventoryItemCount,
    autoSort: state.autoSort,
    canAutoSort: inventoryConfig.mode !== "complex" || inventoryConfig.complex.autoSort,
    autoSortLabel: state.autoSort ? "AUTO" : "MANUAL",
    sortMode: state.sortMode || "alphabetic",
    sortModeLabel: ({ quantity: "QUANTITY", alphabetic: "ALPHABETICAL", rarity: "RARITY" })[state.sortMode] || "ALPHABETICAL",
    sortQuantity: state.sortMode === "quantity",
    sortAlphabetic: state.sortMode === "alphabetic" || !state.sortMode,
    sortRarity: state.sortMode === "rarity",
    equipmentColumns: layout.columns,
    equipmentRows: layout.rows,
    equipmentBoardStyle: `--buxa-equip-columns:${layout.columns};--buxa-equip-rows:${layout.rows}`,
    equipmentSlots,
    showEquipmentTabs:layout.tabs.length>1,
    externalStorage,
    hasExternalStorage:externalStorage.length>0,
    equipmentTabs: layout.tabs.map(tab=>({ ...tab,
      slots: equipmentSlots.filter(slot=>slot.tabId===tab.id).map(slot=>({
        ...slot,
        style: slot.style + `;--buxa-equip-columns:${tab.columns};--buxa-equip-rows:${tab.rows}`
      })),
      boardStyle:`--buxa-equip-columns:${tab.columns};--buxa-equip-rows:${tab.rows}`
    })),
    complexMode,
    complexColumns: inventoryConfig.complex.columns,
    complexRows: inventoryConfig.complex.rows,
    complexBoardStyle: `--buxa-complex-columns:${inventoryConfig.complex.columns};--buxa-complex-rows:${inventoryConfig.complex.rows}`,
    complexCells: complexMode ? Array.from({length:inventoryConfig.complex.columns*inventoryConfig.complex.rows},(_,index)=>({index,enabled:index<(inventoryConfig.complex.activeCells??Infinity),itemId:complexHitMap.get(index)||''})) : [],
    complexItems,
    hasEquipment: equipmentSlots.length > 0,
    inventorySlots,
    overflow,
    hasOverflow: overflow.length > 0,
    weight: {
      enabled: inventoryConfig.weight.enabled,
      total: totalWeight,
      totalText: formatWeight(totalWeight),
      capacity,
      capacityText: formatWeight(capacity),
      over: inventoryConfig.weight.enabled && totalWeight > capacity
    }
  };
}
