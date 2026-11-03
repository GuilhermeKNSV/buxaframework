import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../styles/${name}`, import.meta.url), 'utf8');

function keyframeStart(css, keyframesName) {
  const start = css.indexOf(`@keyframes ${keyframesName}`);
  assert.ok(start !== -1, `${keyframesName} exists`);
  const body = css.slice(start).match(/\{\s*0%\s*,\s*100%\s*\{([^}]*)\}/);
  assert.ok(body, `${keyframesName} has 0% and 100% frames`);
  return body[1];
}

test('all legacy inventory-spectrum frame animations begin at the configured item rarity, not red', () => {
  for (const [file, name] of [
    ['39-items.css', 'buxa-rarity-spectrum-frame'],
    ['95-rarity-polish.css', 'buxa-rarity-spectrum-border'],
    ['96-item-fantasy.css', 'buxa-item-slot-spectrum']
  ]) {
    const firstFrame = keyframeStart(read(file), name);
    assert.match(firstFrame, /var\(--buxa-rarity-color/);
    assert.doesNotMatch(firstFrame, /#(?:ef5268|ff5f72|ff6578)/i);
  }
});

test('hovering a Spectrum item does not cancel and restart its animation from the first frame', () => {
  const css = read('162-inventory-rarity-hover.css');
  const section = css.slice(css.indexOf('/* Keep the Spectrum/RGB animation clock'), css.indexOf('/* The moving preview replaces'));
  assert.match(section, /\.buxa-inventory-slot\.has-item\.is-rarity-spectrum:hover/);
  assert.match(section, /border-color:\s*var\(--buxa-rarity-color/);
  assert.match(section, /box-shadow:/);
  assert.doesNotMatch(section, /animation\s*:\s*none|animation-play-state\s*:\s*paused/);
  assert.match(css, /\.buxa-complex-item\.is-rarity-hovered:not\(\.is-dragging\)\s*>\s*\.buxa-complex-decoration\s*\{[\s\S]*?filter:[\s\S]*?!important;/);
});
