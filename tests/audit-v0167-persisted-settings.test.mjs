import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeInventoryConfig } from '../scripts/core/inventory-config.js';
import { savedNumber, savedInteger } from '../scripts/core/stored-values.js';

const invalid = Array.from({length:18}, (_,i)=>i+2).flatMap(n=>[
  {label:`numeric array ${n}`, value:[n]},
  {label:`boxed object ${n}`, value:{valueOf(){return n;}}}
]);
for (const {label,value} of invalid) {
  test(`simple inventory slots reject ${label}`,()=>assert.equal(normalizeInventoryConfig({slots:value}).slots,50));
  test(`complex inventory columns reject ${label}`,()=>assert.equal(normalizeInventoryConfig({complex:{columns:value}}).complex.columns,10));
  test(`complex inventory rows reject ${label}`,()=>assert.equal(normalizeInventoryConfig({complex:{rows:value}}).complex.rows,5));
  test(`inventory weight limit rejects ${label}`,()=>assert.equal(normalizeInventoryConfig({weight:{capacity:value}}).weight.capacity,100));
  test(`equipment layout columns reject ${label}`,()=>assert.equal(normalizeInventoryConfig({equipmentLayout:{columns:value}}).equipmentLayout.columns,12));
  test(`equipment layout rows reject ${label}`,()=>assert.equal(normalizeInventoryConfig({equipmentLayout:{rows:value}}).equipmentLayout.rows,7));
  test(`persisted Actor number rejects ${label}`,()=>assert.equal(savedNumber(value,99),99));
  test(`persisted Actor integer rejects ${label}`,()=>assert.equal(savedInteger(value,99),99));
}
for (const value of ['', '  ',false,true]) {
 test(`blank/boolean simple inventory slots use defaults: ${JSON.stringify(value)}`,()=>assert.equal(normalizeInventoryConfig({slots:value}).slots,50));
 test(`blank/boolean complex grid uses defaults: ${JSON.stringify(value)}`,()=>assert.deepEqual(normalizeInventoryConfig({complex:{rows:value,columns:value}}).complex,{columns:10,rows:5,autoSort:false}));
}
test('invalid Symbol persisted values do not throw',()=>{
 assert.equal(savedNumber(Symbol('invalid'),99),99);
 assert.equal(normalizeInventoryConfig({slots:Symbol('invalid')}).slots,50);
});
