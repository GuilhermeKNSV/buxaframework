import test from 'node:test';
import assert from 'node:assert/strict';
import {collectGalleryTree} from '../scripts/core/asset-browser-scan.js';
import {isBrowsableAssetFolder,normalizeAssetFavorites,toggleAssetFavorite,visibleAssetFolders} from '../scripts/core/asset-browser-model.js';
import {createPhysicalRequestChannel} from '../scripts/integrations/physical-item-request-channel.js';

test('image-library tree rejects encoded traversal and does not follow escaped children',async()=>{
  for(const path of ['Art/%2e%2e/Private','Art/%252e%252e/Private','Art/%25252e%25252e/Private','Art/%2fPrivate','Art/a//b','Art/%5cRoot'])
    assert.equal(isBrowsableAssetFolder(path),false,path);
  assert.equal(isBrowsableAssetFolder('Art/Fantasy%20Icons/Weapons'),true);
  const rows=new Map([['Art',{dirs:[{path:'Art/Good'},{path:'Art/%252e%252e/Private'}]}],['Art/Good',{dirs:[]}]]);
  assert.deepEqual(visibleAssetFolders('Art',rows,new Set(['Art']),'Art').map(x=>x.path),['Art','Art/Good']);
  const requested=[];
  const scan=await collectGalleryTree('Art',async path=>{
    requested.push(path);
    return {files:[{path:`${path}/a.png`}],dirs:path==='Art'?[{path:'Art/Good'},{path:'Art/%252e%252e/Private'}]:[]};
  });
  assert.deepEqual(requested,['Art','Art/Good']);
  assert.deepEqual(scan.files.map(f=>f.path),['Art/a.png','Art/Good/a.png']);
  await assert.rejects(collectGalleryTree('Art/%252e%252e',async()=>{throw Error('should not browse');}),/Invalid image-library root/);
});

test('folder favorites discard encoded traversal while image URLs remain supported',()=>{
  const input={data:{folders:['Art/Good','Art/%252e%252e/Private'],images:['https://example.com/icon.svg']}};
  const normalized=normalizeAssetFavorites(input);
  assert.deepEqual(normalized.data.folders,['Art/Good']);
  assert.deepEqual(normalized.data.images,['https://example.com/icon.svg']);
  const changed=toggleAssetFavorite(normalized,'data','folders','Art/%2e%2e');
  assert.deepEqual(changed.data.folders,['Art/Good']);
});

test('physical transfer request cleans up pending promise when socket send throws',async()=>{
  const previous={game:globalThis.game,foundry:globalThis.foundry};
  let counter=0;
  globalThis.foundry={utils:{randomID:()=>`req${++counter}`}};
  globalThis.game={user:{id:'player',isGM:false},socket:{emit:()=>{throw Error('offline');}},users:{get:()=>({isGM:true})}};
  try {
    const channel=createPhysicalRequestChannel({perform:async()=>{},physicalActiveGM:()=>({id:'gm',isGM:true}),isPhysicalAuthority:()=>false});
    await assert.rejects(channel.request({action:'loot'}),/could not be sent/);
    await assert.rejects(channel.request({action:'loot'}),/could not be sent/);
    assert.equal(counter,2,'failed send does not retain dangling pending actions');
  }finally{Object.assign(globalThis,previous);}
});
