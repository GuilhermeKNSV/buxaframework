import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeItemSystemConfig,createItemRarity} from '../scripts/core/item-config.js';
import { requestPhysicalAction } from '../scripts/integrations/physical-item-transfers.js';
import { PHYSICAL_SCENE_STORE, scenePhysicalItems } from '../scripts/core/physical-items.js';
import {trashcanState,setTrashcanSelecting,trashcanSelectSceneItem,trashcanItemSelected,trashcanDragTarget} from '../scripts/apps/gm-trashcan.js';

const oldGlobals = () => Object.fromEntries(['game','canvas','foundry','Hooks'].map(k=>[k,globalThis[k]]));
const restoreGlobals = old => {for(const [k,v] of Object.entries(old))v===undefined?delete globalThis[k]:globalThis[k]=v;};

test('every default and custom rarity has a persistent, clamped beam opacity',()=>{
  const defaults=normalizeItemSystemConfig().rarities;
  assert.equal(defaults.length,12);
  assert.ok(defaults.every(r=>r.beamOpacity===100));
  assert.equal(createItemRarity([]).beamOpacity,100);
  const altered=normalizeItemSystemConfig({rarities:[
    {...defaults[0],beamOpacity:0}, {...defaults[1],beamOpacity:36},
    {...defaults[2],beamOpacity:1000}, {...defaults[3],beamOpacity:-3},
    {...defaults[4],beamOpacity:'invalid'}]});
  assert.deepEqual(altered.rarities.map(r=>r.beamOpacity),[0,36,100,0,100]);
  assert.deepEqual(normalizeItemSystemConfig(altered).rarities.map(r=>r.beamOpacity),altered.rarities.map(r=>r.beamOpacity));
});

test('rarity panel persists opacity and renders both editable number and slider',async()=>{
  const fs=await import('node:fs');
  const template=fs.readFileSync(new URL('../templates/layout-config.hbs',import.meta.url),'utf8');
  const editor=fs.readFileSync(new URL('../scripts/apps/rarity-config.js',import.meta.url),'utf8');
  assert.match(template,/data-rarity-beam-opacity-slider/);
  assert.match(template,/data-rarity-beam-opacity-number/);
  assert.match(editor,/beamOpacity: Number\(row\.querySelector/);
  assert.match(editor,/data-rarity-beam-opacity-number/);
});

test('scene trash selection is restricted to GM and current scene, and can be canceled',()=>{
 const old=oldGlobals();
 try {
  globalThis.game={user:{id:'gm',isGM:true}};
  globalThis.canvas={scene:{id:'first'}};
  assert.equal(setTrashcanSelecting(true),true);
  assert.equal(trashcanSelectSceneItem('a'),true);
  assert.equal(trashcanItemSelected('a'),true);
  assert.equal(trashcanSelectSceneItem('a'),true);
  assert.equal(trashcanState().count,0);
  trashcanSelectSceneItem('b');
  globalThis.canvas={scene:{id:'next'}};
  assert.equal(trashcanState().count,0);
  assert.equal(trashcanState().selecting,false);
  assert.equal(trashcanDragTarget(5,8,{elementFromPoint:()=>({closest:()=>true})}),true);
  game.user.isGM=false;
  assert.equal(setTrashcanSelecting(true),false);
  assert.equal(trashcanSelectSceneItem('n'),false);
  assert.equal(trashcanDragTarget(5,8,{elementFromPoint:()=>({closest:()=>true})}),false);
 } finally { restoreGlobals(old); }
});

test('GM trash deletes only selected Buxa scene records and rejects invalid or non-GM requests',async()=>{
  const old=oldGlobals();
  const gm={id:'gm',isGM:true,active:true};
  const nonGm={id:'other',isGM:false,active:true};
  const users=[gm,nonGm];users.get=id=>users.find(u=>u.id===id);users.activeGM=gm;
  let store={scene:[{id:'a',x:12,y:13,data:{name:'A'}},{id:'b',x:40,y:60,data:{name:'B'}}]};
  const scene={id:'scene',getFlag:()=>null};
  try {
    globalThis.foundry={utils:{randomID:()=>`req-${Math.random()}`,deepClone:structuredClone}};
    globalThis.Hooks={callAll(){}};
    globalThis.game={user:gm,users,scenes:{get:id=>id==='scene'?scene:null},settings:{get(ns,key){if(key===PHYSICAL_SCENE_STORE)return store;return {};},async set(ns,key,value){if(key!==PHYSICAL_SCENE_STORE)throw Error('unexpected');store=structuredClone(value);return value;}}};
    await assert.rejects(requestPhysicalAction({action:'trash',sceneId:'scene',itemIds:['missing']}),/Selection changed/);
    assert.equal(scenePhysicalItems(scene).length,2);
    const result=await requestPhysicalAction({action:'trash',sceneId:'scene',itemIds:['a']});
    assert.deepEqual(result,{deleted:1});
    assert.deepEqual(scenePhysicalItems(scene).map(i=>i.id),['b']);
    await assert.rejects(requestPhysicalAction({action:'trash',sceneId:'scene',itemIds:['b','b']}),/Invalid selection/);
    game.user=nonGm;
    await assert.rejects(requestPhysicalAction({action:'trash',sceneId:'scene',itemIds:['b']}),/Foundry socket unavailable/);
    assert.deepEqual(scenePhysicalItems(scene).map(i=>i.id),['b']);
  } finally {restoreGlobals(old);}
});
