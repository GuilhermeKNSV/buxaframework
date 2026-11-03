import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const permittedBySource = (allowed, requested) => {
  // HTML Drag and Drop: a move-only dataTransfer cannot be accepted as a
  // copy, even if the destination prevents default on dragover.
  const effects = {
    none: [], copy: ['copy'], move: ['move'], link: ['link'],
    copyMove: ['copy', 'move'], copyLink: ['copy', 'link'],
    linkMove: ['link', 'move'], all: ['copy', 'move', 'link']
  };
  return (effects[allowed] || []).includes(requested);
};

for (const path of ['scripts/apps/item-directory-view.js', 'scripts/apps/item-folder-panels.js']) {
  test(`${path}: Item Directory drag supports both copy-to-board and folder moves`, () => {
    const code = source(path);
    const allowed = [...code.matchAll(/event\.dataTransfer\.effectAllowed\s*=\s*["']([^"']+)["']/g)].map(match => match[1]);
    assert.ok(allowed.includes('copyMove'), 'World Item drags must support board copying and folder moving');
    assert.ok(allowed.includes('move'), 'Folder drags must support moving without creating copies');
    assert.equal(permittedBySource('copyMove', 'copy'), true);
    assert.equal(permittedBySource('copyMove', 'move'), true);
    assert.match(code, /setData\(["']text\/plain["'], JSON\.stringify\(\{ type: ["']Item["'], uuid: item\.uuid \}\)\)/);
    assert.match(code, /dropEffect\s*=\s*["']move["']/);
  });
}

test('Scene board and cross-surface destinations accept the copy effect exposed by world Item drags', () => {
  const canvas = source('scripts/integrations/physical-item-canvas.js');
  const actor = source('scripts/integrations/physical-item-handoff.js');
  const container = source('scripts/apps/ground-container-window.js');
  for (const code of [canvas, actor, container]) {
    assert.match(code, /dropEffect\s*=\s*["']copy["']/);
  }
  assert.match(canvas, /handleItemDrop\(e,point\)/);
  assert.match(canvas, /source:'actor',actorId:actor\.id/);
  assert.match(canvas, /source,sceneId:canvas\.scene\.id,itemId:item\.id,point/);
});
