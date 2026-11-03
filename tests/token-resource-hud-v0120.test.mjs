import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MODULE_ID } from "../scripts/core/constants.js";
import { normalizeHudResource, getResourceHud, canSeeResourceHud, trackedHudResources, saveResourceHud, saveResourceHudBatch } from "../scripts/core/resource-hud.js";

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const get = (obj,path) => String(path).split(".").reduce((acc,key) => acc?.[key],obj);
const set = (obj,path,value) => {const keys=path.split(".");let node=obj;for(const key of keys.slice(0,-1))node=node[key]??={};node[keys.at(-1)]=value;};
const hp={id:"hp",label:"Health",color:"#b84d5b"};
const mp={id:"mp",label:"Mana",color:"#4f7fdb"};
function actor(){return {id:"a",isOwner:true,flags:{[MODULE_ID]:{}},writes:[],
  getFlag(ns,path){return get(this.flags[ns],path);},
  testUserPermission(user,level){return user.id==="owner" && level===3;},
  async update(patch){this.writes.push(patch);for(const [path,value] of Object.entries(patch))set(this,path,value);}
};}

test("resource tracking defaults off, with a resource-based accent and readable numbers",()=>{
  const result=normalizeHudResource({},hp);
  assert.equal(result.enabled,false);
  assert.equal(result.style,"sao");
  assert.equal(result.showValue,true);
  assert.equal(result.showMax,true);
  assert.equal(result.color,"#b84d5b");
});
test("malformed legacy settings are safely normalized",()=>{
  const result=normalizeHudResource({enabled:1,style:"teleport",position:"inside",visibility:"all",viewers:["a","a",7],scale:999,thickness:0,opacity:-4,offsetX:"Infinity",color:"bad"},hp);
  assert.equal(result.enabled,false);
  assert.equal(result.style,"sao");
  assert.equal(result.position,"top");
  assert.deepEqual(result.viewers,["a"]);
  assert.equal(result.scale,2.5);
  assert.equal(result.thickness,4);
  assert.equal(result.opacity,.2);
  assert.equal(result.offsetX,0);
  assert.equal(result.color,hp.color);
});
test("all 3 remaining styles and all number positions can be saved",()=>{
  for(const style of ["sao","classic","vertical"]){
    for(const valuePosition of ["inside","above","below","left","right"]){
      const s=normalizeHudResource({style,valuePosition},hp);
      assert.equal(s.style,style);assert.equal(s.valuePosition,valuePosition);
    }
  }
});
test("everyone sees public bars but hidden tokens still follow Foundry visibility",()=>{
  const a=actor();
  const settings=normalizeHudResource({enabled:true},hp);
  assert.equal(canSeeResourceHud(a,settings,{id:"stranger",isGM:false}),true);
  assert.equal(canSeeResourceHud(a,settings,{id:"stranger",isGM:false},{tokenVisible:false}),false);
  assert.equal(canSeeResourceHud(a,{...settings,enabled:false},{id:"stranger",isGM:false}),false);
});
test("owner-only bars exclude other players and keep GM access",()=>{
  const a=actor();const s=normalizeHudResource({enabled:true,visibility:"owner"},hp);
  assert.equal(canSeeResourceHud(a,s,{id:"owner",isGM:false}),true);
  assert.equal(canSeeResourceHud(a,s,{id:"stranger",isGM:false}),false);
  assert.equal(canSeeResourceHud(a,s,{id:"gm",isGM:true}),true);
});
test("selected-player bars exclude owners not on the selected list",()=>{
  const a=actor();const s=normalizeHudResource({enabled:true,visibility:"selected",viewers:["guest"]},hp);
  assert.equal(canSeeResourceHud(a,s,{id:"guest",isGM:false}),true);
  assert.equal(canSeeResourceHud(a,s,{id:"owner",isGM:false}),false);
  assert.equal(canSeeResourceHud(a,s,{id:"other",isGM:false}),false);
});
test("tracking is per Actor and resource, not a world or shared flag",async()=>{
  const a=actor();const b=actor();
  await saveResourceHud(a,"hp",{enabled:true,style:"classic"},hp);
  assert.equal(getResourceHud(a,hp).enabled,true);
  assert.equal(getResourceHud(a,hp).style,"classic");
  assert.equal(getResourceHud(a,mp).enabled,false);
  assert.equal(getResourceHud(b,hp).enabled,false);
});
test("old radial Actors show a Classic bar with all other settings preserved",async()=>{
  const a=actor();
  const prior={enabled:true,style:"ring",position:"bottom",color:"#123456",showValue:false,
    thickness:15,offsetX:12,offsetY:-8,visibility:"owner",opacity:.8};
  a.flags[MODULE_ID].resourceHud={hp:structuredClone(prior)};
  const effective=getResourceHud(a,hp);
  assert.equal(effective.style,"classic");
  for(const [key,value] of Object.entries(prior)) if(key!=="style") assert.equal(effective[key],value);
  assert.equal(a.writes.length,0,"reading legacy settings does not alter Actor data");
  assert.equal(a.flags[MODULE_ID].resourceHud.hp.style,"ring");
  await saveResourceHud(a,"hp",effective,hp);
  assert.equal(a.writes.length,1,"explicit Save converts deprecated style once");
  assert.equal(a.flags[MODULE_ID].resourceHud.hp.style,"classic");
  await saveResourceHud(a,"hp",effective,hp);
  assert.equal(a.writes.length,1,"subsequent Save is a no-op");
});
test("settings writes are skipped for an unchanged normalized value",async()=>{
  const a=actor();
  assert.equal(await saveResourceHud(a,"hp",{enabled:false},hp),true);
  assert.equal(a.writes.length,0);
  await saveResourceHud(a,"hp",{enabled:true},hp);
  await saveResourceHud(a,"hp",{enabled:true},hp);
  assert.equal(a.writes.length,1);
});
test("batch HUD saving causes one Actor update, and preserves unknown resources",async()=>{
  const a=actor();a.flags[MODULE_ID].resourceHud={ legacy:{custom:true}};
  await saveResourceHudBatch(a,{hp:{enabled:true,showValue:false},mp:{enabled:true,style:"vertical"}},[hp,mp]);
  assert.equal(a.writes.length,1);
  assert.equal(getResourceHud(a,hp).showValue,false);
  assert.equal(getResourceHud(a,mp).style,"vertical");
  assert.deepEqual(a.flags[MODULE_ID].resourceHud.legacy,{custom:true});
});
test("nonowners cannot change tracking flags",async()=>{
  const a=actor();a.isOwner=false;
  assert.equal(await saveResourceHud(a,"hp",{enabled:true},hp),false);
  assert.equal(a.writes.length,0);
});
test("visibility filtering never reports an untracked resource",async()=>{
  const a=actor();await saveResourceHud(a,"hp",{enabled:true,visibility:"selected",viewers:["reader"]},hp);
  assert.deepEqual(trackedHudResources(a,[hp,mp],{id:"reader",isGM:false}).map(item=>item.resource.id),["hp"]);
  assert.deepEqual(trackedHudResources(a,[hp,mp],{id:"outsider",isGM:false}),[]);
});
test("UI uses Player Settings popup and resource toggle; canvas uses token children",()=>{
  const sheet=source("templates/player-sheet.hbs");
  const settings=source("templates/player-settings.hbs");
  const canvas=source("scripts/integrations/token-resource-hud.js");
  assert.match(sheet,/data-action="openPlayerSettings"/);
  assert.match(sheet,/data-resource-track-toggle=/);
  assert.doesNotMatch(sheet,/data-buxa-sheet-config-menu/);
  for(const field of ["style","visibility","showValue","valuePosition","offsetX","offsetY","thickness","scale","opacity"])
    assert.match(settings,new RegExp(`data-hud-field="${field}"`));
  const settingsApp=source("scripts/apps/player-settings.js");
  const core=source("scripts/core/resource-hud.js");
  assert.doesNotMatch(settingsApp,/value:\s*["']ring["']/);
  assert.doesNotMatch(canvas,/drawRing|strokeArc|\.arc\(/);
  assert.match(core,/HUD_STYLES = Object\.freeze\(\["sao", "classic", "vertical"\]\)/);
  assert.match(canvas,/token\.addChild\(container\)/);
  assert.doesNotMatch(canvas,/getBoundingClientRect|requestAnimationFrame|setInterval/);
  assert.match(canvas,/Hooks\.on\("updateActor"/);
  assert.match(canvas,/Hooks\.on\("updateToken"/);
});

test("PIXI smoke: remaining styles plus old radial settings render no arcs and keep zoom behavior",async()=>{
  const before=Object.fromEntries(["PIXI","game","canvas","foundry","Hooks","gsap","CONST"].map(key=>[key,globalThis[key]]));
  const {DEFAULT_SHEET_CONFIG}=await import("../scripts/core/constants.js");
  const {invalidateSheetConfigCache}=await import("../scripts/core/config.js");
  const {installTokenResourceHud}=await import("../scripts/integrations/token-resource-hud.js");
  let graphicsCount=0;
  class Container {
    constructor(){
      this.children=[];this.parent=null;this.alpha=1;
      this.position={x:0,y:0,set(x,y){this.x=x;this.y=y;}};
      this.pivot={x:0,y:0,set(x,y){this.x=x;this.y=y;}};
      this.scale={x:1,y:1,set(x,y=x){this.x=x;this.y=y;}};
    }
    addChild(c){c.parent=this;this.children.push(c);return c;}
    removeChild(c){this.children=this.children.filter(child=>child!==c);c.parent=null;}
    destroy(){this.parent?.removeChild(this);for(const c of [...this.children])c.destroy?.();this.children=[];}
  }
  class Graphics extends Container {
    constructor(){super();graphicsCount++;}
    rect(){return this;} roundRect(){return this;} poly(){return this;} arc(){throw new Error("Removed radial renderer was called");}
    fill(){return this;} stroke(){return this;}
  }
  class Text extends Container {constructor(opts){super();this.text=opts.text;this.anchor={set(){}};}}
  const listeners={};
  try {
    const config=structuredClone(DEFAULT_SHEET_CONFIG);
    config.resources=[
      {...hp,link:"buxa"},
      {...mp,link:"buxa"},
      {id:"stamina",color:"#e0ba58",label:"Stamina",link:"buxa"},
      {id:"shield",color:"#b476ed",label:"Shield",link:"buxa"}
    ];
    globalThis.foundry={utils:{deepClone:structuredClone,randomID:()=>"test",getProperty:get,setProperty:set,hasProperty:(o,p)=>get(o,p)!==undefined}};
    globalThis.game={user:{id:"owner",isGM:false},system:{id:"dnd5e"},settings:{get:()=>config}};
    globalThis.PIXI={Graphics,Container,Text,VERSION:"8.0.0"};
    globalThis.Hooks={on:(name,fn)=>{(listeners[name]??=[]).push(fn);}};
    const a=actor();a.name="Knight";a.items=[];
    a.flags[MODULE_ID].resources={hp:{value:7,max:10},mp:{value:2,max:9},stamina:{value:5,max:5},shield:{value:4,max:8}};
    a.flags[MODULE_ID].resourceHud={
      hp:{enabled:true,style:"sao"},mp:{enabled:true,style:"ring"},
      stamina:{enabled:true,style:"classic",position:"bottom"},
      shield:{enabled:true,style:"vertical",position:"left"}
    };
    const token=new Container();token.w=100;token.h=100;token.actor=a;token.document={name:"Knight"};
    globalThis.canvas={ready:true,stage:{scale:{x:1}},app:{renderer:{screen:{width:1280}}},tokens:{placeables:[token]}};
    invalidateSheetConfigCache();
    installTokenResourceHud();
    listeners.drawToken[0](token);
    assert.ok(token._buxaResourceOverlay?.container);
    assert.equal(token._buxaResourceOverlay.container.parent,token);
    assert.equal(token._buxaResourceOverlay.container.children.length,4);
    assert.ok(graphicsCount>=4);
    assert.equal(token._buxaResourceOverlay.container.pivot.x,50);
    assert.equal(token._buxaResourceOverlay.container.pivot.y,50);
    assert.equal(token._buxaResourceOverlay.container.position.x,50);
    assert.equal(token._buxaResourceOverlay.container.position.y,50);
    assert.equal(token._buxaResourceOverlay.container.scale.x,1);
    const prior=graphicsCount;
    globalThis.canvas.stage.scale.x=.25;
    listeners.canvasPan[0]();
    const distantScale=token._buxaResourceOverlay.container.scale.x;
    assert.ok(distantScale>2 && distantScale<=2.35,"distant token HUD must remain readable");
    assert.equal(graphicsCount,prior,"zoom cannot recreate graphics or pixi labels");
    listeners.canvasPan[0]();
    assert.equal(graphicsCount,prior,"panning at unchanged zoom must be inert");
    globalThis.canvas.stage.scale.x=3;
    listeners.canvasPan[0]();
    assert.ok(token._buxaResourceOverlay.container.scale.x<1,"close zoom must be tempered");
    assert.equal(graphicsCount,prior,"zoom transitions update only a transform");
    listeners.refreshToken[0](token);
    assert.equal(graphicsCount,prior,"position-only refresh must not rebuild all graphics");
    a.flags[MODULE_ID].resources.hp.value=3;
    listeners.updateActor[0](a);
    assert.ok(graphicsCount>prior,"HP document updates repaint HUD");
    listeners.destroyToken[0](token);
    assert.equal(token._buxaResourceOverlay,null);
  } finally {
    invalidateSheetConfigCache();
    for(const [key,value] of Object.entries(before)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
  }
});
