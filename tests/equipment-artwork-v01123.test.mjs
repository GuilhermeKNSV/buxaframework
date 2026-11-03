import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { equipmentArtworkZoom, shouldEnlargeEquipmentArtwork } from '../scripts/core/equipment-artwork-zoom.js';
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');

test('square slots and malformed dimensions never zoom or distort', () => {
  assert.equal(equipmentArtworkZoom(1, 1), 1);
  assert.equal(equipmentArtworkZoom(4, 4), 1);
  assert.equal(equipmentArtworkZoom(0, 3), 1);
  assert.equal(equipmentArtworkZoom(NaN, 5), 1);
});

test('portrait and landscape slots uniformly enlarge artwork', () => {
  assert.equal(equipmentArtworkZoom(1, 2), 1.4);
  assert.equal(equipmentArtworkZoom(2, 1), 1.4);
  assert.equal(equipmentArtworkZoom(1, 3), 1.8);
  assert.equal(equipmentArtworkZoom(3, 1), 1.8);
  assert.equal(equipmentArtworkZoom(1, 999), 1.8);
});

test('equip context sets a zoom per slot, independent of rarity and inventory mode', () => {
  const ctx = read('../scripts/apps/inventory-context.js');
  assert.match(ctx, /equipmentArtworkFit\(size\.width, size\.height/);
  assert.match(ctx, /shouldEnlargeEquipmentArtwork\(slot\.type, item\)/);
  assert.match(ctx, /--buxa-equipped-art-zoom:/);
  const css = read('../styles/141-responsive-item-artwork.css');
  assert.match(css, /object-fit:\s*var\(--buxa-equipped-art-fit, contain\)/);
  assert.match(css, /width:\s*var\(--buxa-equipped-art-width, 100%\)/);
  assert.doesNotMatch(css, /scaleX\(|scaleY\(|object-fit:\s*fill/);
  const simple = css.slice(css.indexOf('.buxa .buxa-inventory-slot.has-item'));
  assert.match(simple, /transform: none !important/);
  assert.doesNotMatch(simple, /buxa-equipped-art-zoom/);
});

test('stacked coins stay proportional while long tools and weapons enlarge', () => {
  const coin = { type: 'tool', shape: { cells: [{x:0,y:0}] }, showQuantity:true };
  const axe = { type: 'tool', shape: { cells: [{x:0,y:0},{x:0,y:1},{x:0,y:2}] }, showQuantity:false };
  const plainTool = { type: 'tool', shape: { cells: [{x:0,y:0}] }, showQuantity:false };
  assert.equal(shouldEnlargeEquipmentArtwork('offhand', coin), false);
  assert.equal(shouldEnlargeEquipmentArtwork('offhand', axe), true);
  assert.equal(shouldEnlargeEquipmentArtwork('weapon', plainTool), true);
  assert.equal(shouldEnlargeEquipmentArtwork('offhand', plainTool), false);
  assert.equal(shouldEnlargeEquipmentArtwork('offhand', {type:'weapon', shape:plainTool.shape}), true);
});
