import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles/163-hotbar.css', import.meta.url), 'utf8');

function rule(selector) {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `${selector} must be declared`);
  return css.slice(start + selector.length + 2, css.indexOf('}', start));
}
function layer(selector) {
  const match = rule(selector).match(/\bz-index\s*:\s*(-?\d+)/);
  assert.ok(match, `${selector} must explicitly control stacking`);
  return Number(match[1]);
}

test('the sliding attribute drawer is behind the opaque hotbar forging plate', () => {
  const drawer = layer('.buxa-hb-attribute-drawer');
  const plate = layer('.buxa-hb-center::before');
  const board = layer('.buxa-hb-board-frame');
  const rail = layer('.buxa-hb-rail');
  assert.ok(drawer < plate, 'drawer must pass UNDER the actual hotbar backing (not only under its see-through slots)');
  assert.ok(plate < board, 'inventory shortcut slots must stay clickable on the front');
  assert.ok(board < rail, 'hotbar controls must stay reachable');
  assert.ok(layer('.buxa-hb-tabs') > plate, 'tab buttons must not be covered by the front plate');
  assert.match(rule('.buxa-hb-center::before'), /background\s*:\s*linear-gradient/);
  assert.match(rule('.buxa-hb-center::before'), /top\s*:\s*25px/);
  assert.match(rule('.buxa-hb-center::before'), /pointer-events\s*:\s*none/);
});

test('the drawer still slides in both directions and keeps the top-mounted square handle', () => {
  assert.match(rule('.buxa-hb-attribute-drawer'), /transform\s*:\s*translate\(-50%,calc\(100% - 1px\)\)/);
  assert.match(rule('.buxa-hb-attribute-drawer'), /transition\s*:\s*transform/);
  assert.match(rule('.buxa-hb-attribute-drawer.is-open'), /transform\s*:\s*translate\(-50%,0\)/);
  assert.match(rule('.buxa-hb-attribute-toggle'), /border-radius\s*:\s*0/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});
