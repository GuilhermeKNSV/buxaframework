import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ITEM_CONFIG_GROUPS, mountItemConfigNavigation } from '../scripts/apps/item-config-navigation.js';

class Element {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.parentNode = null;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.hidden = false;
    this.scrollTop = 0;
    this.textContent = '';
    this.classNames = new Set();
    this.classList = {
      add: (...names) => names.forEach(name => this.classNames.add(name)),
      contains: name => this.classNames.has(name),
      toggle: (name, enabled) => { if (enabled) this.classNames.add(name); else this.classNames.delete(name); }
    };
    this.listeners = new Map();
  }
  set className(value) { this.classNames = new Set(String(value).split(/\s+/).filter(Boolean)); }
  get className() { return [...this.classNames].join(' '); }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  append(...nodes) { for (const node of nodes) { node.remove(); this.children.push(node); node.parentNode = this; } }
  appendChild(node) { this.append(node); return node; }
  prepend(...nodes) { for (let i = nodes.length - 1; i >= 0; i--) { const node = nodes[i]; node.remove(); this.children.unshift(node); node.parentNode = this; } }
  remove() { if (!this.parentNode) return; this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; }
  replaceChildren(...nodes) { for (const child of this.children) child.parentNode = null; this.children = []; this.append(...nodes); }
  after(...nodes) { const parent = this.parentNode; if (!parent) return; const index = parent.children.indexOf(this); nodes.forEach((node, i) => { node.remove(); parent.children.splice(index + i + 1, 0, node); node.parentNode = parent; }); }
  matches(selector) {
    if (selector.startsWith('.')) return this.classNames.has(selector.slice(1));
    if (selector === '[data-item-config-panel]') return Object.hasOwn(this.dataset, 'itemConfigPanel');
    const attr = /^([a-z]+)?\[data-([a-z0-9-]+)\]$/.exec(selector);
    if (attr) {
      const key = attr[2].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      return (!attr[1] || this.tagName.toLowerCase() === attr[1]) && Object.hasOwn(this.dataset, key);
    }
    return false;
  }
  querySelectorAll(selector) {
    const result = [];
    const walk = node => { for (const child of node.children) { if (child.matches(selector)) result.push(child); walk(child); } };
    walk(this);
    return result;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  addEventListener(type, cb) { this.listeners.set(type, cb); }
  click() { this.listeners.get('click')?.({ preventDefault() {} }); }
}

function fixture() {
  const doc = { createElement: tag => new Element(tag) };
  const root = new Element(); root.ownerDocument = doc;
  const scroll = new Element(); scroll.className = 'buxa-item-config-scroll'; root.append(scroll);
  const oldNav = new Element('nav'); oldNav.className = 'buxa-item-config-tabs'; scroll.append(oldNav);
  const panels = {};
  for (const key of ['info','basic','stack','increase','dice','resource','limits','image','size','control']) {
    const panel = new Element(); panel.dataset.itemConfigPanel = key;
    panel.hidden = key !== 'info';
    scroll.append(panel); panels[key] = panel;
  }
  const section = (panel, klass, tag = 'section', field = {}) => {
    const element = new Element(tag); element.className = klass; Object.assign(element.dataset, field);
    panels[panel].append(element); return element;
  };
  const imagePath = section('info','buxa-item-image-path', 'label');
  const input = new Element('input'); input.value = 'icons/old-item.png'; imagePath.append(input);
  const description = section('info','buxa-description-builder');
  const ground = section('basic','buxa-ground-loot-policy');
  const properties = section('basic','buxa-item-config-pair');
  const equipment = section('basic','buxa-item-equip-config');
  const storage = section('basic','buxa-storage-config');
  const storageTemplate = section('basic','', 'template', { storageExternalTemplate: '' });
  const stackConfig = section('stack','buxa-item-stack-config');
  const stackArt = section('stack','buxa-stack-image-section');
  const decorationHead = section('dice','buxa-item-decoration-head');
  const decorationList = section('dice','', 'div', { itemDecorationList: '' });
  return { root, scroll, panels, oldNav, imagePath, input, description, ground, properties, equipment,
    storage, storageTemplate, stackConfig, stackArt, decorationHead, decorationList };
}

test('item config groups every panel exactly once under four intuitive categories', () => {
  assert.deepEqual(ITEM_CONFIG_GROUPS.map(group => group.label), ['Overview','Function','Visuals','Access']);
  const tabs = ITEM_CONFIG_GROUPS.flatMap(group => group.tabs.map(([id]) => id));
  assert.equal(new Set(tabs).size, tabs.length);
  for (const id of ['info','description','details','dice','resource','increase','limits','stack',
    'equipment','storage','image','equipSize','size','stackArt','decorations','control','ground']) {
    assert.ok(tabs.includes(id), `${id} needs an accessible sub-tab`);
  }
});

test('moving existing editors does not duplicate or replace any field, template or input value', () => {
  const f = fixture();
  const selections = [];
  const ui = mountItemConfigNavigation(f.root, {activeTab:'storage',onSelect:(tab, group) => selections.push([tab,group])});
  assert.ok(ui);
  const panel = id => f.root.querySelectorAll('[data-item-config-panel]').find(el => el.dataset.itemConfigPanel === id);
  assert.equal(f.storage.parentNode, panel('storage'));
  assert.equal(f.storageTemplate.parentNode, panel('storage'));
  assert.equal(f.equipment.parentNode, panel('equipment'));
  assert.equal(f.properties.parentNode, panel('details'));
  assert.equal(f.description.parentNode, panel('description'));
  assert.equal(f.ground.parentNode, panel('ground'));
  assert.equal(f.stackArt.parentNode, panel('stackArt'));
  assert.equal(f.stackConfig.parentNode, panel('stack'));
  assert.equal(f.decorationHead.parentNode, panel('decorations'));
  assert.equal(f.decorationList.parentNode, panel('decorations'));
  assert.equal(f.imagePath.parentNode.parentNode.parentNode, panel('image'));
  assert.equal(f.input.value, 'icons/old-item.png');
  assert.equal(panel('storage').hidden, false);
  assert.equal(f.root.querySelectorAll('[data-item-config-panel]').length, 17);
  assert.deepEqual(selections.at(-1), ['storage','function']);
  ui.activate('image', {resetScroll:true});
  assert.equal(panel('image').hidden, false);
  assert.equal(panel('storage').hidden, true);
  assert.equal(f.input.value, 'icons/old-item.png');
  f.input.value = 'icons/new-item.png';
  ui.activate('description'); ui.activate('image');
  assert.equal(f.input.value, 'icons/new-item.png', 'unsaved input must not be reset by navigation');
  assert.equal(f.root.querySelectorAll('[data-item-config-panel]').filter(p => !p.hidden).length, 1);
  ui.activate('basic');
  assert.equal(ui.activeTab, 'details', 'legacy Basic tab should open Properties');
  assert.equal(f.oldNav.querySelectorAll('[data-item-config-panel]').length, 0);
  const groups = f.root.querySelectorAll('.buxa-item-config-group-nav')[0];
  assert.equal(groups.children.length, 4);
});

test('clicking categories and sub-tabs updates ARIA state, scroll and editor visibility', () => {
  const f = fixture();
  mountItemConfigNavigation(f.root);
  const main = f.root.querySelector('.buxa-item-config-group-nav');
  const second = f.root.querySelector('.buxa-item-config-subtabs');
  const group = id => main.children.find(button => button.dataset.itemGroupTab === id);
  const sub = id => second.children.find(button => button.dataset.itemConfigTab === id);
  f.scroll.scrollTop = 170;
  group('visuals').click();
  assert.equal(f.scroll.scrollTop, 0);
  assert.equal(group('visuals').attributes['aria-selected'], 'true');
  assert.equal(sub('image').attributes['aria-selected'], 'true');
  assert.equal(sub('stackArt').hidden, false);
  assert.equal(sub('storage').hidden, true);
  sub('stackArt').click();
  assert.equal(sub('stackArt').attributes['aria-selected'], 'true');
  assert.equal(f.stackArt.parentNode.hidden, false);
  assert.equal(f.stackConfig.parentNode.hidden, true);
  group('function').click();
  sub('storage').click();
  assert.equal(f.storage.parentNode.hidden, false);
});

test('navigation is mounted after dynamic use tabs and retains all existing save selectors', () => {
  const code = readFileSync(new URL('../scripts/apps/item-config.js', import.meta.url), 'utf8');
  const use = readFileSync(new URL('../scripts/apps/item-use-editor.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../templates/item-config.hbs', import.meta.url), 'utf8');
  assert.ok(code.indexOf('mountItemUseEditor(root') < code.indexOf('mountItemConfigNavigation(root'));
  assert.match(use, /body\.dataset\.itemConfigPanel\s*=\s*name/);
  assert.match(use, /section\(doc,'resource'/);
  assert.match(use, /section\(doc,'limits'/);
  for (const field of ['data-item-shape-grid','data-storage-item-mode','data-item-dice-list',
    'data-item-increase-list','data-stack-images-list','data-item-description-list']) {
    assert.ok(html.includes(field), `${field} must still use its previous implementation`);
  }
  assert.match(code, /readItemUseEditor\(root\)/);
  assert.match(code, /readItemStorageEditor\(root\)/);
});
