/*
 * Item sheet presentation helper.
 * Foundry and third-party icon packs frequently ship opaque PNG thumbnails with
 * a uniform dark square behind a pale silhouette. PNG alone does not imply an
 * alpha channel. Make those specific icons float over the item's rarity hero,
 * without modifying transparent assets or detailed/full-color illustrations.
 * Only one small image is inspected on an item-sheet render; other inventory
 * artwork and its visual rarity background are not touched.
 */
const processedArtwork = new Map();
const CACHE_LIMIT = 36;

const distance = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
const brightness = (rgb) => (rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722);
const chroma = (rgb) => Math.max(...rgb) - Math.min(...rgb);

/** Inspect a small RGBA raster. Returns the flat corner color only for a monochrome emblem. */
export function identifyFlatIconBackground(pixels, width, height) {
  if (!(width >= 12 && height >= 12) || !pixels || pixels.length < width * height * 4) return null;
  const insetX = Math.max(1, Math.floor(width * .045));
  const insetY = Math.max(1, Math.floor(height * .045));
  const cornerPoints = [
    [insetX, insetY], [width - insetX - 1, insetY],
    [insetX, height - insetY - 1], [width - insetX - 1, height - insetY - 1]
  ];
  const corners = cornerPoints.map(([x, y]) => {
    const i = (y * width + x) * 4;
    return [pixels[i], pixels[i+1], pixels[i+2], pixels[i+3]];
  });
  // Already transparent / decorated in the corners; never edit its pixels.
  if (corners.some((p) => p[3] < 245)) return null;
  const average = [0, 1, 2].map((channel) => Math.round(corners.reduce((n, c) => n + c[channel], 0) / 4));
  if (corners.some((c) => distance(c, average) > 18) || chroma(average) > 38 || brightness(average) > 165) return null;

  let opaque = 0;
  let background = 0;
  let bright = 0;
  let brightChroma = 0;
  const total = width * height;
  const stride = Math.max(1, Math.floor(total / 12000));
  let sampled = 0;
  for (let j = 0; j < total; j += stride) {
    const i = j * 4;
    sampled++;
    if (pixels[i+3] < 245) continue;
    opaque++;
    const rgb = [pixels[i], pixels[i+1], pixels[i+2]];
    if (distance(rgb, average) < 23) background++;
    if (brightness(rgb) - brightness(average) > 75) {
      bright++;
      brightChroma += chroma(rgb);
    }
  }
  // Only icon-like rasters: solid background + bright, nearly monochrome emblem.
  if (opaque / sampled < .99 || background / sampled < .26 || bright / sampled < .035 || bright / sampled > .68 || brightChroma / bright > 48) return null;
  return average;
}

/** Mutates only the supplied raster. Returns whether it actually changed. */
export function removeFlatIconBackground(pixels, width, height) {
  const background = identifyFlatIconBackground(pixels, width, height);
  if (!background) return false;
  for (let i = 0; i < width * height * 4; i += 4) {
    const difference = distance([pixels[i], pixels[i+1], pixels[i+2]], background);
    if (difference <= 12) pixels[i+3] = 0;
    else if (difference < 34) pixels[i+3] = Math.round(pixels[i+3] * (difference - 12) / 22);
  }
  return true;
}

export function enhanceItemSheetArtwork(root) {
  const img = root?.querySelector?.(".buxa-item-hero-icon");
  if (!img) return;
  const url = img.getAttribute("src");
  if (!url || img.dataset.buxaArtworkSource === url) return;
  img.dataset.buxaArtworkSource = url;
  if (processedArtwork.has(url)) {
    const processed = processedArtwork.get(url);
    if (processed) img.src = processed;
    return;
  }
  const process = () => {
    if (img.dataset.buxaArtworkSource !== url || !img.naturalWidth || !img.naturalHeight) return;
    try {
      const factor = Math.min(1, 192 / Math.max(img.naturalWidth, img.naturalHeight));
      const width = Math.max(1, Math.round(img.naturalWidth * factor));
      const height = Math.max(1, Math.round(img.naturalHeight * factor));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, width, height);
      const data = ctx.getImageData(0, 0, width, height);
      const changed = removeFlatIconBackground(data.data, width, height);
      let nextUrl = null;
      if (changed) {
        ctx.putImageData(data, 0, 0);
        nextUrl = canvas.toDataURL("image/png");
        if (img.isConnected && img.dataset.buxaArtworkSource === url) img.src = nextUrl;
      }
      if (processedArtwork.size >= CACHE_LIMIT) processedArtwork.delete(processedArtwork.keys().next().value);
      processedArtwork.set(url, nextUrl);
    } catch {
      // SecurityError from non-CORS artwork, undecodable media, or canvas failure:
      // display the untouched source rather than breaking the item sheet.
    }
  };
  if (img.complete && img.naturalWidth) process();
  else img.addEventListener("load", process, { once: true });
}
