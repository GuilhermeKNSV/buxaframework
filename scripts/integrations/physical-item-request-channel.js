/** Socket transport and serialized execution for physical Item transactions.
 * Keeps the network/retry lifecycle separate from document mutation code. */
import { MODULE_ID } from '../core/constants.js';
import { withPhysicalTransaction, transferStatus } from '../core/physical-transaction-ledger.js';

export function createPhysicalRequestChannel({perform,physicalActiveGM,isPhysicalAuthority}) {
  const CHANNEL=`module.${MODULE_ID}`;
  const pending=new Map();
  const MAX_CLIENT_PENDING=48;
  const MAX_AUTHORITY_QUEUE=128;
  let queuedAuthority=0;
  let serial=Promise.resolve();
  const emitReply=message=>{
    try { game.socket?.emit(CHANNEL,message); }
    catch(error) { console.error(`${MODULE_ID} | Could not deliver physical transfer response; the ledger retains its receipt.`,error); }
  };
  const localNonce=()=>foundry.utils.randomID(18);
function installPhysicalItemTransfers() {
  game.socket?.on(CHANNEL, (message, authenticatedSenderId) => {
    if (!message || message.ns !== 'physical' || !message.id) return;
    // Foundry's socket server supplies the authenticated sender as argument 2.
    // Never trust the user-controlled `message.from` field for authorization.
    if (typeof authenticatedSenderId !== 'string' || !authenticatedSenderId) return;
    if (message.kind === 'result' || message.kind === 'status-result') {
      if (!game.users?.get?.(authenticatedSenderId)?.isGM ||
          authenticatedSenderId !== physicalActiveGM()?.id || message.to !== game.user.id) return;
      const promise=pending.get(message.id);
      if (!promise) return;
      if(message.kind==='status-result') {
        const report=message.report;
        if(report?.status==='done') {pending.delete(message.id);clearTimeout(promise.timer);promise.resolve(report.result);}
        else if(report?.status==='needs-review'||report?.status==='rejected') {
          pending.delete(message.id);clearTimeout(promise.timer);promise.reject(Error(report.error||'Physical transfer requires GM review.'));
        }
        return;
      }
      pending.delete(message.id); clearTimeout(promise.timer);
      if (message.ok) promise.resolve(message.data);
      else promise.reject(Error(message.error || 'Physical item action failed.'));
      return;
    }
    if (!isPhysicalAuthority()) return;
    if (message.kind === 'status') {
      // Query state only for the exact claimed requester and its nonce.
      const report=transferStatus(message.id,authenticatedSenderId);
      emitReply({ns:'physical',kind:'status-result',id:message.id,to:authenticatedSenderId,report});
      return;
    }
    if (message.kind !== 'request') return;
    const user=game.users?.get?.(authenticatedSenderId);
    if (!user) return;
    if (queuedAuthority >= MAX_AUTHORITY_QUEUE) {
      emitReply({ns:'physical',kind:'result',id:message.id,to:authenticatedSenderId,ok:false,
        error:'The GM transfer queue is busy. Wait before making another request.'});
      return;
    }
    queuedAuthority++;
    serial=serial.catch(()=>{}).then(async()=>{
      try {
        const data=await withPhysicalTransaction({id:message.id,userId:authenticatedSenderId,payload:message.payload},
          ()=>perform(message.payload,user));
        emitReply({ns:'physical',kind:'result',id:message.id,to:authenticatedSenderId,ok:true,data});
      } catch(error) {
        console.warn(`${MODULE_ID} | Physical item transfer failed`,error);
        emitReply({ns:'physical',kind:'result',id:message.id,to:authenticatedSenderId,ok:false,error:error.message});
      } finally { queuedAuthority--; }
    });
  });
}
function requestPhysicalAction(payload) {
  const gm=physicalActiveGM();
  if (!gm) return Promise.reject(Error('An active GM is required to manage scene items.'));
  if (isPhysicalAuthority()) {
    // Socket.io does not echo a broadcast back to its sending client.
    const id=localNonce();
    const run = serial.catch(()=>{}).then(()=>withPhysicalTransaction({id,userId:game.user.id,payload},()=>perform(payload,game.user)));
    serial=run.catch(()=>{});
    return run.catch(error=>{
      console.error(`${MODULE_ID} | Physical item ${payload?.action} failed (local GM)`,error);
      throw error;
    });
  }
  if (!game.socket) return Promise.reject(Error('Foundry socket unavailable.'));
  if (pending.size >= MAX_CLIENT_PENDING) return Promise.reject(Error('Too many physical transfers are awaiting the GM. Wait for previous requests.'));
  const id=localNonce();
  return new Promise((resolve,reject)=>{
    // Never advise a blind retry: the GM may have already committed the Item.
    // Request the persisted receipt first, then fail with the original nonce.
    const timer=setTimeout(()=>{
      if(!pending.has(id))return;
      try { game.socket.emit(CHANNEL,{ns:'physical',kind:'status',id,from:game.user.id}); }
      catch(error) {
        pending.delete(id);
        reject(Error(`Transfer ${id} status request failed. Ask the GM to check the ledger; do not retry blindly.`,{cause:error}));
        return;
      }
      const later=setTimeout(()=>{
        if(!pending.has(id))return;
        pending.delete(id);
        reject(Error(`Transfer ${id} has no confirmed response. Ask the GM to check the transfer ledger; do not retry blindly.`));
      },8000);
      const entry=pending.get(id);
      if(entry)entry.timer=later;
      else clearTimeout(later);
    },15000);
    pending.set(id,{resolve,reject,timer});
    try { game.socket.emit(CHANNEL,{ns:'physical',kind:'request',id,from:game.user.id,payload}); }
    catch(error) {
      clearTimeout(timer);
      pending.delete(id);
      reject(Error('Physical transfer could not be sent to the GM.',{cause:error}));
    }
  });
}

  return {install:installPhysicalItemTransfers,request:requestPhysicalAction};
}
