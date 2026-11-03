import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeStackImages,stackArtworkFor,stackArtworkMarkup} from '../scripts/core/item-stack-artwork.js';
import {normalizeItemRules} from '../scripts/core/item-config.js';
const coin='icons/coin.png';
const data=(quantity,rules)=>({img:coin,system:{quantity},flags:{buxaframework:{item:{multiple:{enabled:true,maxStack:20,stackImages:rules}}}}});
test('Stack thresholds honor quantity boundaries and select highest matching rule',()=>{
  const rules=[{at:4,mode:'image',img:'four.webp'},{at:2,mode:'image',img:'two.webp'}];
  assert.equal(stackArtworkFor(data(1,rules),1).img,coin);
  assert.equal(stackArtworkFor(data(2,rules),2).img,'two.webp');
  assert.equal(stackArtworkFor(data(3,rules),3).img,'two.webp');
  assert.equal(stackArtworkFor(data(4,rules),4).img,'four.webp');
  assert.equal(stackArtworkFor(data(10,rules),10).img,'four.webp');
});
test('Disabled stackability keeps the default image, even if old thresholds exist',()=>{
 const item=data(3,[{at:2,mode:'image',img:'many.webp'}]);item.flags.buxaframework.item.multiple.enabled=false;
 assert.equal(stackArtworkFor(item,3).img,coin);
});
test('Composites allow repeated image layers with independent position, rotation and size',()=>{
 const rules=[{at:2,mode:'custom',layers:[{img:coin,x:30,y:60,size:42,rotation:-25,opacity:1},{img:coin,x:68,y:40,size:58,rotation:30,opacity:.65}]}];
 const art=stackArtworkFor(data(2,rules),2);
 assert.equal(art.custom,true);assert.equal(art.layers.length,2);
 assert.ok(art.layers[0].style.includes('left:30%'));
 assert.ok(art.layers[1].style.includes('rotate(30deg)'));
 assert.match(stackArtworkMarkup(art,s=>s),/buxa-stack-composite/);
});
test('Normalization sorts, deduplicates and sanitizes stack artwork without mutating the source',()=>{
 const input=[{at:5,mode:'image',img:'five.png'},{at:2,mode:'custom',layers:[{img:'coin.png',x:900,y:-900,size:1000,opacity:-2}]},{at:5,mode:'image',img:'newfive.png'}];
 const out=normalizeStackImages(input);
 assert.deepEqual(out.map(r=>r.at),[2,5]);assert.equal(out[1].img,'newfive.png');
 assert.equal(out[0].layers[0].size,250);assert.equal(out[0].layers[0].opacity,.05);
 assert.equal(input[1].layers[0].size,1000);
});
test('Old Item rules normalize to empty stack artwork and retain existing stacking',()=>{
 const old=normalizeItemRules({multiple:{enabled:true,maxStack:10}});
 assert.equal(old.multiple.enabled,true);assert.equal(old.multiple.maxStack,10);
 assert.deepEqual(old.multiple.stackImages,[]);
});
test('Image and composition paths are encoded safely in ground HTML',()=>{
 const art=stackArtworkFor(data(2,[{at:2,mode:'custom',layers:[{img:'icons/a" onerror="alert(1).png'}]}]),2);
 const enc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const markup=stackArtworkMarkup(art,enc);
 assert.ok(markup.includes('&quot;'));assert.ok(!markup.includes('src="icons/a"'));
});
test('Stacking tab is separate from Basic, runtime templates support composed artwork',()=>{
 const form=readFileSync(new URL('../templates/item-config.hbs',import.meta.url),'utf8');
 const panel=form.indexOf('data-item-config-panel="stack"'),basic=form.indexOf('data-item-config-panel="basic"'),inc=form.indexOf('data-item-config-panel="increase"');
 assert.ok(basic<panel&&panel<inc);
 const sheet=readFileSync(new URL('../templates/player-sheet.hbs',import.meta.url),'utf8');
 assert.ok(sheet.includes('item.stackLayers'));assert.ok(sheet.includes('{{#if stackLayers}}'));
});
