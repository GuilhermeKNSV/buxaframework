import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_SHEET_CONFIG } from '../scripts/core/constants.js';
import { normalizeEffectRules } from '../scripts/core/effect-config.js';
import { rarityPresentation, normalizeItemSystemConfig } from '../scripts/core/item-config.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Effect sheet renders the complete, existing item rarity class and token contract', () => {
  const tpl = read('templates/effect-sheet.hbs');
  const app = read('scripts/apps/effect-sheet.js');
  assert.match(tpl, /class="buxa-item-sheet bfx-effect-sheet \{\{rarityClass\}\}"/);
  assert.match(tpl, /style="\{\{rarityStyle\}\}"/);
  assert.match(tpl, /data-rarity-tier="\{\{rarityTier\}\}"/);
  assert.match(app, /rarityPresentation\(effectRarity,config\.items\)/);
  assert.match(app, /rarityClass:effectTheme\.className,rarityStyle:effectTheme\.style/);
  assert.doesNotMatch(app, /applyRarityVisual\(node,/);
  const rarityConfig = normalizeItemSystemConfig(DEFAULT_SHEET_CONFIG.items);
  const effect = normalizeEffectRules({rarityId:'mythical'}, rarityConfig);
  const rarity = rarityConfig.rarities.find(r => r.id === effect.rarityId);
  const presentation = rarityPresentation(rarity,rarityConfig);
  assert.match(presentation.className,/buxa-rarity-mythical/);
  assert.match(presentation.style,/--buxa-rarity-color:/);
  assert.match(presentation.style,/--buxa-rarity-bg-opacity:/);
});

test('Magic retains the normal item sheet and Item/Effect conversions retain selected rarity', () => {
  const itemSheet = read('scripts/apps/item-sheet.js');
  const itemConfig = read('scripts/apps/item-config.js');
  const effectConfig = read('scripts/apps/effect-config.js');
  assert.match(itemSheet,/if \(getItemKind\(item\) === 'effect'\)/);
  assert.match(itemSheet,/return new BuxaItemSheet\(\{ document: item \}\)/);
  assert.match(itemConfig,/`flags\.\$\{MODULE_ID\}\.effect\.rarityId`\]: data\.rarityId/);
  assert.match(effectConfig,/`flags\.\$\{MODULE_ID\}\.item\.rarityId`\]: data\.rarityId/);
});

test('Effect summary uses the established rarity material, not a blue overlay box', () => {
  const css = read('styles/183-effects.css');
  assert.match(css,/\.buxa-item-sheet \.buxa-item-hero\s*\{\s*border-bottom:\s*0/);
  assert.match(css,/\.bfx-effect-summary\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*none;/);
  assert.match(css,/\.bfx-effect-sheet\s*\{[\s\S]*?--bfx-accent:\s*var\(--rv-light/);
  assert.match(css,/\.bfx-kind-badge\s*\{[\s\S]*?background:\s*transparent/);
});
