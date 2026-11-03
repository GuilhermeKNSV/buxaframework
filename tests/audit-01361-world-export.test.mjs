import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileFailedGroundWorldExport} from '../scripts/integrations/physical-world-export-recovery.js';
const error=Error('Foundry after-update hook failed');
test('post-save world export error does not destroy the only surviving copy',async()=>{
 let deleteCalls=0;
 const saved=await reconcileFailedGroundWorldExport({error,created:{id:'exported'},sourceStillPresent:false,
  deleteCreated:()=>{deleteCalls++;},exists:()=>true});
 assert.equal(saved.itemId,'exported');assert.equal(deleteCalls,0);
});
test('pre-save world export failure removes the freshly created duplicate and rethrows original error',async()=>{
 let exists=true;
 await assert.rejects(reconcileFailedGroundWorldExport({error,created:{id:'exported'},sourceStillPresent:true,
  deleteCreated:async()=>{exists=false;},exists:()=>exists}),e=>e===error);
 assert.equal(exists,false);
});
test('hook throws after successful duplicate cleanup: verification treats copy as removed',async()=>{
 let exists=true;
 await assert.rejects(reconcileFailedGroundWorldExport({error,created:{id:'exported'},sourceStillPresent:true,
  deleteCreated:async()=>{exists=false;throw Error('delete hook');},exists:()=>exists}),e=>e===error);
 assert.equal(exists,false);
});
test('failed compensation does not mask a surviving duplicate',async()=>{
 await assert.rejects(reconcileFailedGroundWorldExport({error,created:{id:'exported'},sourceStillPresent:true,
  deleteCreated:async()=>{throw Error('rollback denied');},exists:()=>true}),/both copies may exist/);
});
