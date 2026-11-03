import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhysicalRequestChannel} from '../scripts/integrations/physical-item-request-channel.js';
const wait=()=>new Promise(r=>setTimeout(r,4));
test('socket authorization uses server sender ID, not claimed from; missing sender is discarded',async()=>{
 const old={game:globalThis.game,foundry:globalThis.foundry};
 let handler,calls=0;const sent=[];
 const gm={id:'gm',isGM:true},alice={id:'alice',isGM:false},mallory={id:'mallory',isGM:false};
 globalThis.foundry={utils:{randomID:()=>String(calls+1)}};
 globalThis.game={user:gm,users:{get:id=>({gm,alice,mallory})[id]},
  settings:{settings:{has:()=>false}},socket:{on:(chan,fn)=>handler=fn,emit:(chan,msg)=>sent.push(msg)}};
 try {
  createPhysicalRequestChannel({perform:async(payload,user)=>{calls++;return {owner:user.id};},physicalActiveGM:()=>gm,isPhysicalAuthority:()=>true}).install();
  const forged={ns:'physical',kind:'request',id:'spoof-1',from:'gm',payload:{action:'move'}};
  handler(forged);await wait();assert.equal(calls,0,'missing authenticated sender may not execute');
  handler(forged,'mallory');await wait();assert.equal(calls,1);
  assert.equal(sent.at(-1).to,'mallory');assert.equal(sent.at(-1).data.owner,'mallory');
  handler({...forged,kind:'status'},'alice');await wait();
  assert.equal(sent.at(-1).report,null,'other user may not read transaction status');
 }finally {for(const [k,v] of Object.entries(old))if(v===undefined)delete globalThis[k];else globalThis[k]=v;}
});
