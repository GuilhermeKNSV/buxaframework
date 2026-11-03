import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {npcScreenPoint,npcTokenScreenBounds} from '../scripts/integrations/npc-death.js';
import {withPhysicalTransaction,PHYSICAL_TRANSACTION_LEDGER,readPhysicalLedger} from '../scripts/core/physical-transaction-ledger.js';
import {MODULE_ID} from '../scripts/core/constants.js';

function createCanvas(m={a:1,b:0,c:0,d:1,tx:0,ty:0}) {
  return {app:{renderer:{canvas:{getBoundingClientRect:()=>({left:25,top:40,width:800,height:600})},
    screen:{width:800,height:600}}},stage:{worldTransform:m},scene:{grid:{size:100}}};
}
test('NPC indicator positioning avoids token getBounds; supports canvas pan and zoom',()=>{
  const canvas=createCanvas({a:2,b:0,c:0,d:2,tx:50,ty:-20});
  const token={document:{x:100,y:200,width:1,height:2},getBounds(){throw Error('unmounted Pixi child')}};
  assert.deepEqual(npcTokenScreenBounds(token,canvas),{left:275,top:420,width:200,height:400});
  const point=npcScreenPoint({clientX:375,clientY:520},canvas);
  assert.deepEqual(point,{x:150,y:250});
});
test('NPC hit testing supports skewed/non-uniform stage transforms without any Pixi bounds calls',()=>{
  const canvas=createCanvas({a:2,b:0,c:1,d:3,tx:20,ty:30});
  const world={x:200,y:140};
  const browser={clientX:25+2*world.x+world.y+20,clientY:40+3*world.y+30};
  const result=npcScreenPoint(browser,canvas);
  assert.ok(Math.abs(result.x-world.x)<1e-8);
  assert.ok(Math.abs(result.y-world.y)<1e-8);
  assert.equal(npcTokenScreenBounds({document:{x:0,y:0,width:1,height:1}},canvas).width,300);
  assert.equal(npcScreenPoint(browser,createCanvas({a:0,b:0,c:0,d:0,tx:0,ty:0})),null);
});
test('NPC corpse UI no longer creates Pixi v8-only text, uses a single close handler',()=>{
  const code=readFileSync(new URL('../scripts/integrations/npc-death.js',import.meta.url),'utf8');
  assert.doesNotMatch(code,/new PIXI\.Text/);
  assert.doesNotMatch(code,/\b(?:token|hover)\.getBounds\s*\(/);
  assert.match(code,/activeCorpseClose\?\.\(\)/);
  assert.match(code,/authenticatedSenderId===physicalActiveGM\(\)\?\.id/);
  assert.match(code,/authenticatedSenderId!==payload\.userId/);
});
test('Drop table has no NPC-only instructional clutter and corpse cards have compact artwork',()=>{
  const sheet=readFileSync(new URL('../templates/player-sheet.hbs',import.meta.url),'utf8');
  const css=readFileSync(new URL('../styles/171-npc-dropping.css',import.meta.url),'utf8');
  assert.doesNotMatch(sheet,/NPC-only · Simple slots/);
  assert.doesNotMatch(sheet,/Configure size and HP resource in NPC Settings/);
  assert.match(css,/\.buxa-npc-corpse-items button\{aspect-ratio:1/);
});
test('large legacy journal fingerprints compact without dropping unresolved review records',async t=>{
  if(!globalThis.crypto?.subtle)return t.skip('WebCrypto unavailable');
  const previous=globalThis.game;
  const originalPayload=JSON.stringify({action:'drop',data:'x'.repeat(1800)});
  const records=Object.fromEntries(Array.from({length:95},(_,i)=>[`old${i}`,{
    userId:'requester',fingerprint:originalPayload,action:'drop',sceneId:'s',
    status:'needs-review',started:100+i,finished:100+i
  }]));
  let stored={version:1,records};
  globalThis.game={settings:{settings:new Map([[`${MODULE_ID}.${PHYSICAL_TRANSACTION_LEDGER}`,true]]),
    get:()=>structuredClone(stored),async set(_module,_key,value){stored=structuredClone(value);}}};
  try {
    const result=await withPhysicalTransaction({id:'new_request',userId:'requester',payload:{action:'loot',sceneId:'s',itemId:'a'}},async()=>({ok:true}));
    assert.equal(result.ok,true);
    assert.equal(Object.keys(stored.records).length,96);
    assert.equal(stored.records.old0.status,'needs-review');
    assert.match(stored.records.old0.fingerprint,/^sha256:[0-9a-f]{64}$/);
    assert.ok(JSON.stringify(stored).length<240000);
    await assert.rejects(withPhysicalTransaction({id:'old0',userId:'requester',payload:{action:'drop',data:'x'.repeat(1800)}},async()=>{
      throw Error('MUST NOT EXECUTE');
    }),/reconcile|interruption/);
  } finally {if(previous===undefined)delete globalThis.game;else globalThis.game=previous;}
});
