import test from 'node:test';
import assert from 'node:assert/strict';
import {sameStackType,planStackTransfer} from '../scripts/core/stack-capacity.js';
import {collectUsedAssetPaths} from '../scripts/core/asset-browser-model.js';
const wrapped=(rarity,bonus=0)=>({
  name:'Coin',type:'loot',img:'coin.png',system:{quantity:3},
  flags:{buxaframework:{item:{rarityId:rarity,multiple:{enabled:true,stackKey:'coin',maxStack:10},
    increases:bonus?[{id:'str',target:'attribute:str:value',value:bonus,mode:'flat'}]:[]}}},
  getFlag(ns,key){return this.flags[ns]?.[key];}
});
test('same stack identity cannot combine different rarities or mechanical rules',()=>{
  const common=wrapped('common');const rare=wrapped('rare');const buffed=wrapped('common',4);
  assert.equal(sameStackType(common,rare),false);
  assert.equal(sameStackType(common,buffed),false);
  assert.deepEqual(planStackTransfer(common,3,[rare,buffed]).merges,[]);
});
test('image in-use includes authoritative per-scene board items, stack artwork and nested contents',()=>{
  const stackRule={multiple:{enabled:true,stackImages:[{at:2,mode:'image',img:'pile.png'},
    {at:4,mode:'custom',layers:[{img:'coin-layer.png'}]}]}};
  const world={user:{isGM:true},items:{contents:[{name:'Coin',img:'coin.png',flags:{buxaframework:{item:stackRule}}}]},
    actors:{contents:[]},scenes:{contents:[{id:'sceneA',name:'A'}]},
    settings:{get(_ns,key){
      if(key==='physicalSceneV2_sceneA')return {version:2,initialized:true,records:[{id:'new',data:{name:'New',img:'new-board.png',flags:{buxaframework:{backpackContents:[{data:{name:'Nested',img:'inside.png'}}]}}}}]};
      if(key==='physicalSceneItems')return {sceneA:[{id:'old',data:{name:'Stale',img:'stale.png'}}]};
      return null;
    }}};
  const used=collectUsedAssetPaths(world);
  for(const img of ['pile.png','coin-layer.png','new-board.png','inside.png'])assert.ok(used.has(img),img);
  assert.equal(used.has('stale.png'),false,'stale legacy record is no longer authoritative');
});
