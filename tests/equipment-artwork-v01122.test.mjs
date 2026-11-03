import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const read = (file) => readFileSync(new URL(file, import.meta.url), 'utf8');

test('equipment image is uniformly zoomed in elongated slots without distortion', () => {
  const css = read('../styles/141-responsive-item-artwork.css');
  assert.match(css, /object-fit:\s*contain\s*!important/);
  assert.match(css, /width:\s*var\(--buxa-equipped-art-width, 100%\)/);
  assert.match(css, /height:\s*var\(--buxa-equipped-art-height, 100%\)/);
  assert.doesNotMatch(css, /object-fit:\s*fill|scaleX\(|scaleY\(|--buxa-art-fill/);
  assert.match(css, /buxa-equipment-slot\.has-item/);
  assert.match(css, /buxa-inventory-slot\.has-item/);
  assert.doesNotMatch(css, /buxa-complex-art/);
});

test('no equipment artwork geometry is recalculated on sheet render', () => {
  const sheet = read('../scripts/apps/player-sheet.js');
  const ctx = read('../scripts/apps/inventory-context.js');
  const tmpl = read('../templates/player-sheet.hbs');
  assert.doesNotMatch(sheet, /fitEquipmentArtwork/);
  assert.match(ctx, /equipmentArtworkFit/);
  assert.doesNotMatch(ctx, /artworkFillX|artworkFillY|--buxa-art-fill/);
  assert.doesNotMatch(tmpl, /data-buxa-art-fit|data-buxa-art-ratio/);
  assert.equal(existsSync(new URL('../scripts/apps/equipment-artwork-fit.js', import.meta.url)), false);
  assert.equal(existsSync(new URL('../scripts/core/equipment-artwork.js', import.meta.url)), false);
});

test('CSS remains loaded after normal rarity and inventory styles', () => {
  const entry = read('../styles/buxa.css');
  assert.match(entry, /@import url\("\.\/141-responsive-item-artwork\.css"\)/);
  assert.ok(entry.indexOf('141-responsive-item-artwork') > entry.indexOf('140-complex-shape-decoration'));
});
