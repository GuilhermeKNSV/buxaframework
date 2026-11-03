/** Minimal DOM harness for Buxa's SVG scene overlay, independent of PIXI. */
export class FakeNode {
  constructor(tag = 'div') {
    this.tag = tag;
    this.children = [];
    this.parentNode = null;
    this.isConnected = false;
    this.styleData = {};
    this.style = {
      setProperty: (key, val) => { this.styleData[key] = String(val); },
      getPropertyValue: key => this.styleData[key],
      left: '', top: ''
    };
    this.dataset = {};
    this.classes = new Set();
    this.classList = {
      add: value => this.classes.add(value),
      remove: value => this.classes.delete(value),
      toggle: (value, checked) => { if (checked) this.classes.add(value); else this.classes.delete(value); }
    };
    this.queryMap = new Map();
    this.textContent = '';
  }
  setAttribute(key, value) { this[key] = value; }
  set innerHTML(html) { this.html = html; }
  querySelector(selector) {
    if (!this.queryMap.has(selector)) this.queryMap.set(selector, new FakeNode('span'));
    return this.queryMap.get(selector);
  }
  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
    child.isConnected = this.isConnected;
    return child;
  }
  remove() {
    if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this);
    this.isConnected = false;
  }
}

export function fakeSceneFxDocument() {
  const body = new FakeNode('body');
  body.isConnected = true;
  return { body, createElement: (tag) => new FakeNode(tag) };
}

export function fakeSceneFxCanvas(tokens = []) {
  const view = { width: 800, height: 600, getBoundingClientRect: () => ({left: 5, top: 9, width: 800, height: 600}) };
  return {
    ready: true, scene: { id: 'scene' }, tokens: { placeables: tokens },
    stage: { toGlobal: point => ({x: point.x, y: point.y}), scale: {x:1} },
    app: { renderer: {canvas: view, screen: {width:800, height:600}} },
    interface: { createScrollingText: () => Promise.resolve() }
  };
}
