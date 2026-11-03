import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileFolderPanelDOM } from '../scripts/apps/folder-panel-dom.js';

class FakeNode {
  constructor(id, text = '') {
    this.dataset = {buxaFolderPanel:id};
    this.textContent = text;
    this.classList = {add:()=>{}};
    this.entry = {scrollTop:0};
    this.parent = null;
  }
  querySelector(selector) {return selector==='.buxa-folder-entries'?this.entry:null;}
  replaceWith(node) {
    const array=this.parent.children;
    const at=array.indexOf(this);
    array.splice(at,1,node);
    node.parent=this.parent;
    this.parent=null;
  }
  remove() {
    const list=this.parent.children;
    list.splice(list.indexOf(this),1);
    this.parent=null;
  }
}
class FakeContainer {
  constructor() {
    this.children=[];
    this.ownerDocument={createElement(type) {
      assert.equal(type,'template');
      return {
        set innerHTML(html) {
          const id=html.match(/data-buxa-folder-panel="([^"]+)"/)?.[1];
          this.content={firstElementChild:id?new FakeNode(id,html):null};
        }
      };
    }};
  }
  get lastElementChild() {return this.children.at(-1);}
  insertBefore(node, sibling) {
    if(node.parent) node.parent.children.splice(node.parent.children.indexOf(node),1);
    const pos=sibling?this.children.indexOf(sibling):-1;
    this.children.splice(pos<0?this.children.length:pos,0,node);
    node.parent=this;
  }
}
const panel=(id,text)=>({id,markup:`<section data-buxa-folder-panel="${id}"><div class="buxa-folder-entries">${text}</div></section>`});

test('identical folder updates retain DOM nodes and scroll position', () => {
  const container=new FakeContainer();
  assert.equal(reconcileFolderPanelDOM(container,[panel('a','one'),panel('b','two')]),true);
  const [a,b]=container.children;
  a.entry.scrollTop=31;
  assert.equal(reconcileFolderPanelDOM(container,[panel('a','one'),panel('b','two')]),false);
  assert.strictEqual(container.children[0],a);
  assert.strictEqual(container.children[1],b);
  assert.equal(a.entry.scrollTop,31);
});

test('updating one folder leaves unrelated folders mounted, and only replaces changed panel',()=>{
  const container=new FakeContainer();
  reconcileFolderPanelDOM(container,[panel('a','one'),panel('b','two')]);
  const a=container.children[0],oldB=container.children[1];oldB.entry.scrollTop=65;
  reconcileFolderPanelDOM(container,[panel('a','one'),panel('b','updated')]);
  assert.strictEqual(container.children[0],a);
  assert.notStrictEqual(container.children[1],oldB);
  assert.equal(container.children[1].entry.scrollTop,65);
});

test('changed and reordered panels preserve the correct folder IDs',()=>{
  const container=new FakeContainer();
  reconcileFolderPanelDOM(container,[panel('a','one'),panel('b','two'),panel('c','three')]);
  reconcileFolderPanelDOM(container,[panel('c','three'),panel('b','new')]);
  assert.deepEqual(container.children.map(n=>n.dataset.buxaFolderPanel),['c','b']);
  assert.match(container.children[1].textContent,/new/);
});
