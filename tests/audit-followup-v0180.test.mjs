import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeEncounterRoster,normalizeEncounterDead,addEncounterActor} from '../scripts/core/combat-encounter-model.js';
import {collectGalleryTree} from '../scripts/core/asset-browser-scan.js';
import {visibleAssetFolders} from '../scripts/core/asset-browser-model.js';
import {fakeSceneFxCanvas,fakeSceneFxDocument} from './helpers/scene-fx-dom.mjs';
import {playSceneSvgProgression,removeSceneProgressionEffects} from '../scripts/apps/scene-progression-svg.js';
const src=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('combat roster >400 keeps every distinct NPC entry and never discards the late ones',()=>{
  const roster=Array.from({length:575},(_,i)=>({id:`copy-${i}`,actorId:'goblin',npc:true}));
  assert.equal(normalizeEncounterRoster(roster).length,575);
  const plus=addEncounterActor(roster,{id:'goblin',type:'npc'},'copy-575');
  assert.equal(plus.length,576);
  assert.equal(plus.at(-1).id,'copy-575');
});

test('dead archive never silently evicts old archived NPCs at entry 401+',()=>{
  const dead=Array.from({length:525},(_,i)=>({id:`dead-${i}`,actorId:'goblin',name:`Goblin ${i}`}));
  assert.equal(normalizeEncounterDead(dead).length,525);
  assert.equal(normalizeEncounterDead(dead)[0].id,'dead-0');
});

test('combat reorder requires a real local drag and live Combatant IDs',()=>{
  const code=src('scripts/apps/combat-encounters.js');
  assert.match(code,/this\.reorderDrag\s*=\s*\{\s*id,\s*combatId:\s*combat\.id\s*\}/);
  assert.match(code,/drag\?\.id\s*!==\s*id/);
  assert.match(code,/combat\.combatants\?\.get\?\.\(target\.dataset\.encReorder\)/);
  assert.match(code,/this\.reorderDrag = null;/);
});

test('combat actor picker includes a next page instead of truncating search to 150',()=>{
  const code=src('scripts/apps/combat-encounter-picker.js');
  assert.match(code,/matches\.slice\(0, visibleLimit\)/);
  assert.match(code,/visibleLimit \+= 150/);
  assert.doesNotMatch(code,/sort\(\(a, b\) => a\.name\.localeCompare\(b\.name\)\)\s*\.slice\(0, 150\)/);
});

test('asset scan browses up to four directories concurrently but preserves BFS ordering',async()=>{
  let concurrent=0,peak=0;
  const docs=new Map([['root',['root/a','root/b','root/c','root/d','root/e']],
    ...['a','b','c','d','e'].map(name=>[`root/${name}`,[]])]);
  const result=await collectGalleryTree('root',async path=>{
    concurrent++;peak=Math.max(peak,concurrent);
    await new Promise(resolve=>setTimeout(resolve,path.endsWith('/a')?15:2));
    concurrent--;
    return {dirs:(docs.get(path)??[]).map(p=>({path:p})),files:path==='root'?[]:[{path:`${path}/pic.webp`}]};
  });
  assert.equal(result.failures,0);
  assert.equal(result.folders,6);
  assert.ok(peak>=2 && peak<=4,`Expected 2-4 concurrent FilePicker calls; got ${peak}`);
  assert.deepEqual(result.files.map(x=>x.path),['a','b','c','d','e'].map(n=>`root/${n}/pic.webp`));
});

test('asset folder navigation can browse past nine nested levels safely',()=>{
  const map=new Map();
  const expanded=new Set();
  let parent='root';
  for(let i=0;i<14;i++){
    const child=`${parent}/folder${i}`;
    map.set(parent,{dirs:[{path:child}]});
    expanded.add(parent);parent=child;
  }
  map.set(parent,{dirs:[]});
  const rows=visibleAssetFolders('root',map,expanded,parent);
  assert.equal(rows.length,15);
  assert.equal(rows.at(-1).depth,14);
});

test('progression FX does not spawn on a token removed to another scene',()=>{
  const doc=fakeSceneFxDocument();
  const token={document:{id:'moved',parent:{id:'old-scene'}},center:{x:100,y:100},w:70,h:70};
  const canvasRef=fakeSceneFxCanvas([token]);
  try{
    assert.equal(playSceneSvgProgression(token,{kind:'level',value:'2'}, {canvasRef,documentRef:doc}),false);
    assert.equal(doc.body.children.length,0);
  }finally{removeSceneProgressionEffects();}
});

test('hotbar click action has a persistent in-flight lock and does not close open attribute menus on render',()=>{
  const code=src('scripts/apps/hotbar.js');
  assert.match(code,/this\.activatingItems = new Set\(\)/);
  assert.match(code,/this\.activatingItems\.has\(activationKey\)/);
  assert.match(code,/this\.activatingItems\.delete\(activationKey\)/);
  assert.doesNotMatch(code,/const actor = resolveHotbarActor\(state\);\s*closeHotbarAttributeMenu\(\);/);
});

test('drag sessions and delayed picker selections have abandonment cleanup',()=>{
  const handoff=src('scripts/integrations/physical-item-handoff.js');
  assert.match(handoff,/addEventListener\('blur',endDragSession\)/);
  assert.match(handoff,/visibilityState==='hidden'/);
  const tooltip=src('scripts/apps/item-config.js');
  assert.match(tooltip,/if \(!path \|\| !row\?\.isConnected\) return;/);
  const item=src('scripts/apps/item-config-image-picker.js');
  assert.match(item,/if \(!current\?\.isConnected\) return;/);
});

test('stack inputs reject malformed raw quantities instead of manufacturing a default unit', async()=>{
  const {validStackQuantity}=await import('../scripts/core/stack-quantity.js');
  for(const invalid of [undefined,null,'', ' ', 'oops', NaN, Infinity, -1, 1.5, true, false, {}, '1.25'])
    assert.equal(validStackQuantity({system:{quantity:invalid}}),false,`invalid ${String(invalid)}`);
  for(const valid of [0,1,23,'0','42'])
    assert.equal(validStackQuantity({system:{quantity:valid}}),true,`valid ${String(valid)}`);
});

test('corpse loot refreshes from Token flags and prevents duplicate requests while pending',()=>{
  const code=src('scripts/integrations/npc-death.js');
  assert.match(code,/Hooks\.on\('updateToken',doc=>/);
  assert.match(code,/Hooks\.off\('updateToken',lootHook\)/);
  assert.match(code,/pendingLoot\.has\(item\.id\)/);
});

test('stack compositor keeps number/slider input attached instead of redrawing on every input',()=>{
  const code=src('scripts/apps/item-stack-editor.js');
  const handler=code.split("overlay.addEventListener('input',e=>{")[1]?.split("const move=e=>{")[0];
  assert.ok(handler);
  assert.doesNotMatch(handler,/\bredraw\(\)/);
  assert.match(handler,/active\.style\.width/);
});

test('large directory search is debounced and abandoned across remount',()=>{
  const code=src('scripts/apps/world-directory-generic.js');
  assert.match(code,/this\.searchTimer = setTimeout/);
  assert.match(code,/this\.shell !== shell \|\| !shell\.isConnected/);
  assert.match(code,/if\(this\.searchTimer!==null\)clearTimeout\(this\.searchTimer\)/);
});
