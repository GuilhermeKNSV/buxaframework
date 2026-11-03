/** Optional GM migration of the legacy aggregate into independent per-scene
 * settings. Preserves the original aggregate as recovery backup. */
import { PHYSICAL_SCENE_STORE, scenePhysicalItems, assertPhysicalSceneRecordsWritable } from './physical-items.js';
import { MODULE_ID } from './constants.js';
import { readScenePartition, writeScenePartition } from './physical-scene-partitions.js';
export async function migratePhysicalScenes({dryRun=true}={}) {
  if(!globalThis.game?.user?.isGM)throw Error('Only a GM may migrate physical scene storage.');
  const scenes=game.scenes?.contents??[...(game.scenes??[])];
  const report={dryRun:Boolean(dryRun),scenes:[],migrated:0,skipped:0};
  for (const scene of scenes) {
    const partition=readScenePartition(scene.id);
    if (!partition)throw Error('Per-scene world-setting support is unavailable. Migration aborted.');
    if (partition.initialized){report.skipped++;continue;}
    assertPhysicalSceneRecordsWritable(scene);
    const records=scenePhysicalItems(scene);
    const ids=new Set();
    for(const entry of records) {
      if(!entry.id || ids.has(entry.id))throw Error(`Scene ${scene.id} contains duplicate physical item IDs; migration stopped.`);
      ids.add(entry.id);
    }
    report.scenes.push({id:scene.id,name:scene.name||scene.id,count:records.length});
    if (!dryRun){await writeScenePartition(scene.id,records);report.migrated++;}
  }
  // Intentionally retain the old aggregate until the GM backs up the world.
  // Removing it automatically would destroy the only fallback on a bad save.
  return report;
}
