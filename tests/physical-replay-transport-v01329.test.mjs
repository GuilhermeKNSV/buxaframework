import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhysicalRequestChannel} from '../scripts/integrations/physical-item-request-channel.js';
import {PHYSICAL_TRANSACTION_LEDGER} from '../scripts/core/physical-transaction-ledger.js';
import {MODULE_ID} from '../scripts/core/constants.js';

test('GM handover returns saved result for duplicate socket nonce without repeating mutation',async()=>{
  const old={game:globalThis.game,foundry:globalThis.foundry};
  const gm={id:'gm',isGM:true,active:true},p={id:'player',isGM:false,active:true};
  let stored={version:1,records:{}},writes=0,calls=0;
  const handlers=[];const sent=[];
  globalThis.foundry={utils:{randomID:()=>String(++writes)}};
  globalThis.game={user:gm,users:{get:id=>id==='player'?p:gm},
    settings:{settings:new Map([[`${MODULE_ID}.${PHYSICAL_TRANSACTION_LEDGER}`,true]]),
      get:()=>structuredClone(stored),async set(ns,key,value){stored=structuredClone(value);}},
    socket:{on:(c,fn)=>handlers.push(fn),emit:(c,msg)=>sent.push(msg)}};
  try {
    const create=()=>createPhysicalRequestChannel({physicalActiveGM:()=>gm,isPhysicalAuthority:()=>true,
      perform:async()=>({count:++calls})});
    create().install();
    const message={ns:'physical',kind:'request',id:'stable-01',from:'player',payload:{action:'move',sceneId:'s',itemId:'i'}};
    handlers[0](message,'player');
    for(let i=0;i<20&&!sent.length;i++)await new Promise(r=>setTimeout(r,0));
    assert.equal(sent[0]?.ok,true);
    assert.equal(calls,1);
    // New elected GM with an empty in-memory queue reads the same world ledger.
    create().install();
    handlers[1](message,'player');
    for(let i=0;i<20&&sent.length<2;i++)await new Promise(r=>setTimeout(r,0));
    assert.equal(sent[1]?.data?.count,1);
    assert.equal(calls,1);
    handlers[1]({...message,kind:'status'},'player');
    assert.equal(sent[2]?.report?.status,'done');
  }finally{
    for(const [key,value] of Object.entries(old))if(value===undefined)delete globalThis[key];else globalThis[key]=value;
  }
});
