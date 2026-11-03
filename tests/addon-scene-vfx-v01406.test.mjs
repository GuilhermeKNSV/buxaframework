import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sequencerAssetPath, canPlaySceneItemFx, playSceneItemFx } from '../scripts/integrations/scene-item-sequencer.js';
import { setGameIconsFolder } from '../scripts/apps/layout-config-vfx-picker.js';

test('Sequencer paths reject remote urls and unsafe paths but allow world/module assets',()=>{
  assert.equal(sequencerAssetPath('modules/effects/loot.webm'),'modules/effects/loot.webm');
  assert.equal(sequencerAssetPath('modules/effects/loot.svg'),'modules/effects/loot.svg');
  assert.equal(sequencerAssetPath('https://example.com/effect.webm'),'');
  assert.equal(sequencerAssetPath('../secrets.webp'),'');
  assert.equal(sequencerAssetPath('data:image/svg+xml,AA'),'');
  assert.equal(sequencerAssetPath('modules/a/../../private.svg'),'');
  assert.equal(sequencerAssetPath('modules/loot.exe'),'');
});
test('Sequencer scene effects are optional and do not run without an active module and chosen file',()=>{
  const config={addons:{sequencer:{enabled:true,effectFile:'modules/demo/loot.webm'}}};
  const modules={get:id=>id==='sequencer'?{active:true}:null};
  const old=globalThis.Sequence;
  try {
    delete globalThis.Sequence;
    assert.equal(canPlaySceneItemFx(config,modules),false);
    globalThis.Sequence=function(){};
    assert.equal(canPlaySceneItemFx(config,modules),true);
    assert.equal(canPlaySceneItemFx({addons:{sequencer:{enabled:false,effectFile:config.addons.sequencer.effectFile}}},modules),false);
    assert.equal(canPlaySceneItemFx(config,{get:()=>({active:false})}),false);
  }finally{if(old===undefined)delete globalThis.Sequence;else globalThis.Sequence=old;}
});
test('Game-icons.net shortcut updates only the icon source input, not the saved config',()=>{
  const inputs=Object.fromEntries(['[data-addon-icon-source-source]','[data-addon-icon-source-path]',
    '[data-addon-icon-source-display]','[data-addon-icon-source-source-display]'].map(k=>[k,{value:'previous',textContent:''}]));
  const app={element:{querySelector:k=>inputs[k]}};
  assert.equal(setGameIconsFolder(app),true);
  assert.equal(inputs['[data-addon-icon-source-path]'].value,'modules/game-icons-net/whitebackgrounds');
  assert.equal(inputs['[data-addon-icon-source-source]'].value,'data');
});
test('New addon settings are visible, optional, and wired to saving',()=>{
  const template=readFileSync(new URL('../templates/layout-config.hbs',import.meta.url),'utf8');
  const handler=readFileSync(new URL('../scripts/apps/layout-config.js',import.meta.url),'utf8');
  const config=readFileSync(new URL('../scripts/core/config.js',import.meta.url),'utf8');
  for(const needle of ['Sequencer','Automated Animations','socketlib','Game-icons.net','Carousel Combat Tracker','data-addon-sequencer-asset','pickSequencerAsset','chooseGameIcons']) assert.ok(template.includes(needle),needle);
  assert.match(handler,/sequencer:\s*\{/);
  assert.match(handler,/effectFile:\s*value\(root/);
  assert.match(config,/sequencerRaw/);
  const manifest=JSON.parse(readFileSync(new URL('../module.json',import.meta.url),'utf8'));
  assert.equal(manifest.relationships.requires?.length??0,0,'optional integrations never hard-require other addons');
});

test('Active Sequencer receives the configured file and the scene item center',()=>{
  const old={Sequence:globalThis.Sequence,game:globalThis.game,canvas:globalThis.canvas,foundry:globalThis.foundry};
  let played=0,chosen='',placed=null;
  const effect={file(value){chosen=value;return this;},atLocation(value){placed=value;return this;},fadeIn(){return this;},fadeOut(){return this;}};
  globalThis.Sequence=class {effect(){return effect;} play(){played++;return Promise.resolve();}};
  globalThis.foundry={utils:{deepClone:structuredClone}};
  globalThis.game={modules:{get:()=>({active:true})},settings:{get:()=>({addons:{sequencer:{enabled:true,effectFile:'modules/vfx/loot.webm'}}})}};
  globalThis.canvas={ready:true};
  try {
    assert.equal(playSceneItemFx({x:20,y:30,size:80}),true);
    assert.equal(played,1);
    assert.equal(chosen,'modules/vfx/loot.webm');
    assert.deepEqual(placed,{x:60,y:70});
  }finally{for(const [key,value] of Object.entries(old)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
