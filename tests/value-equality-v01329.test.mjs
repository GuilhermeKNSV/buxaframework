import test from 'node:test';import assert from 'node:assert/strict';
import {sameStoredValue} from '../scripts/core/value-equality.js';
test('verified storage compares deep values without JSON serialization or key-order dependency',()=>{
 const a={a:[{x:1,y:{c:'yes'}},null],b:0};
 const b={b:0,a:[{y:{c:'yes'},x:1},null]};
 assert.ok(sameStoredValue(a,b));
 assert.equal(sameStoredValue(a,{b:0,a:[{y:{c:'no'},x:1},null]}),false);
 assert.equal(sameStoredValue(a,{a:[{x:1,y:{c:'yes'}},null]}),false);
 assert.equal(sameStoredValue([1,2],[1,2,3]),false);
});
