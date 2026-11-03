/**
 * Screen-aware scaling for token-attached resource displays.
 * Foundry's stage zoom still controls position/movement. Only the HUD's
 * local PIXI scale is adjusted, so a distant token retains readable bars.
 */
const finitePositive = value => Number.isFinite(Number(value)) && Number(value) > 0;

/**
 * Change HUD size more gently than the canvas: zooming out compensates for
 * part of the lost screen pixels, while zooming in is subtly attenuated.
 * Restrict size to ~30% of the canvas width (and 380px) so large custom bars
 * cannot accidentally cover the entire canvas at extreme zoom levels.
 */
export function resourceHudZoomMultiplier(zoom, { baseWidth = 160, viewportWidth } = {}) {
  const z = finitePositive(zoom) ? Math.max(0.05, Math.min(8, Number(zoom))) : 1;
  let factor = Math.max(0.55, Math.min(2.35, z ** -0.58));
  if (finitePositive(baseWidth) && finitePositive(viewportWidth)) {
    const maxPixels = Math.min(380, Number(viewportWidth) * 0.31);
    factor = Math.min(factor, maxPixels / (Number(baseWidth) * z));
  }
  return factor;
}

/** Estimated maximum horizontal HUD footprint in token-local pixels. */
export function estimateResourceHudWidth(token, entries) {
  const width = finitePositive(token?.w) ? Number(token.w) : 100;
  const height = finitePositive(token?.h) ? Number(token.h) : width;
  return Math.max(1, ...(entries ?? []).map(({ settings: s }) => {
    const scale = finitePositive(s.scale) ? Number(s.scale) : 1;
    const thickness = finitePositive(s.thickness) ? Number(s.thickness) : 11;
    if (s.style === "vertical") return thickness * scale + 75;
    const base = Math.max(90, Math.min(330, width * (s.style === "sao" ? 1.5 : 1.15)));
    return base * scale + 45;
  }));
}
