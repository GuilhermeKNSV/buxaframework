import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MODULE_ID, DEFAULT_SHEET_CONFIG } from "../scripts/core/constants.js";
import { invalidateSheetConfigCache } from "../scripts/core/config.js";

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const get = (o, path) => String(path).split(".").reduce((val, part) => val?.[part], o);
const set = (o, path, value) => {
  const parts = path.split(".");
  let current = o;
  for (const part of parts.slice(0, -1)) current = current[part] ??= {};
  current[parts.at(-1)] = value;
};
const hp = { id: "hp", label: "HP", color: "#ed7259", link: "buxa" };

function buildDom() {
  const controls = {
    enabled: {checked:true}, style: {value:"sao"}, position: {value:"top"},
    visibility: {value:"everyone"}, showValue: {checked:true}, showMax: {checked:false},
    showLabel: {checked:false}, valuePosition: {value:"above"}, scale: {value:"1.2"},
    thickness: {value:"14"}, opacity: {value:"0.96"}, offsetX: {value:"8"},
    offsetY: {value:"-9"}, color: {value:"#ed7259"}
  };
  const row = {
    dataset: {hudResource:"hp"},
    querySelector(selector) { return controls[selector.match(/data-hud-field="(\w+)"/)?.[1]]; },
    querySelectorAll(selector) {return selector === "[data-hud-viewer]:checked" ? [] : [];}
  };
  const handlers = new Map();
  const elementFor = name => ({
    disabled:false, isConnected:true,
    addEventListener(event, listener) {handlers.set(name+":"+event, listener);}
  });
  const save = elementFor("save"), cancel = elementFor("cancel");
  return {
    element: {
      querySelectorAll(selector) {
        if (selector === "[data-hud-resource]") return [row];
        return [];
      },
      querySelector(selector) {
        if (selector === "[data-player-settings-save]") return save;
        if (selector === "[data-player-settings-close]") return cancel;
        return null;
      }
    },
    save, cancel, handlers
  };
}

function actor() {
  return {
    id:"player", isOwner:true, name:"Knight", flags:{[MODULE_ID]:{}}, writes:[],
    getFlag(scope, key) {return get(this.flags[scope],key);},
    async update(patch) {this.writes.push(patch);for (const [path,value] of Object.entries(patch)) set(this,path,value);}
  };
}

function prepareEnvironment() {
  const before = Object.fromEntries(["game", "foundry", "Hooks"].map(k => [k, globalThis[k]]));
  class ApplicationV2 {
    constructor(opts) {this.options=opts;this.closed=false;}
    _onRender() {}
    async _prepareContext() { return {}; }
    async close() {this.closed=true;}
  }
  const config = structuredClone(DEFAULT_SHEET_CONFIG);
  config.resources = [hp];
  globalThis.foundry = { applications:{ api:{ApplicationV2,HandlebarsApplicationMixin:Base=>Base} },
    utils:{deepClone:structuredClone,randomID:()=>"id",getProperty:get,setProperty:set,hasProperty:(o,p)=>get(o,p)!==undefined} };
  globalThis.game = {user:{id:"owner",isGM:false},system:{id:"dnd5e"},users:[],settings:{get:()=>config}};
  globalThis.Hooks = {callAll() {}};
  invalidateSheetConfigCache();
  return () => {
    invalidateSheetConfigCache();
    for (const [key,value] of Object.entries(before)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key]=value;
    }
  };
}

test("Player Settings uses a button rather than blocked form submission, and opacity accepts the default", () => {
  const app = source("scripts/apps/player-settings.js");
  const tpl = source("templates/player-settings.hbs");
  assert.match(app,/tag:\s*"div"/);
  assert.doesNotMatch(app,/closeOnSubmit|submitOnChange|static async #save/);
  assert.match(tpl,/type="button" data-player-settings-save/);
  assert.doesNotMatch(tpl,/type="submit"/);
  assert.match(tpl,/data-hud-field="opacity"[^>]+step="0.01"/);
});

test("Player Settings saves enabled HUD changes, closes on success, and Save is wired", async () => {
  const restore=prepareEnvironment();
  try {
    const {BuxaPlayerSettings}=await import("../scripts/apps/player-settings.js");
    const a=actor();const dom=buildDom();
    const popup=new BuxaPlayerSettings({actor:a});
    popup.element=dom.element;
    popup._onRender({},{});
    assert.equal(typeof dom.handlers.get("save:click"),"function");
    assert.equal(typeof dom.handlers.get("cancel:click"),"function");
    assert.equal(await popup._saveSettings(),true);
    assert.equal(popup.closed,true);
    assert.equal(dom.save.disabled,false);
    assert.equal(a.writes.length,1);
    assert.equal(a.getFlag(MODULE_ID,"resourceHud").hp.enabled,true);
    assert.equal(a.getFlag(MODULE_ID,"resourceHud").hp.showMax,false);
    assert.equal(a.getFlag(MODULE_ID,"resourceHud").hp.opacity,.96);
    assert.equal(a.getFlag(MODULE_ID,"resourceHud").hp.valuePosition,"above");
  } finally {restore();}
});

test("Player Settings does not close after an Actor update fails and restores Save", async () => {
  const restore=prepareEnvironment();
  const priorConsole=console.error;
  try {
    const {BuxaPlayerSettings}=await import("../scripts/apps/player-settings.js");
    const a=actor();a.update=async()=>{throw new Error("simulated lost connection");};
    const dom=buildDom();const popup=new BuxaPlayerSettings({actor:a});popup.element=dom.element;
    console.error=()=>{};
    assert.equal(await popup._saveSettings(),false);
    assert.equal(popup.closed,false);
    assert.equal(popup._saving,false);
    assert.equal(dom.save.disabled,false);
  } finally {console.error=priorConsole;restore();}
});

test("SAO HUD displays no Actor name and respects opt-in resource labels", async () => {
  const {normalizeHudResource}=await import("../scripts/core/resource-hud.js");
  assert.equal(normalizeHudResource({},hp).showLabel,false);
  assert.equal(normalizeHudResource({showLabel:true},hp).showLabel,true);
  const canvas=source("scripts/integrations/token-resource-hud.js");
  assert.doesNotMatch(canvas,/actorName|Player Char/);
  assert.match(canvas,/if \(s\.showLabel\) label\(container, entry\.label/);
});
