import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('GM Item lifecycle hooks do not reconcile mid-transaction or after a Buxa snapshot update',()=>{
 const src=readFileSync(new URL('../scripts/main.js',import.meta.url),'utf8');
 const on=(event,next)=>src.split(`Hooks.on("${event}"`)[1]?.split(`Hooks.on("${next}"`)[0];
 assert.match(on('createItem','updateItem'),/physicalTransfer/);
 assert.match(on('updateItem','deleteItem'),/physicalTransfer/);
 assert.match(on('updateItem','deleteItem'),/itemSnapshot/);
 assert.match(on('deleteItem','updateActor'),/physicalTransfer/);
});
