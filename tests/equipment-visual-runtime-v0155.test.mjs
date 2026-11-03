import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { INVENTORY_SIZE_PATTERNS } from '../scripts/core/inventory-config.js';
import { normalizeSheetConfig } from '../scripts/core/config.js';
import { prepareInventoryContext } from '../scripts/apps/inventory-context.js';
const getProperty=(object,path)=>String(path).split('.').reduce((value,key)=>value?.[key],object);
globalThis.foundry={utils:{getProperty,hasProperty:(o,p)=>getProperty(o,p)!==undefined,deepClone:structuredClone}};
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('five equipment slot sizes use five individually saved image transforms at runtime',()=>{
  const sizes=INVENTORY_SIZE_PATTERNS;
  const items=sizes.map(({id},index)=>{
    const rules={equip:{enabled:true,any:true},equipArtwork:{[id]:{x:10+index*13,y:-8-index*9,rotation:index*23,zoom:1.2+index*.25}}};
    return {id:`equip-${id}`,name:id,img:'icons/svg/sword.svg',type:'weapon',system:{quantity:1},
      getFlag:(_module,key)=>key==='item'?rules:undefined};
  });
  items.get=id=>items.find(item=>item.id===id);
  const placements=Object.fromEntries(sizes.map(({id})=>[`equip-${id}`,{area:'equipment',slotId:`slot-${id}`,position:0}]));
  const actor={id:'actor1',items,isOwner:true,getFlag:(_m,key)=>key==='inventory'?{tracked:items.map(i=>i.id),placements,equipmentActive:{}}:undefined};
  const config=normalizeSheetConfig({inventory:{mode:'simple',slots:5,equipmentLayout:{
    tabs:[{id:'main',label:'Main',columns:12,rows:8}],
    slots:sizes.map(({id},index)=>({id:`slot-${id}`,type:'weapon',label:id,size:id,tabId:'main',capacity:1,x:index*2,y:0}))
  }}});
  const result=prepareInventoryContext(actor,config,true);
  const views=new Map(result.equipmentSlots.map(s=>[s.size,s]));
  for(const [i,{id}] of sizes.entries()){
    const slot=views.get(id);
    assert.ok(slot,`missing ${id}`);
    assert.ok(slot.item,`missing equipped item in ${id}`);
    assert.ok(slot.style.includes(`translate(${10+i*13}px,${-8-i*9}px)`),`${id} x/y not applied: ${slot.style}`);
    assert.ok(slot.style.includes(`rotate(${i*23}deg)`),`${id} rotation not applied`);
    assert.ok(slot.style.includes(`scale(${Math.round((1.2+i*.25)*100)/100})`),`${id} zoom not applied`);
  }
});

test('equipment artist overrides normal inventory clipping/hover scaling only inside its own editor',()=>{
  const css=read('../styles/168-item-equip-size.css');
  assert.match(css,/\.buxa \.buxa-equip-art-slot\.has-item > \.buxa-equip-art-item\s*\{\s*overflow:visible!important/);
  assert.match(css,/\.buxa \.buxa-equip-art-slot\.has-item > \.buxa-equip-art-item:hover/);
  assert.match(css,/transform:none!important/);
  assert.match(css,/left:auto!important;top:auto!important/);
  assert.match(css,/height:calc\(var\(--equip-h\)\*58px\)!important/);
});

test('scene preview allows pointer editing only on the currently selected layer',()=>{
  const css=read('../styles/169-item-scene-preview.css');
  const js=read('../scripts/apps/item-scene-fx-preview.js');
  assert.match(css,/\.buxa-board-scene-preview\[data-active-target="beam"\]/);
  assert.match(css,/\.buxa-board-image-stage\[data-preview-open="true"\]:not\(\[data-preview-target="image"\]\)/);
  assert.match(js,/app\._boardPreviewTarget === 'beam'/);
  assert.match(js,/app\._boardPreviewTarget === 'label'/);
  assert.doesNotMatch(js,/dispatchEvent\(new CustomEvent\('buxa-board-preview-change'/);
});

test('archived tab markup survives navigation boot fallback while meeting size limit',()=>{
  const source=read('../templates/item-config.hbs');
  assert.match(source,/data-item-config-tab="control"/);
  assert.match(source,/aria-selected="\{\{activeConfigTabs\.image\}\}"/);
  assert.ok(source.split(/\r?\n/).length<500);
});
