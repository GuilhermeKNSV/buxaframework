/** Resolve a GM world-Item export when a scene write throws after the
 * server may already have persisted it. Source and destination cannot be
 * deleted merely because the Promise rejected; inspect the saved source. */
export async function reconcileFailedGroundWorldExport({error,created,sourceStillPresent,deleteCreated,exists}) {
  if(!sourceStillPresent) {
    // The chest no longer contains the exported Item: deleting the world
    // copy now would irreversibly lose it.
    return {itemId:created.id,note:'Scene write persisted despite a post-save error.'};
  }
  try {await deleteCreated();}
  catch(rollbackError) {
    if(exists())throw Error('World export rollback failed; both copies may exist. Ask the GM to reconcile them.',{cause:error});
  }
  if(exists())throw Error('World export failed but the duplicate Item still exists. Ask the GM to reconcile it.',{cause:error});
  throw error;
}
