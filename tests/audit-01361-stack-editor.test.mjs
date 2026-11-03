import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// The ApplicationV2 asset browser is a dependency of the editor. Supply
// only its class definitions, never fake a Foundry data write.
globalThis.foundry={applications:{api:{ApplicationV2:class {},HandlebarsApplicationMixin:Base=>Base},apps:{FilePicker:class{}}},utils:{getRoute:v=>v}};
globalThis.CONST={IMAGE_FILE_EXTENSIONS:{png:true}};
const {createStackCompositionSession}=await import('../scripts/apps/item-stack-editor.js');
const original=()=>({mode:'custom',layers:[{img:'coin.png',x:30,y:50,size:50,rotation:0,opacity:1}]});
test('stack editor draft changes and nested images are isolated until Apply',()=>{
 const rule=original(),session=createStackCompositionSession(rule);
 session.draft.layers[0].x=85;
 session.draft.layers.push({...session.draft.layers[0],img:'other.png'});
 assert.equal(rule.layers.length,1);
 assert.equal(rule.layers[0].x,30);
 assert.equal(session.apply(),true);
 assert.equal(rule.layers.length,2);
 assert.equal(rule.layers[0].x,85);
 session.draft.layers.push({img:'late.png'});
 assert.equal(session.apply(),false,'late duplicate Apply is ignored');
 assert.equal(rule.layers.length,2);
});
test('Cancel discards layer edits and prevents delayed Apply',()=>{
 const rule=original(),session=createStackCompositionSession(rule);
 session.draft.layers.length=0;
 session.cancel();
 assert.equal(session.active,false);
 assert.equal(session.apply(),false);
 assert.deepEqual(rule,original());
});
test('dialog wires close, backdrop, Cancel and Escape to discard; only Apply commits',()=>{
 const src=readFileSync(new URL('../scripts/apps/item-stack-editor.js',import.meta.url),'utf8');
 assert.match(src,/if\(e\.key==='Escape'\s*&&\s*overlay\.isConnected\).*close\(false\)/);
 assert.match(src,/\[data-stack-close\],\[data-stack-cancel\].*close\(false\)/);
 assert.match(src,/\[data-stack-done\].*close\(true\)/);
 assert.match(src,/cleanupDrag\(\);\s*doc\.removeEventListener\('keydown',onKey,true\)/);
 assert.match(src,/if\(overlay\.isConnected\)add\(src\)/);
});
