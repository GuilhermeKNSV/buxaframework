import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultHotbarState, assignHotbarSlot, hotbarSlots } from '../scripts/core/hotbar-state.js';
globalThis.CONST ??= {};
globalThis.foundry ??= {
  applications: {api: {ApplicationV2: class {}, HandlebarsApplicationMixin: Base => Base},
    apps: {FilePicker: class {}}, sheets: {ItemSheetV2: class {}}},
  utils: {deepClone: structuredClone, randomID: () => 'id'}
};
const { getHotbarState, saveHotbarState } = await import('../scripts/apps/hotbar.js');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

for (let n = 0; n < 12; n++) {
  test(`rapid edit ${n + 1}: concurrent saves are ordered without reversing the shortcut layout`, async () => {
    const initial = defaultHotbarState();
    let persisted = initial; let concurrent = 0; let maxConcurrent = 0;
    globalThis.game = { settings: {
      get: () => persisted,
      set: async (_module, _key, next) => {
        concurrent++; maxConcurrent = Math.max(maxConcurrent, concurrent);
        // Older action intentionally resolves last.
        await sleep(concurrent === 1 ? 5 : 0);
        persisted = next;
        concurrent--;
      }
    }};
    const first = assignHotbarSlot(getHotbarState(),'Actor.rapid','tab-1',0,`item-${n}-one`);
    const firstSave = saveHotbarState(first);
    const second = assignHotbarSlot(getHotbarState(),'Actor.rapid','tab-1',1,`item-${n}-two`);
    const secondSave = saveHotbarState(second);
    await Promise.all([firstSave,secondSave]);
    assert.equal(maxConcurrent,1,'settings writes must be serialized');
    assert.deepEqual(hotbarSlots(persisted,'Actor.rapid').slice(0,2),[`item-${n}-one`,`item-${n}-two`]);
  });
}

test('a rejected write does not freeze subsequent hotbar saves', async () => {
  let value = defaultHotbarState(); let fails = true;
  globalThis.game = {settings:{get:()=>value,set:async(_module,_key,next)=>{
    if (fails) { fails = false; throw Error('transient settings failure'); }
    value=next;
  }}};
  await assert.rejects(saveHotbarState({...value,columns:11}),/transient settings failure/);
  await saveHotbarState({...value,columns:12});
  assert.equal(getHotbarState().columns,12);
});

test('a pending save is visible to the next rapid shortcut operation', async () => {
  let persisted = defaultHotbarState(); let release;
  globalThis.game = {settings:{get:()=>persisted,set:async(_mod,_key, next)=> {
    await new Promise(resolve=>{release = resolve;}); persisted=next;
  }}};
  const one = assignHotbarSlot(getHotbarState(),'Actor.rapid','tab-1',0,'sword');
  const pending = saveHotbarState(one);
  assert.equal(hotbarSlots(getHotbarState(),'Actor.rapid')[0],'sword');
  for (let n = 0; n < 10 && !release; n++) await sleep(0);
  assert.equal(typeof release, "function");
  release(); await pending;
});
