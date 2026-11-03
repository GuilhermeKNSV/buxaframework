import test from 'node:test';
import assert from 'node:assert/strict';
import {sectorPath,previewState,syncRangePair,updateTokenPreview} from '../scripts/apps/document-editor-preview.js';
import {editorView,buildDocumentPatch} from '../scripts/apps/document-editor-fields.js';
import fs from 'node:fs';
const actor={id:'a',name:'Seer',img:'images/portrait.png',prototypeToken:{name:'Seer',texture:{src:'images/token.png',scaleX:1,scaleY:1},width:1,height:2,alpha:1,rotation:0,sight:{enabled:false,range:20,angle:360},light:{dim:30,bright:15,angle:180,alpha:0.5}}};
test('preview state is derived without mutating Actor prototype',()=>{
 const initial=JSON.stringify(actor);
 const state=previewState(actor,{'prototypeToken.width':'3','prototypeToken.alpha':'0.65','prototypeToken.sight.enabled':true,'prototypeToken.sight.range':'30'});
 assert.equal(state.width,3);assert.equal(state.opacity,0.65);assert.equal(state.sightEnabled,true);assert.equal(state.sightRange,30);
 assert.equal(state.image,'images/token.png');assert.equal(JSON.stringify(actor),initial);
});
test('geometry supports full circles, narrow cones and disabled radii',()=>{
 assert.match(sectorPath(80,360),/ A /);assert.equal((sectorPath(80,360).match(/ A /g)||[]).length,2);
 assert.match(sectorPath(50,90,45),/ L /);assert.match(sectorPath(50,90,45),/ A /);
 assert.equal(sectorPath(0,360),'');assert.equal(sectorPath(30,0),'');
 for(const n of [0,45,90,180,270,360])assert.ok(!sectorPath(100,n).includes('NaN'));
});
test('every major numeric preview field has a slider and exact number',()=>{
 const ui=editorView('Actor',actor,{canvasConfig:{}});
 const map=new Map(ui.flatMap(s=>s.fields.map(f=>[f.key,f])));
 for(const key of ['prototypeToken.width','prototypeToken.height','prototypeToken.alpha','prototypeToken.rotation','prototypeToken.sight.range','prototypeToken.sight.angle','prototypeToken.light.dim','prototypeToken.light.bright','prototypeToken.light.angle','prototypeToken.texture.scaleX'])assert.equal(map.get(key).hasSlider,true,key);
 assert.equal(map.get('prototypeToken.texture.src').isArtwork,true);
});
test('slider and numeric input stay in sync, larger exact values extend slider',()=>{
 const style={setProperty(){}},range={value:'2',min:'0',max:'10',style},number={value:'2'};
 const field={querySelector(query){return query==='[data-buxa-range]'?range:number;}};
 range.value='6';syncRangePair(field,range);assert.equal(number.value,'6');
 number.value='250';syncRangePair(field,number);assert.equal(range.max,'250');assert.equal(range.value,'250');
 number.value='2.5';syncRangePair(field,number);assert.equal(range.value,'2.5');
});
test('disabled batch token fields are ignored by preview and by update payload',()=>{
 const doc={...actor,prototypeToken:{...actor.prototypeToken,sight:{...actor.prototypeToken.sight}}};
 const patch=buildDocumentPatch(doc,'Actor',{'prototypeToken.width':'4','prototypeToken.sight.range':'30'},new Set(['prototypeToken.sight.range']));
 assert.deepEqual(patch,{'prototypeToken.sight.range':30});
});
test('preview gracefully handles missing DOM and invalid token data',()=>{
 assert.doesNotThrow(()=>updateTokenPreview(null,actor));
 assert.doesNotThrow(()=>updateTokenPreview({querySelector:()=>null},actor));
 const state=previewState({prototypeToken:{}},{'prototypeToken.width':-999,'prototypeToken.height':'NaN','prototypeToken.alpha':50});
 assert.equal(state.width,0.5);assert.equal(state.height,0.5);assert.equal(state.opacity,1);
});
test('new UI has preview and opt-in batch controls with responsive reduced-motion styles',()=>{
 const html=fs.readFileSync(new URL('../templates/document-editor.hbs',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../styles/129-token-editor-preview.css',import.meta.url),'utf8');
 const app=fs.readFileSync(new URL('../scripts/apps/document-editor.js',import.meta.url),'utf8');
 assert.match(html,/data-buxa-preview-token/);assert.match(html,/data-buxa-preview-sight/);assert.match(html,/data-buxa-preview-bright/);assert.match(html,/data-buxa-range/);assert.match(html,/data-buxa-apply/);
 assert.match(css,/@media\(max-width:640px\)/);assert.match(css,/prefers-reduced-motion/);
 assert.match(app,/updateTokenPreview/);assert.match(app,/BuxaAssetBrowser/);
});
