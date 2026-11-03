import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const polish = await readFile(new URL('styles/182-sidebar-dock-polish.css', root), 'utf8');
const base = await readFile(new URL('styles/181-sidebar-edit-buttons.css', root), 'utf8');
const imports = await readFile(new URL('styles/buxa.css', root), 'utf8');

test('sidebar Edit Buttons never uses rounded corners in its polished styles', () => {
  const radii = [...polish.matchAll(/border-radius\s*:\s*([^;{}\n]+)/g)].map(m => m[1].trim());
  assert.ok(radii.length > 15, 'coverage for every floating control');
  for (const value of radii) assert.match(value, /^0\s*!important$/, `rounded declaration: ${value}`);
  for (const name of ['radius', 'bubble-radius', 'button-radius']) {
    assert.match(polish, new RegExp(`--buxa-sbp-${name}:\\s*0\\s*;`));
  }
  assert.match(polish, /\.buxa-sb-context \*, \.buxa-sb-context \*::before/);
  assert.match(polish, /\.buxa-sb-save-menu \*, \.buxa-sb-save-menu \*::before/);
});

test('square editor styling loads after base and keeps animations and reduced motion', () => {
  assert.match(imports, /181-sidebar-edit-buttons\.css[\s\S]*182-sidebar-dock-polish\.css/);
  assert.match(base, /border-radius:0 !important/);
  assert.match(polish, /@keyframes buxa-sbp-bubble-in/);
  assert.match(polish, /@keyframes buxa-sbp-dock-arrive/);
  assert.match(polish, /@media\(prefers-reduced-motion:reduce\)/);
});
