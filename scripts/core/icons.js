import { MODULE_ID } from "./constants.js";

const ROOT = `modules/${MODULE_ID}/assets/icons`;

export const UI_SVG_ICONS = Object.freeze({
  fullbody: `${ROOT}/body.svg`,
  token: `${ROOT}/token.svg`
});

export const EQUIPMENT_SVG_ICONS = Object.freeze({
  weapon: `${ROOT}/weapon.svg`,
  offhand: `${ROOT}/offhand.svg`,
  helmet: `${ROOT}/helmet.svg`,
  chestplate: `${ROOT}/chestplate.svg`,
  pants: `${ROOT}/pants.svg`,
  boots: `${ROOT}/boots.svg`,
  gloves: `${ROOT}/gloves.svg`,
  belt: `${ROOT}/belt.svg`,
  mask: `${ROOT}/mask.svg`,
  cape: `${ROOT}/cape.svg`,
  ring: `${ROOT}/ring.svg`,
  necklace: `${ROOT}/necklace.svg`,
  misc: `${ROOT}/misc.svg`,
  potion: `${ROOT}/potion.svg`,
  scroll: `${ROOT}/scroll.svg`,
  backpack: `${ROOT}/backpack.svg`,
  gold: `${ROOT}/gold.svg`
});

const PICKER_LABELS = Object.freeze({
  body: "Body",
  token: "Token",
  weapon: "Weapon",
  offhand: "Shield / Offhand",
  helmet: "Helmet",
  chestplate: "Chestplate",
  pants: "Pants",
  boots: "Boots",
  gloves: "Gloves",
  belt: "Belt",
  mask: "Mask",
  cape: "Cape",
  ring: "Ring",
  necklace: "Necklace",
  misc: "Misc",
  potion: "Potion",
  scroll: "Scroll",
  backpack: "Backpack",
  gold: "Gold"
});

export const SVG_PICKER_ICONS = Object.freeze([
  ...Object.entries(UI_SVG_ICONS).map(([id, path]) => ({ id, label: PICKER_LABELS[id] || id, path })),
  ...Object.entries(EQUIPMENT_SVG_ICONS).map(([id, path]) => ({ id, label: PICKER_LABELS[id] || id, path }))
]);

export function getUiSvgIcon(name) {
  return UI_SVG_ICONS[name] || "";
}

export function getEquipmentSvgIcon(type) {
  return EQUIPMENT_SVG_ICONS[type] || EQUIPMENT_SVG_ICONS.misc;
}

export function getSvgPickerIcons() {
  return SVG_PICKER_ICONS.map((entry) => ({ ...entry }));
}
