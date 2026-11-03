import test from 'node:test';
import assert from 'node:assert/strict';
import {rarityTier} from '../scripts/core/rarity-tier.js';
import {formatItemCardLabel} from '../scripts/core/item-presentation.js';
import {positionPhysicalItemFx} from '../scripts/integrations/physical-item-fx.js';

// These inputs emulate persisted world data and third-party imports. A disabled
// rarity flag must never promote a drop to a more valuable tier.
for (const flag of ['ornament','glint','animated','spectrum']) {
  for (const value of ['false','FALSE','0','off','no','disabled']) {
    test(`rarity: disabled ${flag}=${JSON.stringify(value)} does not raise a common drop`,()=>{
      assert.equal(rarityTier({id:'common',[flag]:value}),0);
    });
  }
}
// IDs are not case-sensitive in user-facing or migrated rarity configuration.
for (const id of ['COMMON','Common',' COMMON ','UNCOMMON','Rare','EPIC','LEGENDARY',' Divine ','GODLY','Normal']) {
  test(`rarity: normalized id ${JSON.stringify(id)} resolves its true tier`,()=>{
    const tier={common:0,uncommon:1,rare:1,epic:2,legendary:3,divine:4,godly:4,normal:0}[id.trim().toLowerCase()];
    assert.equal(rarityTier({id}),tier);
  });
}
// Players/GMs intentionally name custom effects; rendering cannot rewrite their
// capitalization, abbreviations, names or formulas.
for(const label of ['HP','MP','STR','DMG','MOD','DPS','AoE','HTML','XML','ARCANE POWER','LUCKY HIT','BONUS HP','WILD MAGIC','NASA']) {
  test(`item text: preserve authored label ${label}`,()=>{
    assert.equal(formatItemCardLabel(label),label);
  });
}
function minimalFx(){
  const points=[];
  return {position:{set(x,y){points.push({x,y});}},points};
}
for (const record of [{size:20},{size:76},{size:200},{size:450},{size:800},{size:1200},
  {size:76,x:0,y:0},{size:76,x:100,y:200},{size:200,rotation:90}]) {
  test(`VFX: geometry function tolerates valid minimal effect ${JSON.stringify(record)}`,()=>{
    const fx=minimalFx();
    assert.doesNotThrow(()=>positionPhysicalItemFx(fx,record));
    assert.equal(fx.points.length,1);
    assert.ok(Number.isFinite(fx.points[0].x)&&Number.isFinite(fx.points[0].y));
  });
}
