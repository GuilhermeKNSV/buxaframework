/** Durable replay protection for GM-authoritative physical Item transfers.
 * A pending record is never blindly replayed after a GM crash: a GM must
 * reconcile it. Completed requests may safely return their stored result.
 * The world setting is registered at init; older isolated tests without
 * registered settings run the original serialized path. */
import { MODULE_ID } from './constants.js';

export const PHYSICAL_TRANSACTION_LEDGER = 'physicalTransferLedger';
const MAX_FINISHED = 384;
const MAX_BYTES = 240_000;
const MAX_ID_LENGTH = 96;
const clone = value => structuredClone(value);
const now = () => Date.now();

function hasRegisteredSetting() {
  return Boolean(globalThis.game?.settings?.settings?.has?.(`${MODULE_ID}.${PHYSICAL_TRANSACTION_LEDGER}`));
}
function normalize(value) {
  if(!value || typeof value!=='object' || Array.isArray(value) || value.version!==1) throw Error('Physical transfer ledger version is unsupported or corrupt; ask the GM to inspect it.');
  const records=value.records;
  if(!records || typeof records!=='object' || Array.isArray(records)) throw Error('Physical transfer ledger records are corrupt.');
  return {version:1,records};
}
export function readPhysicalLedger() {
  if(!hasRegisteredSetting())return null;
  let value;
  try {value=game.settings.get(MODULE_ID,PHYSICAL_TRANSACTION_LEDGER);}
  catch(error){throw Error('The transaction journal cannot be read. Physical transfers are temporarily disabled.',{cause:error});}
  return normalize(value);
}
async function persist(records) {
  const value={version:1,records};
  if(JSON.stringify(value).length>MAX_BYTES)throw Error('Transaction journal is full. Ask the GM to reconcile old entries.');
  await game.settings.set(MODULE_ID,PHYSICAL_TRANSACTION_LEDGER,value);
  const saved=readPhysicalLedger();
  if(!saved || JSON.stringify(saved.records)!==JSON.stringify(records))
    throw Error('The transaction journal did not confirm its save. The item transfer was not started.');
}
function prune(records) {
  const finished=Object.entries(records).filter(([,v])=>v.status==='done'||v.status==='rejected'||v.status==='reconciled')
    .sort((a,b)=>(a[1].finished||0)-(b[1].finished||0));
  for(const [id] of finished.slice(0,Math.max(0,finished.length-MAX_FINISHED)))delete records[id];
  // Compute the size once: repeatedly serializing the full journal for each
  // finished entry can become quadratic in large scenes.
  let estimatedBytes=JSON.stringify({version:1,records}).length;
  if(estimatedBytes>MAX_BYTES) for(const [id] of finished) {
    if(estimatedBytes<=MAX_BYTES)break;
    const entry=records[id];
    if(!entry)continue;
    // Intentionally overestimate after each deletion; final persist checks
    // the exact serialized bytes before accepting the journal.
    estimatedBytes-=Math.max(0,JSON.stringify({[id]:entry}).length-2);
    delete records[id];
  }
}
/** Read-only diagnostics for the GM; in-progress entries are retained until
 * a human verifies the Scene and Actor Items after an interrupted transfer. */
export function inspectPhysicalTransactions({limit=100,offset=0}={}) {
  if(!globalThis.game?.user?.isGM)throw Error('Only a GM may inspect Item transfers.');
  const ledger=readPhysicalLedger();
  if(!ledger)return [];
  const start=Number.isFinite(Number(offset))?Math.max(0,Math.trunc(Number(offset))):0;
  const count=Number.isFinite(Number(limit))?Math.max(1,Math.min(1000,Math.trunc(Number(limit)))):100;
  return Object.entries(ledger.records)
    .sort((a,b)=>(b[1].started||0)-(a[1].started||0))
    .slice(start,start+count)
    .map(([id,entry])=>({id,...clone(entry)}));
}
function signature(payload){return JSON.stringify(payload);}
/** Compact, collision-resistant fingerprints keep a busy world's transfer
 * journal from filling with repeated full JSON requests. Existing full JSON
 * fingerprints are migrated in place without changing their replay meaning. */
async function fingerprint(value){
  if(typeof value!=='string')throw Error('Invalid physical transfer payload.');
  const subtle=globalThis.crypto?.subtle;
  if(!subtle?.digest || typeof TextEncoder==='undefined')return value;
  const digest=await subtle.digest('SHA-256',new TextEncoder().encode(value));
  return 'sha256:'+Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
}
async function compactFingerprintRecords(records){
  for(const entry of Object.values(records)){
    if(typeof entry?.fingerprint==='string' && !entry.fingerprint.startsWith('sha256:'))
      entry.fingerprint=await fingerprint(entry.fingerprint);
  }
}

export function transferStatus(id,userId) {
  const ledger=readPhysicalLedger();
  if(!ledger)return null;
  const entry=Object.hasOwn(ledger.records,id) ? ledger.records[id] : null;
  if(!entry || entry.userId!==userId)return null;
  return clone(entry);
}
/** Explicit operator acknowledgement AFTER manually verifying source and
 * destination documents. Never retries a transaction or modifies Items. */
export async function acknowledgePhysicalTransaction(id, note='Verified by GM') {
  if(!globalThis.game?.user?.isGM)throw Error('Only a GM may reconcile Item transfers.');
  const ledger=readPhysicalLedger();
  if(!ledger?.records || !Object.hasOwn(ledger.records,id))throw Error('Unknown physical transfer ID.');
  const entry=ledger.records[id];
  if(!['pending','needs-review'].includes(entry.status))throw Error('Only interrupted transfers can be acknowledged.');
  const records={...ledger.records,[id]:{...entry,status:'reconciled',finished:now(),
    note:String(note).slice(0,300)}};
  await persist(records);
  return clone(records[id]);
}
/** The caller MUST serialize this function with all other physical mutations.
 * This is not a distributed mutex; a single elected GM owns the write queue. */
export async function withPhysicalTransaction({id,userId,payload},operation) {
  const ledger=readPhysicalLedger();
  if(!ledger)return operation();
  if(typeof id!=='string' || !id.length || id.length>MAX_ID_LENGTH || !/^[\w-]+$/.test(id))
    throw Error('Invalid physical transfer request ID.');
  if(typeof userId!=='string' || !userId)throw Error('Invalid physical transfer requester.');
  const fingerprintRaw=signature(payload);
  if(typeof fingerprintRaw!=='string')throw Error('Invalid physical transfer payload.');
  if(fingerprintRaw.length>24_000)throw Error('Physical transfer request is too large.');
  const compactSignature=await fingerprint(fingerprintRaw);
  const old=Object.hasOwn(ledger.records,id) ? ledger.records[id] : null;
  if(old){
    if(old.userId!==userId || (old.fingerprint!==fingerprintRaw && old.fingerprint!==compactSignature))
      throw Error('This transfer request ID belongs to a different operation.');
    if(old.status==='done')return clone(old.result);
    if(old.status==='rejected')throw Error(old.error||'The prior transaction failed.');
    if(old.status==='reconciled')throw Error(`Transfer ${id} was manually reconciled by the GM; it cannot be replayed.`);
    throw Error(`Transfer ${id} may have committed before interruption. Ask the GM to reconcile it; do not repeat.`);
  }
  const records={...clone(ledger.records),[id]:{userId,fingerprint:compactSignature,action:payload?.action||'',
    sceneId:payload?.sceneId||'',started:now(),status:'pending'}};
  prune(records);
  await compactFingerprintRecords(records);
  await persist(records);
  let result;
  try {result=await operation();}
  catch(error){
    // On ambiguous failures we deliberately leave a pending review record.
    // Resending must NEVER repeat a possibly completed source mutation.
    const current=readPhysicalLedger();
    const entry=current.records[id];
    if(entry && Object.hasOwn(current.records,id)){
      const next={...current.records,[id]:{...entry,status:'needs-review',
        error:String(error?.message||error).slice(0,480),finished:now()}};
      try{await persist(next);}catch(saveError){console.error(`${MODULE_ID} | Transaction review save failed`,saveError);}
    }
    throw error;
  }
  const current=readPhysicalLedger();
  if(!current?.records || !Object.hasOwn(current.records,id) || current.records[id].status!=='pending')
    throw Error(`Transfer ${id} completed, but its journal changed. Ask the GM to reconcile; do not retry.`);
  // A transfer result must fit the terminal journal BEFORE marking done.
  // If it is too large, the request must remain reviewable, not replayable.
  const resultJson=JSON.stringify(result);
  if (resultJson?.length > 24_000) {
    const review={...current.records,[id]:{...current.records[id],status:'needs-review',
      error:'Transfer succeeded but response exceeded the journal size limit.',finished:now()}};
    await persist(review);
    throw Error(`Transfer ${id} completed but its result was too large to journal. GM reconciliation is required.`);
  }
  const next={...current.records,[id]:{...current.records[id],status:'done',result:clone(result),finished:now()}};
  prune(next);
  // If acknowledgement fails, keep the persisted pending record; never redo.
  await persist(next);
  return result;
}
