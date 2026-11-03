import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { pathToFileURL,fileURLToPath } from 'node:url';
const BASE=process.env.BUXA_AUDIT_BASE||resolve(dirname(fileURLToPath(import.meta.url)),'..');
const imp=path=>import(pathToFileURL(resolve(BASE,'scripts/core',path)).href);
const MOD='buxaframework';
const get=(o,path)=>String(path).split('.').reduce((v,k)=>v?.[k],o);
const set=(o,path,value)=>{const keys=String(path).split('.');let p=o;for(const k of keys.slice(0,-1))p=p[k]??={};p[keys.at(-1)]=value;};
const [attr,prof,lev,res,dnd,sight,constants,configCore]=await Promise.all([
  imp('attributes.js'),imp('proficiencies.js'),imp('leveling.js'),imp('resources.js'),imp('dnd5e.js'),imp('physical-item-visibility.js'),imp('constants.js'),imp('config.js')]);
const config=structuredClone(constants.DEFAULT_SHEET_CONFIG);
config.level.enabled=true;config.level.startingLevel=2;config.level.levelUpPermission='owner';
config.attributes.points={...config.attributes.points,enabled:true,startingPoints:7,playersCanDecrease:true};
config.attributes.entries=[{id:'str',label:'Strength',ability:'str',rebirth:{enabled:true,maxPoints:100},modifier:{enabled:false}}];
config.proficiencies.enabled=true;
config.proficiencies.points={...config.proficiencies.points,enabled:true,startingPoints:9,playersCanDecrease:true};
config.proficiencies.entries=[{id:'skill',enabled:true,label:'Skill'}];
config.resources[0].link='buxa';config.resources[0].startMax=12;config.resources[0].syncCurrentOnMax=false;
config.resources[0].levelUp={maxGain:0,maxEveryLevels:1,restoreMode:'none',restoreAmount:0,restoreEveryLevels:1};
globalThis.game={system:{id:'dnd5e'},user:{id:'GM',isGM:true},settings:{get:()=>config},i18n:{lang:'en'}};
globalThis.foundry={utils:{hasProperty:(o,p)=>get(o,p)!==undefined,getProperty:get,setProperty:set,escapeHTML:String,deepClone:structuredClone,randomID:()=> 'TestIdentity'}};
globalThis.ui={notifications:{warn(){},info(){},error(){}}};
let failHook=false;
globalThis.Hooks={callAll(){if(failHook)throw Error('faulty addon observer');}};
function actorAt({progress=0,level=2,attributePoints=10,proficiencyPoints=10,resourceCurrent=8,resourceMax=12}={}) {
 const data={isOwner:true, flags:{buxaframework:{level,attributePoints,proficiencyPoints,attributes:{str:{progress,rebirths:0}},proficiencies:{skill:{value:0}},resources:{hp:{value:resourceCurrent,max:resourceMax}}}},system:{abilities:{str:{value:progress}}}};
 const actor={...data,updates:[],getFlag(ns,key){return get(data.flags[ns],key);}, async update(payload){this.updates.push(payload);for(const [key,value] of Object.entries(payload))set(data,key,value);return this;}};
 return actor;
}
const invalid=[['empty',''],['whitespace','  '],['null',null],['false',false],['undefined',undefined],['garbled','not-a-number']];
for (const [name,v] of invalid) {
 test(`attribute point balance restores configured start instead of corrupted ${name}`,()=>{
  const a=actorAt();set(a.flags, 'buxaframework.attributePoints',v);
  assert.equal(attr.getAttributePoints(a,config),7);
 });
 test(`proficiency point balance restores configured start instead of corrupted ${name}`,()=>{
  const a=actorAt();set(a.flags, 'buxaframework.proficiencyPoints',v);
  assert.equal(prof.getProficiencyPoints(a,config),9);
 });
 test(`Actor level restores configured start instead of corrupted ${name}`,()=>{
  const a=actorAt();set(a.flags,'buxaframework.level',v);
  assert.equal(lev.getActorLevel(a,config),2);
 });
 for(const part of ['value','max'])test(`custom resource ${part} restores starting max for ${name}`,()=>{
  const a=actorAt();set(a.flags,`buxaframework.resources.hp.${part}`,v);
  const value=dnd.getResourceState(a,config.resources[0]);
  assert.equal(value[part==='value'?'current':'max'],12);
 });
 for(const part of ['value','max'])test(`D&D resource ${part} restores starting max for ${name}`,()=>{
  const a=actorAt();const hp={...config.resources[0],link:'hp'};
  set(a,`system.attributes.hp.${part}`,v);
  if(!get(a,'system.attributes.hp'))set(a,'system.attributes.hp',{});
  // Same schema shape as a normal D&D 5e actor.
  assert.equal(dnd.getResourceState(a,hp)[part==='value'?'current':'max'],12);
 });
 test(`quantity defaults to 1 instead of losing an item for ${name}`,()=>{
  const item={system:{quantity:v}};
  assert.equal(dnd.getItemQuantity(item),1);
 });
}
for(const [name,action,inspect] of [
 ['attribute point spending',a=>attr.changeAttribute(a,'str',1),a=>get(a.flags,'buxaframework.attributes.str.progress')],
 ['rebirth',a=>attr.rebirthAttribute(a,'str',{ask:false}),a=>get(a.flags,'buxaframework.attributes.str.rebirths')],
 ['proficiency spending',a=>prof.changeProficiency(a,'skill',1),a=>get(a.flags,'buxaframework.proficiencies.skill.value')],
 ['level gain',a=>lev.levelUpActor(a),a=>get(a.flags,'buxaframework.level')],
 ['resource adjustment',a=>res.updateResource(a,'hp',{current:5}),a=>get(a.flags,'buxaframework.resources.hp.value')]
]) {
 test(`${name} stays successful when an unrelated post-save hook throws`,async()=>{
  const a=actorAt({progress:name==='rebirth'?100:0});
  failHook=true;const old=console.error;console.error=()=>{};
  try {const result=await action(a);assert.ok(result,`${name} must report success`);assert.equal(a.updates.length,1);assert.notEqual(inspect(a),undefined);}
  finally {failHook=false;console.error=old;}
 });
 test(`${name} cannot be double-spent while the first database write is pending`,async()=>{
  const a=actorAt({progress:name==='rebirth'?100:0});let resume;
  const wait=new Promise(r=>resume=r);let started;
  const starting=new Promise(r=>started=r);
  const oldUpdate=a.update.bind(a);
  a.update=async payload=>{started();await wait;return oldUpdate(payload);};
  const first=action(a);await starting;
  const second=action(a);
  const concurrent=await Promise.race([second,new Promise(resolve=>setTimeout(()=>resolve('still-pending'),0))]);
  resume();await Promise.allSettled([first,second]);
  assert.equal(concurrent,false,'second invocation must be rejected while pending');
  assert.equal(a.updates.length,1);
 });
 test(`${name} unlocks after a database rejection so retry is possible`,async()=>{
  const a=actorAt({progress:name==='rebirth'?100:0});const savedUpdate=a.update.bind(a);
  a.update=async()=>{throw Error('database unavailable');};
  await assert.rejects(action(a),/database unavailable/);
  a.update=savedUpdate;
  assert.ok(await action(a));
  assert.equal(a.updates.length,1);
 });
}
test('scene artwork remains concealed if no authenticated viewer exists, even when token vision is disabled',()=>{
 assert.equal(sight.physicalItemVisible({x:100,y:100,size:60},{scene:{id:'S',tokenVision:false},user:null}),false);
});
test('legitimate controlled viewer still sees scene artwork when token vision is disabled',()=>{
 assert.equal(sight.physicalItemVisible({x:100,y:100,size:60},{scene:{id:'S',tokenVision:false},user:{id:'player',isGM:false}}),true);
});

test('multi-point progress and proficiency delta actions spend/refund their actual delta', async () => {
 const a=actorAt({progress:0, attributePoints:20, proficiencyPoints:20});
 const attrRaise=await attr.changeAttribute(a,'str',5);
 assert.equal(attrRaise?.delta,5);
 assert.equal(get(a.flags,'buxaframework.attributePoints'),15);
 assert.equal(get(a.flags,'buxaframework.attributes.str.progress'),5);
 const attrLower=await attr.changeAttribute(a,'str',-3);
 assert.equal(attrLower?.delta,-3);
 assert.equal(get(a.flags,'buxaframework.attributePoints'),18);
 const profRaise=await prof.changeProficiency(a,'skill',7);
 assert.equal(profRaise?.delta,7);
 assert.equal(get(a.flags,'buxaframework.proficiencyPoints'),13);
 const profLower=await prof.changeProficiency(a,'skill',-4);
 assert.equal(profLower?.delta,-4);
 assert.equal(get(a.flags,'buxaframework.proficiencyPoints'),17);
 assert.equal(await attr.changeAttribute(a,'str',2.5),false);
 assert.equal(await prof.changeProficiency(a,'skill',NaN),false);
 assert.equal(await attr.changeAttribute(a,'str',200000),false);
 assert.equal(await prof.changeProficiency(a,'skill',0),false);
});
