/** NPC Drop table: independent template snapshots, never equipment or inventory placements. */
import { MODULE_ID } from '../core/constants.js';
import { getSheetConfig } from '../core/config.js';
import { npcDropCapacity, npcDropTable, normalizeNpcDropEntry } from '../core/npc-dropping.js';
import { quantityOddsDraft, quantityOddsRows, setQuantityOddsPreset, serializeQuantityOdds } from '../core/npc-drop-odds.js';
import { notifyError, notifySuccess } from '../core/notifications.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const canEdit=actor=>actor?.type==='npc' && globalThis.game?.user?.isGM && actor.isOwner;
const pendingUpdates = new WeakMap();
function queueNpcDropUpdate(actor, mutation) {
  const earlier = pendingUpdates.get(actor) ?? Promise.resolve();
  const job = earlier.catch(() => {}).then(mutation);
  pendingUpdates.set(actor, job);
  void job.finally(() => { if (pendingUpdates.get(actor) === job) pendingUpdates.delete(actor); }).catch(() => {});
  return job;
}
let activeDialogClose = null;
function dialog(actor, entry) {
  // Only one editor can be open; close it through its cleanup handler.
  if (activeDialogClose && activeDialogClose() === false) return;
  const shade = document.createElement('div');
  shade.className = 'buxa-npc-drop-shade';
  shade.innerHTML = `<form class="buxa-npc-drop-dialog" aria-label="Drop rules for ${esc(entry.data.name)}">
    <header class="buxa-drop-dialog-header"><div><strong>${esc(entry.data.name)}</strong></div><button type="button" data-close aria-label="Close drop rules">×</button></header>
    <div class="buxa-drop-dialog-body">
      <section class="buxa-drop-rule-section">
        <div class="buxa-drop-field-heading"><label for="buxa-drop-chance">Chance to drop</label></div>
        <div class="buxa-drop-slider-field"><input aria-label="Drop chance slider" data-drop-range="chance" type="range" min="0" max="100" step="1" value="${entry.chance}"><div class="buxa-drop-number"><input id="buxa-drop-chance" name="chance" data-drop-number="chance" type="number" required min="0" max="100" step="1" value="${entry.chance}"><span>%</span></div></div>
      </section>
      <section class="buxa-drop-rule-section">
        <div class="buxa-drop-field-heading"><strong>Quantity range</strong></div>
        <div class="buxa-drop-quantity-pair">
          <label class="buxa-drop-quantity-field"><span>Minimum</span><div class="buxa-drop-slider-field"><input aria-label="Minimum quantity slider" data-drop-range="min" type="range" min="1" max="100" step="1" value="${entry.min}"><input aria-label="Minimum quantity number" name="min" data-drop-number="min" type="number" required min="1" max="100" step="1" value="${entry.min}"></div></label>
          <label class="buxa-drop-quantity-field"><span>Maximum</span><div class="buxa-drop-slider-field"><input aria-label="Maximum quantity slider" data-drop-range="max" type="range" min="1" max="100" step="1" value="${entry.max}"><input aria-label="Maximum quantity number" name="max" data-drop-number="max" type="number" required min="1" max="100" step="1" value="${entry.max}"></div></label>
        </div>
      </section>
      <section class="buxa-drop-rule-section">
        <label class="buxa-drop-field-heading" for="buxa-drop-destination"><strong>Drop destination</strong></label>
        <select id="buxa-drop-destination" name="destination"><option value="inventory" ${entry.destination === 'inventory' ? 'selected' : ''}>NPC corpse inventory</option><option value="ground" ${entry.destination === 'ground' ? 'selected' : ''}>Ground around NPC</option></select>
      </section>
      <section class="buxa-drop-rule-section buxa-drop-weights-section" data-drop-weights-section>
        <label class="buxa-drop-weights-toggle"><span class="buxa-drop-weights-text"><strong>Custom quantity weights</strong></span><span class="buxa-drop-weights-switch"><input type="checkbox" data-drop-weights-enabled ${entry.weightsEnabled ? 'checked' : ''} aria-label="Enable custom quantity weights"><span class="buxa-drop-weights-knob" aria-hidden="true"></span></span></label>
        <div class="buxa-drop-weights-content" data-drop-weights-content ${entry.weightsEnabled ? '' : 'hidden'}>
          <div class="buxa-drop-odds-presets" role="group" aria-label="Quantity chance presets"><button type="button" data-drop-preset="even">Equal</button><button type="button" data-drop-preset="lower">Prefer fewer</button><button type="button" data-drop-preset="higher">Prefer more</button><button type="button" data-drop-preset="minimum">Only minimum</button></div>
          <div class="buxa-drop-odds-list" data-drop-odds-list></div>
          <small class="buxa-drop-odds-help">Set relative chances for each quantity.</small>
        </div>
      </section>
    </div>
    <footer><button type="button" class="buxa-drop-remove" data-remove>Remove from Drop</button><button type="submit" class="buxa-drop-save">Save rules</button></footer>
  </form>`;
  document.body.append(shade);
  const form = shade.querySelector('form');
  const oddsList = form.querySelector('[data-drop-odds-list]');
  const odds = quantityOddsDraft(entry);
  const weightsToggle = form.querySelector('[data-drop-weights-enabled]');
  const weightsContent = form.querySelector('[data-drop-weights-content]');
  let busy = false;
  let closed = false;

  const fields = name => ({range: form.querySelector(`[data-drop-range="${name}"]`), number: form.querySelector(`[data-drop-number="${name}"]`)});
  const readNumber = (name, fallback, min, max) => {
    const raw = fields(name).number.value;
    if (raw.trim() === '') return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
  };
  const setNumber = (name, value) => {
    const {range, number} = fields(name);
    number.value = String(value);
    range.value = String(value);
  };
  const currentLimits = () => ({min: readNumber('min', entry.min, 1, 100), max: readNumber('max', entry.max, 1, 100)});
  const repaintPercentages = () => {
    const {min, max} = currentLimits();
    const rows = quantityOddsRows(odds, min, max);
    for (const row of rows) {
      const label = oddsList.querySelector(`[data-drop-odds-percent="${row.quantity}"]`);
      if (label) label.textContent = `${row.percent}%`;
    }
    oddsList.classList.toggle('has-zero-odds', rows.every(row => row.weight <= 0));
  };
  const renderOdds = () => {
    const {min, max} = currentLimits();
    if (min > max) return;
    oddsList.innerHTML = quantityOddsRows(odds, min, max).map(row => `<label class="buxa-drop-odds-row"><span class="buxa-drop-odds-quantity">×${row.quantity}</span><input type="range" min="0" max="100" step="1" value="${row.weight}" data-drop-odds-range="${row.quantity}" aria-label="Relative chance for ${row.quantity} items"><input type="number" min="0" max="100" step="1" value="${row.weight}" data-drop-odds-number="${row.quantity}" aria-label="Relative chance for ${row.quantity} items, exact value"><span class="buxa-drop-odds-percent" data-drop-odds-percent="${row.quantity}">${row.percent}%</span></label>`).join('');
    repaintPercentages();
  };
  for (const name of ['chance', 'min', 'max']) {
    const {range, number} = fields(name);
    range.addEventListener('input', () => {
      number.value = range.value;
      if (name !== 'chance') {
        const {min, max} = currentLimits();
        if (min > max) setNumber(name === 'min' ? 'max' : 'min', name === 'min' ? min : max);
        if (weightsToggle.checked) renderOdds();
      }
    });
    number.addEventListener('input', () => {
      if (number.value.trim() === '' || !number.validity.valid) return;
      range.value = number.value;
      if (name !== 'chance' && weightsToggle.checked) renderOdds();
    });
    number.addEventListener('change', () => {
      const value = readNumber(name, Number(range.value), name === 'chance' ? 0 : 1, 100);
      setNumber(name, value);
      if (name !== 'chance') {
        const {min, max} = currentLimits();
        if (min > max) setNumber(name === 'min' ? 'max' : 'min', value);
        if (weightsToggle.checked) renderOdds();
      }
    });
  }
  form.querySelectorAll('[data-drop-preset]').forEach(button => button.addEventListener('click', () => {
    const {min, max} = currentLimits();
    setQuantityOddsPreset(odds, min, max, button.dataset.dropPreset);
    renderOdds();
  }));
  oddsList.addEventListener('input', event => {
    const target = event.target;
    const quantity = Number(target.dataset.dropOddsRange ?? target.dataset.dropOddsNumber);
    if (!Number.isSafeInteger(quantity)) return;
    const isRange = target.hasAttribute('data-drop-odds-range');
    const value = target.value.trim();
    if (!isRange && (value === '' || !target.validity.valid)) return;
    const safe = Math.max(0, Math.min(100, Math.round(Number(value))));
    odds.set(quantity, safe);
    const peer = oddsList.querySelector(`[data-drop-odds-${isRange ? 'number' : 'range'}="${quantity}"]`);
    if (peer) peer.value = String(safe);
    repaintPercentages();
  });
  oddsList.addEventListener('change', event => {
    const target = event.target;
    if (!target.hasAttribute('data-drop-odds-number')) return;
    const quantity = Number(target.dataset.dropOddsNumber);
    if (!Number.isSafeInteger(quantity)) return;
    const value = Number.isFinite(Number(target.value)) && target.value.trim() !== '' ? Number(target.value) : (odds.get(quantity) ?? 50);
    const safe = Math.max(0, Math.min(100, Math.round(value)));
    odds.set(quantity, safe);
    target.value = String(safe);
    const range = oddsList.querySelector(`[data-drop-odds-range="${quantity}"]`);
    if (range) range.value = String(safe);
    repaintPercentages();
  });
  // The editor uses a fixed-size viewport. Turning weights on never resizes
  // the dialog; the body and long odds list scroll independently.
  const syncWeights = () => {
    const enabled = weightsToggle.checked;
    weightsContent.hidden = !enabled;
    weightsToggle.setAttribute('aria-expanded', String(enabled));
    if (enabled) {
      renderOdds();
      const body = form.querySelector('.buxa-drop-dialog-body');
      if (body) body.scrollTop = body.scrollHeight;
    }
  };
  weightsToggle.addEventListener('change', syncWeights);
  // Only build the potentially 100-row editor when it is actually opened.
  if (weightsToggle.checked) renderOdds();

  const escape = event => { if (event.key === 'Escape') { event.preventDefault(); close(); } };
  const close = () => {
    if (busy) return false;
    if (closed) return true;
    closed = true;
    shade.remove();
    document.removeEventListener('keydown', escape, true);
    if (activeDialogClose === close) activeDialogClose = null;
    return true;
  };
  activeDialogClose = close;
  shade.addEventListener('pointerdown', event => { if (event.target === shade) close(); });
  document.addEventListener('keydown', escape, true);
  const save = async next => {
    if (busy || !canEdit(actor)) return;
    busy = true;
    form.querySelectorAll('button').forEach(button => { button.disabled = true; });
    try {
      // Serialise against concurrent NPC inventory drag/drop writes.
      await queueNpcDropUpdate(actor, async () => {
        const table = npcDropTable(actor);
        const index = table.findIndex(value => value.id === entry.id);
        if (index < 0) return;
        if (next) table.splice(index, 1, next);
        else table.splice(index, 1);
        await actor.update({[`flags.${MODULE_ID}.npc.dropTable`]: table});
      });
      busy = false;
      close();
      void actor.sheet?.render?.({force: true});
    } catch (error) {
      console.error(error);
      notifyError('Could not save the NPC drop rules.');
      busy = false;
      form.querySelectorAll('button').forEach(button => { button.disabled = false; });
    }
  };
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (busy || !canEdit(actor)) return;
    const chance = readNumber('chance', entry.chance, 0, 100);
    const {min, max} = currentLimits();
    const weightsEnabled = weightsToggle.checked;
    // Keep an NPC's custom odds when they temporarily disable the feature;
    // runtime rolls must ignore them until explicitly enabled again.
    const weights = weightsEnabled ? serializeQuantityOdds(odds, min, max) : entry.weights;
    if (min > max || (weightsEnabled && weights === null)) { notifyError('Choose at least one possible drop quantity.'); return; }
    const raw = {...entry, chance, min, max, weights, weightsEnabled, destination: form.elements.namedItem('destination')?.value};
    const parsed = normalizeNpcDropEntry(raw);
    if (!parsed) { notifyError('Check your NPC drop settings.'); return; }
    void save(parsed);
  });
  form.querySelector('[data-remove]')?.addEventListener('click', () => { void save(null); });
  form.querySelector('[data-close]')?.addEventListener('click', close);
}
/** Determine which Simple Drop slot the pointer actually reached. Unlike
 * browser drag/drop, Buxa inventory uses pointer capture and floating ghosts.
 * null means outside the visible NPC Drop grid; 0 is a valid target. */
export function npcDropTargetAt(root,clientX,clientY) {
  const zone=root?.querySelector?.('[data-npc-drop-zone]');
  if(!zone || zone.closest?.('[hidden]') || !Number.isFinite(clientX) || !Number.isFinite(clientY))return null;
  const rect=zone.getBoundingClientRect?.();
  if(!rect || rect.width<=0 || rect.height<=0 || clientX<rect.left || clientX>=rect.right || clientY<rect.top || clientY>=rect.bottom)return null;
  const hit=zone.ownerDocument?.elementFromPoint?.(clientX,clientY);
  if(hit && !zone.contains(hit))return null; // Occluded by another window or overlay.
  const cell=hit?.closest?.('[data-npc-drop-cell]');
  if(cell && zone.contains(cell)){
    const index=Number(cell.dataset.npcDropCell);
    if(Number.isSafeInteger(index) && index>=0)return index;
  }
  // The pointer may land in the spacing between the cells: append instead of
  // doing an ordinary inventory drop or swallowing the gesture.
  return zone.querySelectorAll?.('[data-npc-drop-cell]')?.length ?? 0;
}

/** Intercept Buxa's custom pointer gesture before its ordinary drop router.
 * Unlike a native dragover/drop listener, this works for equipment, Simple
 * inventory, Complex inventory and external-storage sources. */
export function handleNpcPointerDrop(sheet,root,itemId,clientX,clientY,queueMutation) {
  const actor=sheet?.actor;
  if(!canEdit(actor))return false;
  const index=npcDropTargetAt(root,clientX,clientY);
  if(index===null)return false;
  const source=actor?.items?.get?.(itemId);
  if(!source)return false;
  void queueMutation(()=>addNpcDropItem(actor,source,{index,sheet}));
  return true;
}

/** Add a snapshot of any Foundry Item without removing it from its original
 * inventory. Serialize concurrent native drops to avoid last-write-wins loss. */
export async function addNpcDropItem(actor,item,{index=null,sheet=null}={}) {
  if(!canEdit(actor) || !item || item.documentName!=='Item' && typeof item.toObject!=='function')return false;
  return queueNpcDropUpdate(actor, async()=>{
    if(!canEdit(actor))return false;
    const current=npcDropTable(actor);
    if(current.length>=npcDropCapacity(actor,getSheetConfig())){
      notifyError('NPC Drop inventory is full. Increase slots in NPC Settings.');
      return false;
    }
    const data=item.toObject?.();
    if(!data || !String(data.name||'').trim())return false;
    const taken=new Set(current.map(e=>e.id));
    let id;
    for(let attempts=0;attempts<16;attempts++) {
      id=globalThis.foundry?.utils?.randomID?.(16) || `loot${Math.random().toString(36).slice(2,14)}`;
      if(!taken.has(id))break;
    }
    if(taken.has(id)) {
      // Avoid an infinite loop when a third-party randomID implementation
      // returns collisions repeatedly.
      id=`loot${Date.now().toString(36)}${Math.random().toString(36).slice(2,12)}`.slice(0,64);
      if(taken.has(id))return false;
    }
    const entry=normalizeNpcDropEntry({id,data,chance:100,min:1,max:1,destination:'inventory'});
    if(!entry)return false;
    const position=Number.isSafeInteger(index) && index>=0 ? Math.min(index,current.length) : current.length;
    current.splice(position,0,entry);
    await actor.update({[`flags.${MODULE_ID}.npc.dropTable`]:current});
    notifySuccess(`${data.name} added to NPC Drop.`);
    // Actor update normally rerenders its open sheets; avoid a second forced
    // render in the middle of another pointer drag.
    return true;
  });
}

/** Accept Foundry native Item drag JSON as well as the inventory's legacy
 * Buxa MIME ID; resolve UUIDs so embedded Actor and Compendium Items work. */
export async function sourceNpcDropItem(transfer,actor) {
  if(!transfer?.getData)return null;
  let raw=null;
  for(const mime of ['application/json','text/plain']) {
    try {
      const text=transfer.getData(mime);
      if(!text)continue;
      const value=JSON.parse(text);
      if(value && typeof value==='object' && value.type==='Item') {raw=value;break;}
    } catch { /* Another format; try the next MIME source. */ }
  }
  if(raw?.uuid && typeof globalThis.fromUuid==='function') {
    try {const item=await globalThis.fromUuid(raw.uuid);
      if(item?.documentName==='Item')return item;} catch { /* Local lookup below. */ }
  }
  if(raw?.id) {
    const item=actor?.items?.get?.(raw.id) || globalThis.game?.items?.get?.(raw.id);
    if(item?.documentName==='Item')return item;
  }
  try {
    const localId=transfer.getData('application/x-buxa-item');
    const item=actor?.items?.get?.(localId);
    if(item?.documentName==='Item')return item;
  } catch { /* No Buxa MIME item. */ }
  return null;
}

export function bindNpcDropEditor(sheet) {
  const actor=sheet.actor,root=sheet.element,zone=root?.querySelector('[data-npc-drop-zone]');
  if(!zone||!canEdit(actor))return;
  zone.querySelectorAll('[data-npc-drop-entry]').forEach(button=>{
    button.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();
      const entry=npcDropTable(actor).find(item=>item.id===button.dataset.npcDropEntry);
      if(entry)dialog(actor,entry);
    });
    button.addEventListener('click',()=>{
      const entry=npcDropTable(actor).find(item=>item.id===button.dataset.npcDropEntry);
      if(entry)dialog(actor,entry);
    });
  });
  const clearHover=()=>zone.classList.remove('is-npc-drag-over');
  zone.addEventListener('dragover',e=>{
    if(!canEdit(actor))return;
    e.preventDefault();e.stopPropagation();
    if(e.dataTransfer)e.dataTransfer.dropEffect='copy';
    zone.classList.add('is-npc-drag-over');
  },true);
  zone.addEventListener('dragleave',e=>{
    if(!e.relatedTarget || !zone.contains(e.relatedTarget))clearHover();
  });
  zone.addEventListener('drop',async e=>{
    e.preventDefault();e.stopImmediatePropagation();clearHover();
    if(!canEdit(actor))return;
    try {
      const item=await sourceNpcDropItem(e.dataTransfer,actor);
      if(!item){notifyError('Drop a Foundry Item from the Items directory or an Actor inventory.');return;}
      const cellId=e.target?.closest?.('[data-npc-drop-cell]')?.dataset?.npcDropCell;
      const index=cellId===undefined?null:Number(cellId);
      await addNpcDropItem(actor,item,{index:Number.isSafeInteger(index)&&index>=0?index:null,sheet});
    } catch(error) {console.error(`${MODULE_ID} | NPC Drop failed`,error);notifyError('Could not add the NPC drop item.');}
  },true);
}
