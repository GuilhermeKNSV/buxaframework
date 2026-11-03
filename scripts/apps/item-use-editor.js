/** Standalone Resource / Limits configuration UI. No legacy Item tabs are altered. */
import { buildDiceModifierOptions } from '../core/item-dice-config.js';
import { normalizeItemResourceEffects, normalizeItemLimits } from '../core/item-use-config.js';
import { createRechargeTemplatePicker } from './item-recharge-template-picker.js';

function field(doc, label, element) {
  const wrap = doc.createElement('label'); wrap.className = 'buxa-rule-field';
  const caption = doc.createElement('span'); caption.textContent = label;
  wrap.append(caption, element); return wrap;
}
function input(doc, type, value, key, attrs = {}) {
  const el = doc.createElement('input'); el.type = type; el.dataset.useField = key;
  if (type === 'checkbox') el.checked = Boolean(value);
  else el.value = String(value ?? '');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}
function select(doc, value, key, options) {
  const el = doc.createElement('select'); el.dataset.useField = key;
  for (const [id, label] of options) { const option = doc.createElement('option'); option.value = id; option.textContent = label; el.append(option); }
  el.value = value ?? ''; return el;
}
function section(doc, name, icon, intro) {
  const body = doc.createElement('div'); body.className = 'buxa-item-config-stack buxa-item-use-panel';
  body.dataset.itemConfigPanel = name; body.hidden = true;
  body.innerHTML = `<section class="buxa-item-config-section"><header><div><i class="fa-solid ${icon}"></i><span><strong>${name.toUpperCase()}</strong><small>${intro}</small></span></div></header><div class="buxa-item-use-content"></div></section>`;
  return {body, content: body.querySelector('.buxa-item-use-content')};
}
function rowFor(doc, entry, config) {
  const row = doc.createElement('article'); row.className = 'buxa-item-use-row'; row.dataset.itemResourceRow = entry.id;
  const header = doc.createElement('div'); header.className = 'buxa-item-use-row-head';
  const title = doc.createElement('strong'); title.textContent = 'RESOURCE EFFECT';
  const remove = doc.createElement('button'); remove.type = 'button'; remove.dataset.removeResource = ''; remove.innerHTML = '<i class="fa-solid fa-trash-can"></i> Remove';
  remove.addEventListener('click', () => row.remove()); header.append(title, remove);
  const grid = doc.createElement('div'); grid.className = 'buxa-item-use-grid';
  const entries = [
    ['ACTION', select(doc,entry.action,'action',[['drain','Drain'],['fill','Fill / restore']])],
    ['RESOURCE', select(doc,entry.resourceId,'resourceId',(config.resources || []).map(r=>[r.id,r.label]))],
    ['WHEN', select(doc,entry.timing,'timing',[['before','Before roll'],['after','After roll']])],
    ['AMOUNT TYPE', select(doc,entry.amountType,'amountType',[['flat','Flat amount'],['percent','% of maximum'],['dice','Roll dice']])],
    ['FLAT / PERCENT', input(doc,'number',entry.amount,'amount',{min:'0',step:'0.01'})],
    ['DICE COUNT', input(doc,'number',entry.count,'count',{min:'0',max:'100'})],
    ['DICE SIDES', input(doc,'number',entry.faces,'faces',{min:'2',max:'1000'})],
    ['ATTRIBUTE DICE', input(doc,'checkbox',entry.attributeDice.enabled,'attributeEnabled')],
    ['ATTRIBUTE', select(doc,entry.attributeDice.attributeId,'attributeId',(config.attributes?.entries||[]).map(a=>[a.id,a.label]))],
    ['ATTRIBUTE DIE SIDES',input(doc,'number',entry.attributeDice.faces,'attributeFaces',{min:'2'})],
    ['FLAT BONUS TO ROLL',input(doc,'number',entry.flat,'flat',{step:'0.01'})],
    ['MODIFIER',select(doc,`${entry.modifier.source}:${entry.modifier.id}`,'modifier',buildDiceModifierOptions(config).map(v=>[v.value,v.label]))],
    ['ROLL MODE',select(doc,entry.rollMode,'rollMode',[['normal','Normal'],['advantage','Advantage'],['disadvantage','Disadvantage']])]
  ];
  entries.forEach(([label,control])=>grid.append(field(doc,label,control)));
  row.append(header,grid);
  const sync = () => {
    const kind = row.querySelector('[data-use-field="amountType"]').value;
    for (const key of ['amount','count','faces','attributeEnabled','attributeId','attributeFaces','flat','modifier','rollMode']) {
      const control = row.querySelector(`[data-use-field="${key}"]`);
      const shown = kind === 'dice' ? key !== 'amount' : key === 'amount';
      control.closest('label').hidden = !shown;
    }
    const attr = row.querySelector('[data-use-field="attributeEnabled"]').checked;
    for (const key of ['attributeId','attributeFaces']) row.querySelector(`[data-use-field="${key}"]`).closest('label').hidden = kind !== 'dice' || !attr;
    for (const key of ['count','faces']) row.querySelector(`[data-use-field="${key}"]`).closest('label').hidden = kind !== 'dice' || attr;
  };
  row.addEventListener('change',sync); sync(); return row;
}
export function mountItemUseEditor(root, rules, config, item = null) {
  const doc = root.ownerDocument; const tabs = root.querySelector('.buxa-item-config-tabs');
  if (!tabs) return;
  const addTab = (name, icon) => {
    const button = doc.createElement('button'); button.type = 'button'; button.dataset.itemConfigTab = name;
    button.innerHTML = `<i class="fa-solid ${icon}"></i><span>${name.toUpperCase()}</span>`;
    tabs.insertBefore(button, tabs.querySelector('[data-item-config-tab="image"]'));
  };
  addTab('resource','fa-heart-pulse'); addTab('limits','fa-hourglass-half');
  const resource = section(doc,'resource','fa-heart-pulse','Spend HP/MP or restore resources before or after using item dice.');
  const list = doc.createElement('div'); list.className = 'buxa-item-use-list'; list.dataset.itemResourceList = '';
  const add = doc.createElement('button'); add.type = 'button'; add.className = 'buxa-item-use-add'; add.innerHTML = '<i class="fa-solid fa-plus"></i> Add resource effect';
  add.addEventListener('click',()=>list.append(rowFor(doc, normalizeItemResourceEffects([{ resourceId: config.resources?.[0]?.id, action: 'drain' }])[0],config)));
  (rules.resourceEffects || []).forEach(entry=>list.append(rowFor(doc,entry,config)));
  resource.content.append(add,list);
  const limits = section(doc,'limits','fa-hourglass-half','Restrict uses per Item instance and choose what happens when exhausted.');
  const limit = normalizeItemLimits(rules.limits);
  const grid = doc.createElement('div'); grid.className = 'buxa-item-use-grid';
  const worldItems = game.items?.contents ?? Array.from(game.items ?? []);
  const transforms = [['','Choose an Item template'], ...worldItems.map(item=>[item.id,`${item.name} (${item.type})`])];
  const fields = [
    ['ENABLE LIMITED USES',input(doc,'checkbox',limit.enabled,'limitEnabled')],
    ['MAXIMUM USES',input(doc,'number',limit.maxUses,'maxUses',{min:'1',max:'999999'})],
    ['AFTER LAST USE',select(doc,limit.onExhaust,'onExhaust',[['disable','Disable item (lock)'],['destroy','Destroy item'],['transform','Transform into another Item']])],
    ['TRANSFORM INTO',select(doc,limit.transformItemId,'transformItemId',transforms)]
  ];
  fields.forEach(([name,control])=>grid.append(field(doc,name,control)));
  if (item?.parent?.documentName === 'Actor') {
    const used = Math.max(0,Number(item.getFlag?.('buxaframework','itemUsage')?.used)||0);
    const spent = input(doc,'number',used,'usesSpent',{min:'0',max:'999999'});
    spent.addEventListener('input',()=>{spent.dataset.dirty='1';});
    grid.append(field(doc,'USES ALREADY SPENT (GM)',spent));
    const reset = doc.createElement('button');reset.type='button';reset.className='buxa-item-use-add';
    reset.textContent='Reset uses to 0';reset.addEventListener('click',()=>{spent.value='0';spent.dataset.dirty='1';});
    grid.append(reset);
  }
  const recharge = limit.recharge;
  const rechargeHeading = doc.createElement('div');
  rechargeHeading.className = 'buxa-item-use-recharge-heading';
  rechargeHeading.innerHTML = '<strong><i class="fa-solid fa-arrows-rotate"></i> RECHARGE</strong><small>Choose one or more ways to restore spent uses.</small>';

  const rechargeCards = doc.createElement('div'); rechargeCards.className = 'buxa-item-recharge-cards';
  const optionsForResources = [['','No resource cost'],...(config.resources || []).map(r=>[r.id,r.label])];
  const methods = [
    {key:'button',label:'RIGHT-CLICK RECHARGE',hint:'Adds an action to the Item right-click menu.',settings:[
      ['USES PER CLICK', input(doc,'number',recharge.button.charges,'buttonCharges',{min:'1'})],
      ['COST RESOURCE',select(doc,recharge.button.resourceId,'buttonResourceId',optionsForResources)],
      ['COST AMOUNT',input(doc,'number',recharge.button.cost,'buttonCost',{min:'0',step:'0.01'})],
      ['COST TYPE',select(doc,recharge.button.costType,'buttonCostType',[['flat','Flat'],['percent','% of resource max']])]
    ]},
    {key:'item',label:'RECHARGE ITEM',hint:'Drop an owned copy of this Item onto the target; consumes one unit.',settings:[
      ['WORLD ITEM TO CONSUME',createRechargeTemplatePicker(doc,recharge.item.templateId,game.items)],
      ['USES RESTORED',input(doc,'number',recharge.item.charges,'itemCharges',{min:'1'})]
    ]},
    {key:'combat',label:'COMBAT TURNS',hint:'Restore charges every N turns advanced in Foundry Combat.',settings:[
      ['EVERY X COMBAT TURNS',input(doc,'number',recharge.combat.everyTurns,'combatEveryTurns',{min:'1'})],
      ['USES RESTORED',input(doc,'number',recharge.combat.charges,'combatCharges',{min:'1'})]
    ]}
  ];
  for(const method of methods) {
    const card=doc.createElement('section');card.className='buxa-item-recharge-card';
    const toggle=input(doc,'checkbox',recharge[method.key].enabled,`${method.key}Enabled`);
    const title=field(doc,method.label,toggle);title.classList.add('buxa-item-recharge-toggle');
    const blurb=doc.createElement('small');blurb.textContent=method.hint;
    const controls=doc.createElement('div');controls.className='buxa-item-use-grid';
    method.settings.forEach(([label,control])=>controls.append(control.dataset?.rechargeTemplatePicker !== undefined ? control : field(doc,label,control)));
    const refresh=()=>{controls.hidden=!toggle.checked;};
    toggle.addEventListener('change',refresh);card.append(title,blurb,controls);refresh();rechargeCards.append(card);
  }

  const hint = doc.createElement('p'); hint.className='buxa-item-use-hint'; hint.textContent = 'Uses are saved on each owned Item. Recharge works while the original Item still exists: choose Disable on exhaustion if you want to refill an empty Item; Destroy and Transform remove or replace it. Combat recharge counts turns advanced globally in the encounter. Resource rules activate when an Item roll or USE action runs.';
  const sync = () => { const enabled = grid.querySelector('[data-use-field="limitEnabled"]').checked; grid.querySelector('[data-use-field="transformItemId"]').closest('label').hidden = !enabled || grid.querySelector('[data-use-field="onExhaust"]').value !== 'transform'; };
  grid.addEventListener('change',sync); sync(); limits.content.append(grid,rechargeHeading,rechargeCards,hint);
  const host = root.querySelector('[data-item-config-panel="image"]');
  host.before(resource.body,limits.body);
}
const v = (row,key) => row.querySelector(`[data-use-field="${key}"]`);
export function readItemUseEditor(root) {
  const effects = Array.from(root.querySelectorAll('[data-item-resource-row]')).map(row=>{
    const [source,id] = String(v(row,'modifier')?.value||'none:').split(':');
    return {
      id: row.dataset.itemResourceRow, action:v(row,'action').value, resourceId:v(row,'resourceId').value,
      timing:v(row,'timing').value, amountType:v(row,'amountType').value, amount:Number(v(row,'amount').value),
      count:Number(v(row,'count').value),faces:Number(v(row,'faces').value),
      attributeDice:{ enabled:v(row,'attributeEnabled').checked,attributeId:v(row,'attributeId').value,faces:Number(v(row,'attributeFaces').value) },
      modifier:{source,id},flat:Number(v(row,'flat').value),rollMode:v(row,'rollMode').value
    };
  });
  const lf = key => root.querySelector(`[data-item-config-panel="limits"] [data-use-field="${key}"]`);
  return { resourceEffects:normalizeItemResourceEffects(effects),
    limits: normalizeItemLimits({enabled:lf('limitEnabled')?.checked,maxUses:lf('maxUses')?.value,onExhaust:lf('onExhaust')?.value,transformItemId:lf('transformItemId')?.value,
      recharge:{
        button:{enabled:lf('buttonEnabled')?.checked,charges:lf('buttonCharges')?.value,resourceId:lf('buttonResourceId')?.value,cost:lf('buttonCost')?.value,costType:lf('buttonCostType')?.value},
        item:{enabled:lf('itemEnabled')?.checked,charges:lf('itemCharges')?.value,templateId:lf('itemTemplateId')?.value},
        combat:{enabled:lf('combatEnabled')?.checked,charges:lf('combatCharges')?.value,everyTurns:lf('combatEveryTurns')?.value}
      }}),
    ...(lf('usesSpent')?.dataset.dirty==='1' ? {usageUsed:Math.max(0,Math.min(999999,Math.round(Number(lf('usesSpent').value)||0)))} : {})
  };
}
