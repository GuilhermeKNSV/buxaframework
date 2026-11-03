import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { HOOKS } from '../scripts/core/constants.js';
import { fakeSceneFxDocument, fakeSceneFxCanvas } from './helpers/scene-fx-dom.mjs';
import { sceneTokenScreenPosition, removeSceneProgressionEffects } from '../scripts/apps/scene-progression-svg.js';

globalThis.foundry ??= { utils: { deepClone: structuredClone, randomID: () => '123456' } };
const { normalizeSheetConfig } = await import('../scripts/core/config.js');
const { progressionColor, matchingProgressionTokens, progressionVisual, playTokenProgressionFx, installSceneProgressionFx, showProgressionFallback } = await import('../scripts/apps/scene-progression-fx.js');
const { sourceInventoryTarget } = await import('../scripts/apps/source-item-navigation.js');

test('world option keeps saved cards intact while forcing an expanded display', () => {
  assert.equal(normalizeSheetConfig({}).attributes.allowCollapse, true);
  assert.equal(normalizeSheetConfig({ attributes: { allowCollapse: false } }).attributes.allowCollapse, false);
  const template = fs.readFileSync(new URL('../templates/player-sheet.hbs', import.meta.url), 'utf8');
  const cfg = fs.readFileSync(new URL('../templates/layout-config.hbs', import.meta.url), 'utf8');
  const code = fs.readFileSync(new URL('../scripts/apps/player-sheet-context.js', import.meta.url), 'utf8');
  assert.match(cfg, /data-attributes-allow-collapse/);
  assert.match(code, /config\.attributes\.allowCollapse !== false && ui\.collapsed === true/);
  assert.match(template, /\{\{#if showCollapseToggle\}\}<button[^>]*toggleAttributeCollapse/);
});

test('item sources are actionable by embedded Item ID instead of ambiguous item names', () => {
  const template = fs.readFileSync(new URL('../templates/player-sheet.hbs', import.meta.url), 'utf8');
  assert.equal((template.match(/data-source-item-id="\{\{itemId\}\}"/g) ?? []).length, 3);
  const nodes = [
    { dataset: { itemId: 'aaa' }, closest: () => ({ hidden: true }) },
    { dataset: { itemId: 'aaa' }, closest: () => null },
    { dataset: { itemId: 'bbb' }, closest: () => null }
  ];
  assert.equal(sourceInventoryTarget({ querySelectorAll: () => nodes }, 'aaa'), nodes[1]);
  assert.equal(sourceInventoryTarget({ querySelectorAll: () => nodes }, 'unknown'), null);
  assert.match(fs.readFileSync(new URL('../scripts/core/value-sources.js', import.meta.url), 'utf8'), /itemId: item\.id/);
});

test('level and rebirth use distinct scene effects with configured rebirth rarity', () => {
  assert.equal(progressionColor('#f9a'), '#ff99aa');
  assert.equal(progressionColor('invalid'), '#76baff');
  const level = progressionVisual('level', { newLevel: 14 });
  const attribute = { label: 'Strength', rebirth: { enabled: true }, appearance: {} };
  const rebirth = progressionVisual('rebirth', { attribute, after: 3 }, {
    rebirthStyles: [{ color: '#eeeeee' }, { color: '#11aadd' }, { color: '#ff9933' }]
  });
  assert.equal(level.title, 'LEVEL UP');
  assert.equal(level.subtitle, 'ASCENDED');
  assert.equal(level.value, '14');
  assert.equal(level.color, '#efc65a');
  assert.equal(rebirth.title, 'REBIRTH');
  assert.equal(rebirth.subtitle, 'STRENGTH');
  assert.equal(rebirth.value, 'R3');
  assert.equal(rebirth.color, '#ff9933');
});

test('scene FX never appears on unrelated actors or hidden tokens', () => {
  const actor = { id: 'a' };
  const tokens = [
    { document: { id: '1', actorId: 'a' }, center: { x: 10, y: 20 } },
    { document: { id: '2', actorId: 'b' }, center: { x: 20, y: 20 } },
    { document: { id: '3', actorId: 'a', hidden: true }, center: { x: 0, y: 0 } }
  ];
  globalThis.game = { user: { isGM: false } };
  assert.deepEqual(matchingProgressionTokens(actor, tokens), [tokens[0]]);
  assert.deepEqual(matchingProgressionTokens({ id: 'a', isToken: true, token: { id: '1' } }, tokens), [tokens[0]]);
  assert.deepEqual(matchingProgressionTokens(null, tokens), []);
});

test('SVG scene celebration anchors above a token, uses the correct level/rebirth markup and cleans up', () => {
  const doc = fakeSceneFxDocument();
  const token = { w:70, h:70, center:{ x:100, y:200 } };
  const canvasRef = fakeSceneFxCanvas([token]);
  const nativeTimer = globalThis.setTimeout;
  let delayedCleanup;
  globalThis.setTimeout = callback => { delayedCleanup = callback; return 0; };
  try {
    const visual = progressionVisual('level', { newLevel: 714 });
    assert.equal(playTokenProgressionFx(token, visual, { canvasRef, documentRef: doc, reducedMotion:true }), true);
    assert.equal(doc.body.children.length, 1);
    const effect = doc.body.children[0];
    assert.equal(effect.style.left, '105px');
    assert.equal(effect.style.top, '209px');
    assert.equal(effect.styleData['--buxa-token-half-height'], '35px');
    assert.equal(effect.querySelector('.buxa-celebration-number').textContent, '714');
    assert.equal(effect.querySelector('.buxa-celebration-label').textContent, 'LEVEL UP');
    assert.equal(effect.querySelector('.buxa-celebration-sublabel').textContent, '');
    assert.equal(sceneTokenScreenPosition(canvasRef, token).x, 105);
    delayedCleanup();
    assert.equal(doc.body.children.length, 0);
    assert.equal(playTokenProgressionFx(token, visual, { canvasRef:{ ...canvasRef, ready:false }, documentRef:doc }), false);
  } finally { globalThis.setTimeout = nativeTimer; removeSceneProgressionEffects(); }
});

test('rebirth badge shows REBIRTH and attribute only, not R plus tier', () => {
  const doc = fakeSceneFxDocument();
  const token = { document: { id: 'rebirth-token' }, w: 70, h: 70, center: { x: 200, y: 170 } };
  const canvasRef = fakeSceneFxCanvas([token]);
  const rebirth = progressionVisual('rebirth', {
    attribute: { id: 'str', label: 'Strength', rebirth: { enabled: true } }, after: 7
  }, { rebirthStyles: [{ color: '#ff5566' }] });
  try {
    assert.equal(rebirth.value, 'R7', 'retain the real tier internally for distinct events');
    assert.equal(playTokenProgressionFx(token, rebirth, { canvasRef, documentRef: doc, reducedMotion: true }), true);
    const node = doc.body.children[0];
    assert.equal(node.querySelector('.buxa-celebration-label').textContent, 'REBIRTH');
    assert.equal(node.querySelector('.buxa-celebration-number').textContent, '');
    assert.equal(node.querySelector('.buxa-celebration-sublabel').textContent, 'STRENGTH');
    const css = fs.readFileSync(new URL('../styles/160-scene-progression-fx.css', import.meta.url), 'utf8');
    assert.match(css, /\.is-rebirth \.buxa-celebration-number \{ display: none; \}/);
    const shown = [];
    canvasRef.interface.createScrollingText = (_position, text) => { shown.push(text); };
    assert.equal(showProgressionFallback(canvasRef, token, rebirth), true);
    assert.deepEqual(shown, ['REBIRTH · STRENGTH']);
  } finally { removeSceneProgressionEffects(); }
});

test('repeat level-ups reuse the same token celebration, update the number live, and extend cleanup', () => {
  const doc = fakeSceneFxDocument();
  const token = { document: { id: 'tokenA' }, w: 70, h: 70, center: { x: 140, y: 180 } };
  const canvasRef = fakeSceneFxCanvas([token]);
  const nativeTimer = globalThis.setTimeout;
  const nativeClear = globalThis.clearTimeout;
  const timers = [];
  globalThis.setTimeout = callback => { timers.push(callback); return timers.length; };
  globalThis.clearTimeout = () => {};
  try {
    assert.equal(playTokenProgressionFx(token, progressionVisual('level', { newLevel: 834 }), { canvasRef, documentRef: doc, reducedMotion: true }), true);
    assert.equal(doc.body.children.length, 1);
    const effect = doc.body.children[0];
    assert.equal(effect.querySelector('.buxa-celebration-number').textContent, '834');
    assert.equal(playTokenProgressionFx(token, progressionVisual('level', { newLevel: 835 }), { canvasRef, documentRef: doc, reducedMotion: true }), true);
    assert.equal(doc.body.children.length, 1, 'should reuse the same DOM effect instead of stacking a second one');
    assert.equal(effect.querySelector('.buxa-celebration-number').textContent, '835');
    assert.equal(effect.classes.has('is-updated'), true, 'existing card switches to idle glow and rotating circle');
    const css = fs.readFileSync(new URL('../styles/160-scene-progression-fx.css', import.meta.url), 'utf8');
    assert.match(css, /is-updated .buxa-celebration-svg[\s\S]*?buxa-celebration-idle-spin/);
    assert.doesNotMatch(fs.readFileSync(new URL('../scripts/apps/scene-progression-svg.js', import.meta.url), 'utf8'), /refreshAnimations\(node\)/);
    timers.at(-1)?.();
    assert.equal(doc.body.children.length, 0);
  } finally {
    globalThis.setTimeout = nativeTimer;
    globalThis.clearTimeout = nativeClear;
    removeSceneProgressionEffects();
  }
});

test('clicking an item source switches to inventory, highlights the exact item and saves active tab', async () => {
  const { revealSourceItem } = await import('../scripts/apps/source-item-navigation.js');
  const item = {
    dataset: { itemId: 'item42' },
    classes: new Set(),
    classList: { add(cls) { item.classes.add(cls); }, remove(cls) { item.classes.delete(cls); } },
    closest: () => null,
    scrollIntoView: () => { item.scrolled = true; },
    ownerDocument: { defaultView: { setTimeout: () => {} } }, offsetWidth: 44
  };
  const settings = {};
  globalThis.game = {
    world: { id: 'world' }, user: { id: 'owner', isGM: false },
    settings: { get: (_module, key) => settings[key] ?? {}, set: async (_module, key, value) => { settings[key] = value; } }
  };
  const sheet = {
    actor: { uuid: 'Actor.1', id: '1', items: { get: id => id === 'item42' ? { id } : null } },
    element: { querySelectorAll: () => [item] },
    activateInventoryTab() { this.tabActivated = true; }
  };
  assert.equal(await revealSourceItem(sheet, 'item42'), true);
  assert.equal(sheet._activeTab, 'inventory');
  assert.equal(sheet.tabActivated, true);
  assert.equal(item.scrolled, true);
  assert.equal(item.classes.has('buxa-source-item-flash'), true);
  assert.equal(settings.sheetUiState['world:owner:Actor.1'].activeTab, 'inventory');
  assert.equal(await revealSourceItem(sheet, 'missing'), false);
});

test('scene progression broadcasts safe payloads and is scene scoped', () => {
  const listeners = new Map();
  const packets = [];
  globalThis.Hooks = { on: (name, cb) => listeners.set(name, cb) };
  globalThis.canvas = { ready: false, scene: { id: 'scene1' } };
  globalThis.game = { user: { id: 'owner' }, actors: { get: () => null }, socket: {
    on: (channel, fn) => listeners.set(channel, fn),
    emit: (channel, packet) => { packets.push({ channel, packet }); }
  } };
  installSceneProgressionFx();
  listeners.get(HOOKS.LEVEL_UP)({ id: 'actorA' }, { newLevel: 9 });
  assert.equal(packets.length, 1);
  assert.equal(packets[0].channel, 'module.buxaframework');
  assert.equal(packets[0].packet.sceneId, 'scene1');
  assert.equal(packets[0].packet.visual.title, 'LEVEL UP');
  assert.doesNotThrow(() => listeners.get('module.buxaframework')({ type: 'progression-fx', sender: 'other', sceneId: 'scene2' }));
});
