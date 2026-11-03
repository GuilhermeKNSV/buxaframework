import test from 'node:test';
import assert from 'node:assert/strict';
import {groundKeyboardNextCell} from '../scripts/apps/ground-container-window.js';
test('keyboard navigation skips mask holes and never wraps across rows',()=>{
 const bag={columns:3,rows:3,mode:'complex',cells:[0,1,2,3,5,6,7,8]};
 assert.equal(groundKeyboardNextCell(bag,3,'ArrowRight'),5);
 assert.equal(groundKeyboardNextCell(bag,5,'ArrowLeft'),3);
 assert.equal(groundKeyboardNextCell(bag,1,'ArrowDown'),7);
 assert.equal(groundKeyboardNextCell(bag,2,'ArrowRight'),null);
 assert.equal(groundKeyboardNextCell(bag,0,'ArrowLeft'),null);
 assert.equal(groundKeyboardNextCell(bag,7,'Escape'),null);
});
