/** Pure layout grouping for mixed token HUD styles. No canvas dependencies. */
export function planResourceHudLayout(entries = []) {
  const offsets = new Map();
  return entries.map(entry => {
    const { style, position, thickness, scale } = entry.settings;
    const vertical = style === "vertical";
    const side = (position === "top" || position === "left") ? "left" : "right";
    const key = vertical ? `vertical:${side}` : `horizontal:${position}`;
    const offset = offsets.get(key) || 0;
    const barThickness = Math.max(vertical ? 5 : 4, Number(thickness) * Number(scale));
    const advance = vertical ? barThickness + 20 : Math.max(25, barThickness + 17);
    offsets.set(key, offset + advance);
    return { entry, offset };
  });
}
