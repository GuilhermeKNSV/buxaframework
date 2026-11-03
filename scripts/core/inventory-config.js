import { savedBoolean } from "./stored-values.js";
import { numericField } from "./numeric-field.js";
export const INVENTORY_SIZE_PATTERNS = Object.freeze([
  { id: "small", label: "Small · 1×1", width: 1, height: 1 },
  { id: "wide", label: "Wide · 2×1", width: 2, height: 1 },
  { id: "tall", label: "Tall · 1×2", width: 1, height: 2 },
  { id: "long", label: "Long · 1×3", width: 1, height: 3 },
  { id: "large", label: "Large · 2×2", width: 2, height: 2 }
]);

export const EQUIPMENT_SLOT_DEFINITIONS = Object.freeze([
  { id: "weapon", label: "WEAPON", defaultSize: "long", defaultCapacity: 2, legacyDefaultCount: 1 },
  { id: "offhand", label: "OFFHAND", defaultSize: "long", defaultCapacity: 2, legacyDefaultCount: 1 },
  { id: "helmet", label: "HELMET", defaultSize: "wide", defaultCapacity: 1, legacyDefaultCount: 1 },
  { id: "chestplate", label: "CHESTPLATE", defaultSize: "large", defaultCapacity: 1, legacyDefaultCount: 1 },
  { id: "pants", label: "PANTS", defaultSize: "wide", defaultCapacity: 1, legacyDefaultCount: 1 },
  { id: "boots", label: "BOOTS", defaultSize: "wide", defaultCapacity: 1, legacyDefaultCount: 1 },
  { id: "gloves", label: "GLOVES", defaultSize: "small", defaultCapacity: 1, legacyDefaultCount: 1 },
  { id: "belt", label: "BELT", defaultSize: "wide", defaultCapacity: 1, legacyDefaultCount: 1 },
  { id: "mask", label: "MASK", defaultSize: "small", defaultCapacity: 1, legacyDefaultCount: 0 },
  { id: "cape", label: "CAPE", defaultSize: "tall", defaultCapacity: 1, legacyDefaultCount: 0 },
  { id: "ring", label: "RING", defaultSize: "small", defaultCapacity: 1, legacyDefaultCount: 0 },
  { id: "necklace", label: "NECKLACE", defaultSize: "small", defaultCapacity: 1, legacyDefaultCount: 0 },
  { id: "misc", label: "MISC", defaultSize: "small", defaultCapacity: 1, legacyDefaultCount: 0 },
  { id: "potion", label: "POTION", defaultSize: "small", defaultCapacity: 1, legacyDefaultCount: 0 },
  { id: "scroll", label: "SCROLL", defaultSize: "tall", defaultCapacity: 1, legacyDefaultCount: 0 },
  { id: "backpack", label: "BACKPACK", defaultSize: "large", defaultCapacity: 1, legacyDefaultCount: 0 },
  { id: "gold", label: "GOLD", defaultSize: "small", defaultCapacity: 1, legacyDefaultCount: 0 }
]);

export const DEFAULT_EQUIPMENT_LAYOUT = Object.freeze({
  columns: 12,
  rows: 7,
  snapToGrid: true,
  tabs: Object.freeze([{id:"main", label:"Main", columns:12, rows:7}]),
  slots: Object.freeze([
    { id: "weapon-1", type: "weapon", label: "WEAPON", size: "long", capacity: 2, x: 1, y: 1 },
    { id: "offhand-1", type: "offhand", label: "OFFHAND", size: "long", capacity: 2, x: 10, y: 1 },
    { id: "helmet-1", type: "helmet", label: "HELMET", size: "wide", capacity: 1, x: 5, y: 0 },
    { id: "chestplate-1", type: "chestplate", label: "CHESTPLATE", size: "large", capacity: 1, x: 5, y: 1 },
    { id: "gloves-1", type: "gloves", label: "GLOVES", size: "small", capacity: 1, x: 3, y: 2 },
    { id: "belt-1", type: "belt", label: "BELT", size: "wide", capacity: 1, x: 5, y: 3 },
    { id: "pants-1", type: "pants", label: "PANTS", size: "wide", capacity: 1, x: 5, y: 4 },
    { id: "boots-1", type: "boots", label: "BOOTS", size: "wide", capacity: 1, x: 7, y: 4 }
  ].map((slot) => Object.freeze({ ...slot, color: "#344052", background: "" })))
});

const SIZE_IDS = new Set(INVENTORY_SIZE_PATTERNS.map((entry) => entry.id));
const TYPE_IDS = new Set(EQUIPMENT_SLOT_DEFINITIONS.map((entry) => entry.id));

function asInt(value, fallback = 0, { min = -Infinity, max = Infinity } = {}) {
  // Blank form values, booleans and objects are not intentional capacities.
  return numericField(value, fallback, min, max, true);
}

function asNumber(value, fallback = 0, { min = -Infinity, max = Infinity } = {}) {
  return numericField(value, fallback, min, max);
}

function normalizeColor(value, fallback = "#344052") {
  const color = String(value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : fallback;
}

function cleanId(value, fallback = "slot") {
  const id = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return id || fallback;
}

export function getEquipmentDefinition(type) {
  return EQUIPMENT_SLOT_DEFINITIONS.find((entry) => entry.id === type) ?? null;
}

export function getInventorySizePattern(id) {
  return INVENTORY_SIZE_PATTERNS.find((entry) => entry.id === id) ?? INVENTORY_SIZE_PATTERNS[0];
}

export function getEquipmentSlot(config, slotId) {
  const inventory = normalizeInventoryConfig(config?.inventory ?? config);
  return inventory.equipmentLayout.slots.find((slot) => slot.id === slotId) ?? null;
}

function uniqueSlotId(candidate, used, type = "slot") {
  const base = cleanId(candidate, `${type}-1`);
  let id = base;
  let suffix = 2;
  while (used.has(id)) id = `${base}-${suffix++}`;
  used.add(id);
  return id;
}

function defaultSlotPosition(type, index, columns, rows, size) {
  const preset = DEFAULT_EQUIPMENT_LAYOUT.slots.find((slot) => slot.type === type && index === 1);
  if (preset) return { x: preset.x, y: preset.y };

  const width = size.width;
  const height = size.height;
  const serial = Math.max(0, EQUIPMENT_SLOT_DEFINITIONS.findIndex((entry) => entry.id === type)) + Math.max(0, index - 1);
  const maxX = Math.max(0, columns - width);
  const maxY = Math.max(0, rows - height);
  return {
    x: Math.min(maxX, serial % Math.max(1, columns)),
    y: Math.min(maxY, Math.floor(serial / Math.max(1, columns)))
  };
}

function normalizeSlot(input, { used, columns, rows, fallbackType = "misc", fallbackIndex = 1 } = {}) {
  const raw = input && typeof input === "object" ? input : {};
  const type = TYPE_IDS.has(raw.type) ? raw.type : fallbackType;
  const definition = getEquipmentDefinition(type) ?? getEquipmentDefinition("misc");
  const sizeId = SIZE_IDS.has(raw.size) ? raw.size : definition.defaultSize;
  const size = getInventorySizePattern(sizeId);
  const position = defaultSlotPosition(type, fallbackIndex, columns, rows, size);
  const maxX = Math.max(0, columns - size.width);
  const maxY = Math.max(0, rows - size.height);
  return {
    id: uniqueSlotId(raw.id || `${type}-${fallbackIndex}`, used, type),
    type,
    label: String(raw.label || definition.label).trim().slice(0, 40) || definition.label,
    size: size.id,
    capacity: asInt(raw.capacity, definition.defaultCapacity ?? 1, { min: 1, max: 12 }),
    x: asNumber(raw.x, position.x, { min: 0, max: maxX }),
    y: asNumber(raw.y, position.y, { min: 0, max: maxY }),
    color: normalizeColor(raw.color, "#344052"),
    background: String(raw.background || "").trim().slice(0, 500),
    hidden: raw.hidden === true,
    tabId: String(raw.tabId || "main").slice(0, 48)
  };
}

function migrateLegacyEquipment(raw, columns, rows) {
  const hasLegacyEquipment = Boolean(raw?.equipment && typeof raw.equipment === "object");
  const legacy = hasLegacyEquipment ? raw.equipment : {};
  const used = new Set();
  const slots = [];

  for (const definition of EQUIPMENT_SLOT_DEFINITIONS) {
    const legacyEntry = legacy[definition.id] && typeof legacy[definition.id] === "object" ? legacy[definition.id] : {};
    const fallbackCount = hasLegacyEquipment ? 0 : definition.legacyDefaultCount;
    const count = asInt(legacyEntry.count, fallbackCount, { min: 0, max: 100 });
    const size = SIZE_IDS.has(legacyEntry.size) ? legacyEntry.size : definition.defaultSize;
    for (let index = 1; index <= count; index += 1) {
      slots.push(normalizeSlot({
        id: `${definition.id}-${index}`,
        type: definition.id,
        label: count > 1 ? `${definition.label} ${index}` : definition.label,
        size,
        capacity: definition.defaultCapacity ?? 1
      }, { used, columns, rows, fallbackType: definition.id, fallbackIndex: index }));
    }
  }
  return slots;
}

function normalizeEquipmentLayout(input, rawInventory) {
  const raw = input && typeof input === "object" ? input : {};
  const columns = asInt(raw.columns, DEFAULT_EQUIPMENT_LAYOUT.columns, { min: 4, max: 24 });
  const incoming = Array.isArray(raw.slots) ? raw.slots : null;
  const minimumRows = incoming?.length
    ? Math.max(1, ...incoming.map((slot) => getInventorySizePattern(SIZE_IDS.has(slot?.size) ? slot.size : getEquipmentDefinition(slot?.type)?.defaultSize).height))
    : 1;
  const rows = Math.max(minimumRows, asInt(raw.rows, DEFAULT_EQUIPMENT_LAYOUT.rows, { min: 1, max: 24 }));
  const tabsIn = Array.isArray(raw.tabs) && raw.tabs.length ? raw.tabs : [{ id:"main", label:"Main", columns, rows }];
  const ids = new Set();
  const tabs = tabsIn.slice(0, 16).map((entry,index)=>{
    const base=cleanId(entry?.id || (index===0?'main':`tab-${index+1}`));
    let id=base,serial=2;while(ids.has(id))id=`${base}-${serial++}`;ids.add(id);
    return {id,label:String(entry?.label || (index===0?'Main':`Tab ${index+1}`)).slice(0,32),columns:asInt(entry?.columns,columns,{min:4,max:24}),rows:asInt(entry?.rows,rows,{min:1,max:24})};
  });
  const used = new Set();
  const slots = incoming
    ? incoming.map((slot, index) => {
      const tab=tabs.find(t=>t.id===slot?.tabId) || tabs[0];
      return normalizeSlot(slot, {
        used,columns:tab.columns,rows:tab.rows,
        fallbackType: TYPE_IDS.has(slot?.type) ? slot.type : "misc",
        fallbackIndex: index + 1
      });
    })
    : migrateLegacyEquipment(rawInventory, columns, rows);

  for (const slot of slots) {
    if (!ids.has(slot.tabId)) slot.tabId=tabs[0].id;
    const tab=tabs.find(t=>t.id===slot.tabId);
    const size=getInventorySizePattern(slot.size);
    slot.x=Math.min(slot.x,Math.max(0,tab.columns-size.width));
    slot.y=Math.min(slot.y,Math.max(0,tab.rows-size.height));
  }
  return {
    columns,
    rows,
    tabs,
    snapToGrid: savedBoolean(raw.snapToGrid,true),
    slots
  };
}

export function normalizeInventoryConfig(input) {
  const raw = input && typeof input === "object" ? input : {};
  const weightRaw = raw.weight && typeof raw.weight === "object" ? raw.weight : {};
  return {
    slots: asInt(raw.slots, 50, { min: 1, max: 200 }),
    mode: raw.mode === 'complex' ? 'complex' : 'simple',
    complex: {
      columns: asInt(raw.complex?.columns, 10, {min:2,max:20}),
      rows: asInt(raw.complex?.rows, 5, {min:1,max:40}),
      autoSort: savedBoolean(raw.complex?.autoSort)
    },
    weight: {
      enabled: savedBoolean(weightRaw.enabled),
      capacity: asNumber(weightRaw.capacity, 100, { min: 0, max: 1000000 })
    },
    equipmentLayout: normalizeEquipmentLayout(raw.equipmentLayout, raw)
  };
}

export function createEquipmentSlot(type, existingSlots = [], {
  x = null,
  y = null,
  columns = DEFAULT_EQUIPMENT_LAYOUT.columns,
  rows = DEFAULT_EQUIPMENT_LAYOUT.rows
} = {}) {
  const definition = getEquipmentDefinition(type) ?? getEquipmentDefinition("misc");
  const used = new Set((existingSlots ?? []).map((slot) => String(slot?.id || "")).filter(Boolean));
  let index = 1;
  while (used.has(`${definition.id}-${index}`)) index += 1;
  const size = getInventorySizePattern(definition.defaultSize);
  columns = asInt(columns, DEFAULT_EQUIPMENT_LAYOUT.columns, { min: 4, max: 24 });
  rows = asInt(rows, DEFAULT_EQUIPMENT_LAYOUT.rows, { min: 1, max: 24 });
  const position = defaultSlotPosition(definition.id, index, columns, rows, size);
  return normalizeSlot({
    id: `${definition.id}-${index}`,
    type: definition.id,
    label: index > 1 ? `${definition.label} ${index}` : definition.label,
    size: definition.defaultSize,
    capacity: definition.defaultCapacity ?? 1,
    x: x ?? position.x,
    y: y ?? position.y,
    color: "#344052",
    background: ""
  }, { used, columns, rows, fallbackType: definition.id, fallbackIndex: index });
}

export function duplicateEquipmentSlot(slot, existingSlots = [], {
  columns = DEFAULT_EQUIPMENT_LAYOUT.columns,
  rows = DEFAULT_EQUIPMENT_LAYOUT.rows
} = {}) {
  const definition = getEquipmentDefinition(slot?.type) ?? getEquipmentDefinition("misc");
  const copy = createEquipmentSlot(definition.id, existingSlots, {
    x: Number(slot?.x ?? 0) + 0.35,
    y: Number(slot?.y ?? 0) + 0.35,
    columns,
    rows
  });
  return {
    ...copy,
    label: String(slot?.label || definition.label).slice(0, 40),
    size: SIZE_IDS.has(slot?.size) ? slot.size : definition.defaultSize,
    capacity: asInt(slot?.capacity, definition.defaultCapacity ?? 1, { min: 1, max: 12 }),
    color: normalizeColor(slot?.color, "#344052"),
    background: String(slot?.background || "").trim().slice(0, 500),
    hidden: slot?.hidden === true
  };
}

export function getConfiguredEquipmentSlotIds(config) {
  const inventory = normalizeInventoryConfig(config?.inventory ?? config);
  return inventory.equipmentLayout.slots.map((slot) => slot.id);
}
