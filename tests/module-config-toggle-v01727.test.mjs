import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { enhanceConfigControls } from '../scripts/apps/layout-config-widgets.js';

const css = fs.readFileSync('styles/30-module-config-system.css', 'utf8');

function checkboxHarness() {
  const records = [];
  const doc = { createElement(tag) {
    const attrs = new Map();
    return { tag, className:'', setAttribute(key,val) {attrs.set(key,val);}, getAttribute(key){return attrs.get(key);} };
  } };
  const inputs = Array.from({ length: 4 }, (_, index) => {
    const parent = {};
    const input = {
      type: 'checkbox',
      checked: index < 2,
      dataset: {},
      parentNode: parent,
      insertAdjacentElement(where, node) {
        assert.equal(where, 'afterend');
        records.push({ input, node });
      }
    };
    return input;
  });
  const root = {
    ownerDocument: doc,
    querySelectorAll(selector) {
      if (selector.includes('input[type="checkbox"]:not([data-bc-toggle])'))
        return inputs.filter(input => !input.dataset.bcToggle);
      return [];
    }
  };
  return { root, inputs, records };
}

test('v0.17.27 switches are separate presentation siblings, not decorated native checkboxes', () => {
  assert.match(css, /input\[type="checkbox"\][\s\S]*?opacity:0; pointer-events:none/);
  assert.match(css, /input\[type="checkbox"\]:checked \+ \.bc-toggle-track/);
  assert.doesNotMatch(css, /input\[type="checkbox"\]::(?:before|after)/);
  const {root,inputs,records} = checkboxHarness();
  enhanceConfigControls(root);
  assert.equal(records.length, inputs.length);
  for (const {input,node} of records) {
    assert.equal(node.className, 'bc-toggle-track');
    assert.equal(node.getAttribute('aria-hidden'), 'true');
    assert.equal(input.dataset.bcToggle, 'true');
  }
  assert.equal(inputs[0].checked,true, 'original checked state is unchanged');
  assert.equal(inputs[3].checked,false);
  enhanceConfigControls(root);
  assert.equal(records.length,inputs.length,'rerender must not add a second switch');
});

test('v0.17.27 newly added dynamic config checkboxes receive just one switch', () => {
  const {root,inputs,records} = checkboxHarness();
  enhanceConfigControls(root);
  const newInput = { type:'checkbox', checked:true, dataset:{}, parentNode:{},
    insertAdjacentElement(where, node) { records.push({input:newInput,node}); } };
  const original = root.querySelectorAll;
  root.querySelectorAll = selector => selector.includes('input[type="checkbox"]:not([data-bc-toggle])')
    ? [...inputs,newInput].filter(input => !input.dataset.bcToggle) : original.call(root,selector);
  enhanceConfigControls(root);
  assert.equal(records.length,inputs.length+1);
  assert.equal(records.at(-1).node.className,'bc-toggle-track');
  assert.equal(newInput.checked,true);
  enhanceConfigControls(root);
  assert.equal(records.length,inputs.length+1);
});
