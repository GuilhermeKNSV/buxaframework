import { syncSidebarFolderState, sidebarWorldRestricts, annotateSidebarDrag } from './sidebar-edit-feedback.js';
import { BuxaAssetBrowser } from './asset-browser.js';
import { locateSidebarNavigation, tabId, isCollapse } from './sidebar-edit-navigation.js';
import { installSidebarNativeLock } from './sidebar-edit-interaction-lock.js';
import { installSidebarDockMethods } from './sidebar-edit-dock.js';
import { updateSidebarDragTarget } from './sidebar-edit-drag.js';
import { positionSidebarFolderFlyout } from './sidebar-folder-flyout-position.js';
import { installSidebarUiFollower } from './sidebar-ui-follow.js';
import { activateSidebarFolderTab } from './sidebar-folder-navigation.js';
import { startSidebarFolderSlots, removeSidebarFolderSlots } from './sidebar-folder-drop.js';
import { MODULE_ID } from '../core/constants.js';
import {
  SIDEBAR_LAYOUT_KEY, SIDEBAR_WORLD_KEY, SIDEBAR_DEFAULT_TABS,
  defaultSidebarLayout, normalizeSidebarLayout, normalizeSidebarWorld,
  isSidebarButtonHidden, moveSidebarButton, setSidebarButtonVisibility,
  addSidebarFolder, removeSidebarFolder
} from '../core/sidebar-button-layout.js';
const FA = {chat:'fa-solid fa-comments',combat:'fa-solid fa-swords',scenes:'fa-solid fa-map',actors:'fa-solid fa-user-group',
  items:'fa-solid fa-suitcase',journal:'fa-solid fa-book-open',tables:'fa-solid fa-list',cards:'fa-solid fa-cards',
  macros:'fa-solid fa-code',playlists:'fa-solid fa-music',compendium:'fa-solid fa-book',settings:'fa-solid fa-gears',collapse:'fa-solid fa-caret-left'};
const LABELS = {chat:'Chat',combat:'Combat',scenes:'Scenes',actors:'Actors',items:'Items',journal:'Journal',
  tables:'Tables',cards:'Cards',macros:'Macros',playlists:'Playlists',compendium:'Compendiums',settings:'Settings',collapse:'Collapse'};
const make = (tag, css = '', label = '') => {
  const node = document.createElement(tag);
  if (css) node.className = css;
  if (label) node.textContent = label;
  return node;
};
function iconNode(icon = {type:'fa',value:'fa-solid fa-folder'}) {
  if (icon?.type === 'image') {
    const img = make('img', 'buxa-sb-icon-img');
    img.src = icon.value;
    img.alt = '';
    img.draggable = false;
    return img;
  }
  const i = make('i', icon?.value || 'fa-solid fa-folder');
  i.setAttribute('aria-hidden', 'true');
  return i;
}
function removeWithMotion(node) {
  if(!node)return;
  if(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches){node.remove();return;}
  node.classList.add('is-leaving');
  globalThis.setTimeout(()=>node.remove(),180);
}
function notice(message, type = 'info') {
  const fn = globalThis.ui?.notifications?.[type] || globalThis.ui?.notifications?.info;
  fn?.call(globalThis.ui?.notifications, message);
}
function navigator() { return locateSidebarNavigation(); }
function nativeId(node) { return tabId(node); }
function nearestId(node) { return node?.closest?.('[data-buxa-button-id]')?.dataset?.buxaButtonId || null; }
const randomFolder = () => `folder-${globalThis.foundry?.utils?.randomID?.(12) ?? Math.random().toString(36).slice(2,14)}`;
let instance;
let requested = false;
function queueMount() {
  if (requested) return;
  requested = true;
  const run = () => { requested = false; instance?.mount(); };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
  else globalThis.setTimeout(run, 0);
}
export function registerSidebarButtonSettings() {
  game.settings.register(MODULE_ID, SIDEBAR_WORLD_KEY, {
    scope:'world', config:false, type:Object,
    default: {layout:defaultSidebarLayout(),visibility:{allPlayers:[],users:{}}},
    onChange: () => instance?.onWorldChange()
  });
}
export function installSidebarButtonEditor() {
  if (instance) return instance;
  instance = new SidebarButtonEditor();
  Hooks.on('renderSidebar', queueMount);
  Hooks.on('renderSidebarTab', queueMount);
  Hooks.on('collapseSidebar', queueMount);
  Hooks.on('expandSidebar', queueMount);
  // Reflow the opposite-edge dock when Foundry opens/closes windows or
  // canvas controls. The editor never moves the native Foundry UI.
  let repositionQueued = false;
  const queueDockReposition = () => {
    if ((!instance?.edit && !instance?.flyout) || repositionQueued) return;
    repositionQueued = true;
    const run = () => { repositionQueued=false; instance?.repositionFloating(); };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
    else globalThis.setTimeout(run, 0);
  };
  for (const hook of ['renderSidebarTab','changeSidebarTab','collapseSidebar','expandSidebar',
    'renderApplicationV2','closeApplicationV2','renderApplication',
    'closeApplication','renderSceneControls','renderHotbar']) Hooks.on(hook, queueDockReposition);
  installSidebarUiFollower({Hooks,documentRef:document,getEditor:()=>instance,queueReposition:queueDockReposition});
  queueMount();
  // V14 can replace its "tabs" Handlebars part without re-rendering the entire
  // Sidebar app. Listen to the DOM as a backstop; don't remount for edits Buxa
  // itself makes while its button is already attached.
  if (typeof MutationObserver !== 'undefined' && document?.body) {
    const observer = new MutationObserver(records => {
      if (instance?.nav?.isConnected && instance?.editButton?.isConnected) {
        // A partial rerender may replace the tab buttons but leave our
        // launcher untouched. Reconcile only if native entries changed.
        if (records.some(record => record.target === instance.nav ||
            instance.nav.contains(record.target))) {
          const found = locateSidebarNavigation();
          if (found?.tabs.some(node => instance.tabs.get(tabId(node)) !== node)) queueMount();
        }
        return;
      }
      const sidebar = document.querySelector('#sidebar');
      if (!sidebar) return;
      if (records.some(record => sidebar.contains(record.target) ||
          [...record.addedNodes, ...record.removedNodes].some(node =>
            node.nodeType === 1 && (node.id === 'sidebar' || node.querySelector?.('#sidebar'))))) queueMount();
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }
  globalThis.setTimeout?.(queueMount, 650);
  globalThis.setTimeout?.(queueMount, 1800);
  return instance;
}
export class SidebarButtonEditor {
  constructor() {
    this.nav = null;
    this.tabs = new Map();
    this.abort = null;
    this.edit = false;
    this.draft = null;
    this.draftWorld = null;
    this.personal = null;
    this.toolbar = null;
    this.dockMenu = null;
    this.dockCollapsed = false;
    this.drawer = null;
    this.flyout = null;
    this.menu = null;
    this.dialog = null;
    this.editButton = null;
    this.collapseControl = null;
    this.openFolder = null;
    this.drag = null;
    this.dragTimer = null;
    this.saving = false;
    this.worldDirty = false;
    this.lastDragged = null;
    this.windowAbort = new AbortController();
    document.addEventListener('pointermove', e => this.onMove(e), {signal:this.windowAbort.signal});
    document.addEventListener('pointerup', e => this.onUp(e), {signal:this.windowAbort.signal});
    document.addEventListener('pointercancel', () => this.cancelDrag(), {signal:this.windowAbort.signal});
    installSidebarNativeLock(this, this.windowAbort.signal);
    document.addEventListener('pointerdown', e => {
      if (this.menu && !e.target.closest('.buxa-sb-context')) this.closeMenu();
      if (this.dockMenu && !e.target.closest('.buxa-sb-save-menu') && !e.target.closest('.buxa-sb-save-group')) this.closeDockMenu();
      if (this.dialog && !this.dialog.contains(e.target) && !e.target.closest('.buxa-sb-context')) this.closeDialog();
    }, {signal:this.windowAbort.signal});
    document.addEventListener('scroll', () => { this.closeMenu(); this.closeDockMenu(); }, {capture:true,passive:true,signal:this.windowAbort.signal});
    window.addEventListener('resize', () => this.repositionFloating(), {passive:true,signal:this.windowAbort.signal});
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { this.cancelDrag(); this.closeMenu(); this.closeDockMenu(); this.closeFlyout(); this.closeDialog(); }
    }, {signal:this.windowAbort.signal});
  }
  allIds() { return [...this.tabs.keys()]; }
  getWorld() { return normalizeSidebarWorld(game.settings.get(MODULE_ID, SIDEBAR_WORLD_KEY), this.allIds()); }
  getPersonal() { return game.user?.getFlag?.(MODULE_ID, SIDEBAR_LAYOUT_KEY) ?? null; }
  active() { return normalizeSidebarLayout(this.getPersonal() || this.getWorld().layout, this.allIds()); }
  isVisible(id, layout, world) { return !isSidebarButtonHidden(id, game.user, layout, world); }
  mount() {
    const found = navigator();
    if (!found) return;
    if (this.nav !== found.nav) {
      this.abort?.abort();
      this.nav = found.nav;
      this.abort = new AbortController();
      this.tabs = new Map();
      this.editButton?.remove();
      this.editButton = null;
      this.collapseControl = [...this.nav.children].find(isCollapse) || null;
      this.nav.addEventListener('click', e => this.onNavClick(e), {capture:true,signal:this.abort.signal});
      this.nav.addEventListener('contextmenu', e => this.onContext(e), {capture:true,signal:this.abort.signal});
      this.nav.addEventListener('pointerdown', e => this.onDown(e), {signal:this.abort.signal});
      this.nav.addEventListener('keydown', e => this.onNavKey(e), {signal:this.abort.signal});
    }
    // Preserve each real v14 tab; do not clone it or replace its Foundry handler.
    for (const node of found.tabs) this.tabs.set(nativeId(node), node);
    for (const [id,node] of this.tabs) if (!node.isConnected || node.parentElement !== this.nav) this.tabs.delete(id);
    if (!this.tabs.size) return;
    if (!this.editButton?.isConnected) {
      this.editButton = make('button','buxa-sb-edit-button');
      this.editButton.type = 'button';
      this.editButton.title = 'Edit Buttons';
      this.editButton.setAttribute('aria-label','Edit Buttons');
      this.editButton.append(iconNode({type:'fa',value:'fa-solid fa-pen-ruler'}));
      this.editButton.addEventListener('click',e => {
        e.preventDefault(); e.stopImmediatePropagation();
        this.edit ? this.cancel() : this.begin();
      });
      this.nav.appendChild(this.editButton);
    }
    this.nav.classList.add('buxa-sb-nav');
    if (this.editButton.parentElement === this.nav && this.nav.lastElementChild !== this.editButton)
      this.nav.appendChild(this.editButton);
    this.apply();
  }
  onWorldChange() { if (!this.edit) this.apply(); }
  apply() {
    if (!this.nav) return;
    const layout = this.edit ? this.draft : this.active();
    const world = this.edit ? this.draftWorld : this.getWorld();
    if (!layout || !world) return;
    const anchor = this.editButton;
    for (const old of this.nav.querySelectorAll(':scope > .buxa-sb-folder')) old.remove();
    const native = this.tabs;
    const visible = id => this.isVisible(id,layout,world);
    const inFolders = new Set(layout.folders.flatMap(f => f.items));
    for (const [id,node] of native) {
      const show = !inFolders.has(id) && visible(id);
      node.classList.toggle('buxa-sb-native',true);
      node.classList.toggle('buxa-sb-hidden', !show);
      node.dataset.buxaButtonId = id;
      node.dataset.buxaLabel = LABELS[id] || id;
      // Store only the inline style introduced by Buxa; never overwrite a
      // native display value installed by another module.
      if (!show && !node.dataset.buxaOriginalDisplay) {
        node.dataset.buxaOriginalDisplay = node.style.display || '__empty__';
      }
      if (!show) node.style.display = 'none';
      else if (node.dataset.buxaOriginalDisplay) {
        const original = node.dataset.buxaOriginalDisplay;
        if (original === '__empty__') node.style.removeProperty('display');
        else node.style.display = original;
        delete node.dataset.buxaOriginalDisplay;
      }
    }
    for (const id of layout.order) {
      if (native.has(id)) {
        this.nav.insertBefore(native.get(id), anchor);
      } else {
        const folder = layout.folders.find(f => f.id === id);
        if (!folder) continue;
        const button = make('button','buxa-sb-folder');
        button.type = 'button';
        button.dataset.buxaButtonId = folder.id;
        button.title = folder.name;
        button.setAttribute('aria-label', folder.name);
        button.append(iconNode(folder.icon));
        const count = make('span','buxa-sb-folder-count',String(folder.items.length));
        button.append(count);
        if (this.openFolder === folder.id) button.classList.add('is-open');
        this.nav.insertBefore(button, anchor);
      }
    }
    this.nav.classList.toggle('buxa-sb-editing', this.edit);
    this.nav.classList.toggle('buxa-sb-snap', Boolean(layout.snap));
    this.nav.classList.toggle('buxa-sb-autoalign', Boolean(layout.autoAlign));
    this.editButton.setAttribute('aria-label', this.edit ? 'Exit Edit Buttons' : 'Edit Buttons');
    this.editButton.title = this.edit ? 'Exit Edit Buttons' : 'Edit Buttons';
    this.editButton.classList.toggle('is-editing',this.edit);
    this.editButton.replaceChildren(iconNode({type:'fa',value:this.edit ? 'fa-solid fa-xmark' : 'fa-solid fa-pen-ruler'}));
    if (this.openFolder) this.showFolder(this.openFolder);
    syncSidebarFolderState(this);
    if (this.drawer) this.renderDrawer();
    if (this.toolbar) { this.updateToolbar(); this.positionToolbar(); }
  }
  begin() {
    if (!this.nav) return;
    this.draft = this.active();
    this.draftWorld = this.getWorld();
    this.worldDirty = false;
    this.edit = true;
    this.closeFlyout(); this.closeDrawer(); this.closeMenu();
    this.showToolbar(); this.apply();
  }
  end() {
    this.cancelDrag(); this.closeFlyout(); this.closeDrawer(); this.closeMenu(); this.closeDialog();
    this.closeDockMenu();
    removeWithMotion(this.toolbar); this.toolbar = null;
    this.edit = false; this.draft = null; this.draftWorld = null; this.worldDirty = false;
    this.apply();
  }
  cancel() { if (this.saving) return; this.end(); }
  async save(forEveryone = false) {
    if (this.saving || !this.edit || (forEveryone && !game.user?.isGM)) return;
    if (!forEveryone && this.worldDirty) {
      notice('Save for everyone to publish GM visibility changes. You can still save your own layout afterward.', 'warn');
      return;
    }
    this.saving = true; this.updateToolbar();
    try {
      const layout = normalizeSidebarLayout(this.draft,this.allIds());
      if (forEveryone) {
        await game.settings.set(MODULE_ID,SIDEBAR_WORLD_KEY,{layout,visibility:this.draftWorld.visibility});
        // A previously saved personal override would otherwise hide the new
        // shared layout from the publishing GM.
        await game.user.unsetFlag(MODULE_ID,SIDEBAR_LAYOUT_KEY);
      } else await game.user.setFlag(MODULE_ID,SIDEBAR_LAYOUT_KEY,layout);
      this.end();
      notice(forEveryone ? 'Sidebar layout published for everyone.' : 'Your sidebar layout was saved.');
    } catch (error) {
      console.error('Buxa | Could not save sidebar buttons',error);
      notice('Could not finish saving the sidebar layout. Check your permissions and retry.','error');
    } finally { this.saving = false; this.updateToolbar(); }
  }
  async resetWorld() {
    if (!this.edit || this.saving) return;
    this.saving = true; this.updateToolbar();
    try {
      await game.user.unsetFlag(MODULE_ID,SIDEBAR_LAYOUT_KEY);
      this.end(); notice('Personal layout cleared. Using world default.');
    } catch (error) { console.error(error); notice('Could not reset your layout.','error'); }
    finally { this.saving = false; this.updateToolbar(); }
  }
  repositionFloating(){
    this.positionToolbar();
    if(this.dialog) this.positionSideCard(this.dialog,this.dialogAnchor);
    if(this.drawer) this.positionSideCard(this.drawer,this.nav,{offset:56,avoidDock:true});
    if(this.flyout) this.positionFlyout();
    if(this.menu) this.positionContextMenu(this.menu,this.menuAnchor);
  }
  positionSideCard(node,anchor,{offset=0,avoidDock=false}={}){
    if(!node || !this.nav)return;
    const reference=anchor?.getBoundingClientRect?.() || this.nav.getBoundingClientRect();
    const navBox=this.nav.getBoundingClientRect();
    const rightSidebar=navBox.left>window.innerWidth/2;
    // These cards belong to a sidebar button, NOT the dock across the screen.
    const edge=rightSidebar ? navBox.left : navBox.right;
    // In narrow windows, shrink cards into the available side lane instead of
    // overlapping the native sidebar buttons or the dock.
    const room=rightSidebar?edge-17:window.innerWidth-edge-17;
    node.style.maxWidth=`${Math.max(150,room)}px`;
    const width=node.offsetWidth||220,height=node.offsetHeight||160;
    const left=rightSidebar?edge-width-9:edge+9;
    node.style.left=`${Math.max(8,Math.min(window.innerWidth-width-8,left))}px`;
    node.style.top=`${Math.max(8,Math.min(window.innerHeight-height-8,reference.top+offset))}px`;
    node.classList.toggle('is-right-sidebar',rightSidebar);
  }
  onNavClick(e) {
    const btn=e.target.closest?.('.buxa-sb-folder');
    if (btn) {
      e.preventDefault();e.stopImmediatePropagation();
      if (!this.drag) this.openFolder === nearestId(btn) ? this.closeFlyout() : this.showFolder(nearestId(btn));
      return;
    }
    if (this.edit && e.target.closest?.('[data-buxa-button-id]')) {
      e.preventDefault();e.stopImmediatePropagation();
    }
  }
  onNavKey(e) {
    if (!this.edit || !['ArrowUp','ArrowDown'].includes(e.key)) return;
    const id=nearestId(e.target); if (!id) return;
    e.preventDefault();
    const entries=this.draft.order; const i=entries.indexOf(id), step=e.key==='ArrowUp'?-1:1;
    if (i<0 || i+step<0 || i+step>=entries.length) return;
    this.draft=moveSidebarButton(this.draft,id,{before:step===-1?entries[i-1]:(entries[i+2]||null)});
    this.apply();this.nav.querySelector(`[data-buxa-button-id="${id}"]`)?.focus();
  }
  onContext(e) {
    if (!this.edit) return;
    e.preventDefault();e.stopImmediatePropagation();
    const id=nearestId(e.target);
    if (!id) {this.showDrawer();return;}
    this.showContext(id,e.clientX,e.clientY);
  }
  showContext(id,x,y) {
    this.closeMenu();this.closeDockMenu();
    const folder=this.draft.folders.find(f=>f.id===id);
    const menu=make('div','buxa-sb-context buxa-sb-bubbles');menu.setAttribute('role','menu');
    const add=(text,icon,fn,disabled=false)=>{
      const b=make('button','buxa-sb-context-action');b.type='button';b.disabled=disabled;
      b.setAttribute('aria-label',text);b.title=text;b.dataset.tip=text;
      b.append(iconNode({type:'fa',value:`fa-solid ${icon}`}));
      if(/delete/i.test(text))b.classList.add('is-destructive');
      b.addEventListener('click',()=>{this.closeMenu();fn();});menu.append(b);
    };
    if(folder){
      add('Rename / change icon','fa-pen',()=>this.editFolder(id));
      add('Open folder','fa-folder-open',()=>this.showFolder(id));
      add('Delete folder','fa-trash',()=>{this.draft=removeSidebarFolder(this.draft,id);this.apply();});
    }else{
      add('Hide','fa-eye-slash',()=>this.showHideDialog(id),id==='settings');
      add('Delete','fa-trash',()=>{this.draft=setSidebarButtonVisibility(this.draft,id,'removed');this.apply();},id==='settings');
    }
    document.body.append(menu);this.menu=menu;
    this.menuAnchor=[...this.nav.querySelectorAll('[data-buxa-button-id]')].find(n=>n.dataset.buxaButtonId===id)||this.nav;
    this.positionContextMenu(menu,this.menuAnchor);
  }
  positionContextMenu(menu,anchor){
    if(!menu || !anchor)return;
    const r=anchor.getBoundingClientRect(),n=this.nav?.getBoundingClientRect()||r;
    const w=menu.offsetWidth||94,h=menu.offsetHeight||45;
    const rightSidebar=n.left>window.innerWidth/2;
    const left=rightSidebar ? r.left-w-9 : r.right+9;
    menu.style.left=`${Math.max(6,Math.min(window.innerWidth-w-6,left))}px`;
    menu.style.top=`${Math.max(6,Math.min(window.innerHeight-h-6,r.top+(r.height-h)/2))}px`;
    menu.classList.toggle('is-right-sidebar',n.left>window.innerWidth/2);
  }
  closeMenu(){removeWithMotion(this.menu);this.menu=null;this.menuAnchor=null;}
  showHideDialog(id) {
    if (id==='settings')return;
    const content=make('div','buxa-sb-hide-dialog');
    content.append(make('p','','Choose who will no longer see this button. You can restore it from Hidden Buttons.'));
    const choices=make('div','buxa-sb-hide-choices');
    let scope='me';
    const scopes=[['me','Only me'],...(game.user?.isGM?[['all','All players'],['specific','Specific players']]:[])];
    const specific=make('div','buxa-sb-player-list');specific.hidden=true;
    const selected=new Set();
    for (const [value,label] of scopes) {
      const row=make('label','buxa-sb-choice');
      const input=make('input');input.type='radio';input.name='buxa-sb-hide-scope';input.value=value;input.checked=value==='me';
      input.addEventListener('change',()=>{scope=value;specific.hidden=value!=='specific';});
      row.append(input,document.createTextNode(label));choices.append(row);
    }
    content.append(choices);
    if(game.user?.isGM) {
      const users=[...(game.users ?? [])].filter(u=>!u.isGM);
      if (!users.length) specific.append(make('p','','No player accounts found.'));
      for (const u of users) {
        const row=make('label','buxa-sb-choice');const check=make('input');check.type='checkbox';
        check.checked=(this.draftWorld.visibility.users[u.id]||[]).includes(id);
        if(check.checked)selected.add(u.id);
        check.addEventListener('change',()=>check.checked?selected.add(u.id):selected.delete(u.id));
        row.append(check,document.createTextNode(u.name || u.id));specific.append(row);
      }
      content.append(specific);
    }
    this.showDialog('Hide for who?',content,[['Cancel',()=>{}],['Hide',()=>{
      if(scope==='me') this.draft=setSidebarButtonVisibility(this.draft,id,'hidden');
      else if(scope==='all' && game.user?.isGM) {
        const list=new Set(this.draftWorld.visibility.allPlayers);list.add(id);
        this.draftWorld.visibility.allPlayers=[...list];this.worldDirty=true;
      } else if(scope==='specific' && game.user?.isGM) {
        for(const u of [...(game.users ?? [])].filter(u=>!u.isGM)) {
          const set=new Set(this.draftWorld.visibility.users[u.id]||[]);
          selected.has(u.id)?set.add(id):set.delete(id);
          if(set.size)this.draftWorld.visibility.users[u.id]=[...set];
          else delete this.draftWorld.visibility.users[u.id];
        }
        this.worldDirty=true;
      }
      this.apply();
    },'primary']],id);
  }
  showDialog(title,body,actions,anchorId=null) {
    this.closeDialog();
    const modal=make('section','buxa-sb-dialog buxa-sb-side-card');
    modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','false');
    modal.setAttribute('aria-label',title);
    const header=make('div','buxa-sb-dialog-header');
    header.append(make('span','buxa-sb-kicker','BUXA · SIDEBAR'),make('h2','',title));
    const footer=make('footer','buxa-sb-dialog-footer');
    for(const [label,fn,kind] of actions){
      const btn=make('button',`buxa-sb-dialog-button ${kind||''}`,label);btn.type='button';
      btn.addEventListener('click',()=>{fn();this.closeDialog();});footer.append(btn);
    }
    modal.append(header,body,footer);
    document.body.append(modal);this.dialog=modal;
    this.dialogAnchor=anchorId?[...this.nav.querySelectorAll('[data-buxa-button-id]')].find(n=>n.dataset.buxaButtonId===anchorId):this.nav;
    this.positionSideCard(modal,this.dialogAnchor);
    modal.querySelector('input')?.focus();
  }
  closeDialog(){removeWithMotion(this.dialog);this.dialog=null;this.dialogAnchor=null;}
  createFolder(){
    if(!this.edit)return;
    const id=randomFolder();
    this.draft=addSidebarFolder(this.draft,id,'New Folder');
    this.apply();this.editFolder(id,true);
  }
  editFolder(id, newlyCreated=false) {
    const folder=this.draft.folders.find(f=>f.id===id);if(!folder)return;
    const content=make('div','buxa-sb-folder-edit');
    const lab=make('label','buxa-sb-form-label','Folder name');
    const name=make('input','buxa-sb-input');name.type='text';name.value=folder.name;name.maxLength=36;
    lab.append(name);content.append(lab);
    const iconLabel=make('label','buxa-sb-form-label','Font Awesome icon classes');
    const icon=make('input','buxa-sb-input');icon.type='text';icon.placeholder='fa-solid fa-folder';
    icon.value=folder.icon.type==='fa'?folder.icon.value:'fa-solid fa-folder';iconLabel.append(icon);
    content.append(iconLabel);
    const preview=make('div','buxa-sb-preview');preview.append(iconNode(folder.icon),document.createTextNode(' Folder preview'));
    const browse=make('button','buxa-sb-browse','Choose SVG / image');browse.type='button';
    let imagePath=folder.icon.type==='image'?folder.icon.value:null;
    browse.addEventListener('click',()=>{
      new BuxaAssetBrowser({type:'image',current:imagePath||'',title:'Buxa · Folder Icon',onSelect:path=>{
        if(!path)return;imagePath=path;preview.replaceChildren(iconNode({type:'image',value:path}),document.createTextNode(' Folder preview'));
      }}).render({force:true}).catch(error=>console.warn('Buxa | Could not open icon picker',error));
    });
    icon.addEventListener('input',()=>{imagePath=null;const candidate=icon.value.trim();
      if(/^fa-(solid|regular|brands|light) fa-[a-z0-9-]+$/.test(candidate))preview.replaceChildren(iconNode({type:'fa',value:candidate}),document.createTextNode(' Folder preview'));
    });
    content.append(browse,preview);
    this.showDialog('Customize folder',content,[['Cancel',()=>{if(newlyCreated){this.draft=removeSidebarFolder(this.draft,id);this.apply();}}],['Save folder',()=>{
      folder.name=name.value.trim().slice(0,36)||'New Folder';
      const candidate=icon.value.trim();
      folder.icon=imagePath?{type:'image',value:imagePath}: {type:'fa',value:/^fa-(?:solid|regular|brands|light) fa-[a-z0-9-]+$/.test(candidate)?candidate:'fa-solid fa-folder'};
      this.apply();
    },'primary']],id);
  }
  showFolder(id) {
    const folder=(this.edit?this.draft:this.active())?.folders.find(f=>f.id===id);
    if(!folder) {this.closeFlyout();return;}
    const layout=this.edit?this.draft:this.active(),world=this.edit?this.draftWorld:this.getWorld();
    const visibleTabs=folder.items.filter(tabId =>
      this.tabs.has(tabId) && (this.edit || this.isVisible(tabId,layout,world)));
    const signature=visibleTabs.join('|');
    if (this.openFolder===id && this.flyout?.isConnected &&
        this.flyout.dataset.buxaTabs===signature) {
      this.positionFlyout();
      return;
    }
    this.closeFlyout();this.openFolder=id;
    const fly=make('div','buxa-sb-flyout');fly.setAttribute('role','group');fly.setAttribute('aria-label',folder.name);
    fly.dataset.buxaTabs=signature;
    const buttons=make('div','buxa-sb-flyout-buttons');
    for(const tabId of visibleTabs) {
      const node=this.tabs.get(tabId);
      const button=make('button','buxa-sb-flyout-tab');button.type='button';
      button.dataset.buxaButtonId=tabId;button.title=LABELS[tabId]||tabId;
      const icon = node.querySelector('i,svg,img')?.cloneNode(true) || iconNode({type:'fa',value:FA[tabId]||'fa-solid fa-square'});
      button.setAttribute('aria-label', LABELS[tabId] || tabId);
      button.append(icon);
      button.addEventListener('click',e=>{
        e.preventDefault();e.stopPropagation();
        if(this.edit)return;
        activateSidebarFolderTab(tabId,{nativeButton:node});
      });
      if(this.edit) button.addEventListener('pointerdown',e=>this.startFromFlyout(e,tabId));
      buttons.append(button);
    }
    if(!buttons.children.length)buttons.append(make('span','buxa-sb-empty','Drag buttons here in Edit Mode'));
    fly.append(buttons);
    document.body.append(fly);this.flyout=fly;
    this.positionFlyout();syncSidebarFolderState(this);
  }
  positionFlyout(){
    positionSidebarFolderFlyout({flyout:this.flyout,nav:this.nav,tabs:this.tabs,
      openFolder:this.openFolder,documentRef:document,
      viewportWidth:window.innerWidth,viewportHeight:window.innerHeight});
  }
  closeFlyout(){removeWithMotion(this.flyout);this.flyout=null;this.openFolder=null;if(this.nav)syncSidebarFolderState(this);}
  showDrawer() {
    if(!this.edit)return;
    if(this.drawer) {this.closeDrawer();return;}
    const drawer=make('section','buxa-sb-drawer');drawer.setAttribute('aria-label','Hidden Buttons');
    document.body.append(drawer);this.drawer=drawer;this.renderDrawer();
    this.positionSideCard(drawer,this.nav,{offset:56,avoidDock:true});
  }
  renderDrawer() {
    if(!this.drawer||!this.draft)return;
    this.drawer.replaceChildren();
    const header=make('header','buxa-sb-drawer-header');
    header.append(make('span','buxa-sb-kicker','RESTORE BUTTONS'),make('h3','','Hidden Buttons'));
    const close=make('button','buxa-sb-close','×');close.type='button';close.setAttribute('aria-label','Close hidden buttons');
    close.addEventListener('click',()=>this.closeDrawer());header.append(close);this.drawer.append(header);
    this.drawer.append(make('p','buxa-sb-drawer-help','Click to restore, or drag a button onto the sidebar.'));
    const body=make('div','buxa-sb-drawer-items');
    const invisible=[...this.tabs.keys()].filter(id=>
      !this.isVisible(id,this.draft,this.draftWorld) ||
      (game.user?.isGM && (this.draftWorld.visibility.allPlayers.includes(id) ||
       Object.values(this.draftWorld.visibility.users).some(ids=>ids.includes(id)))));
    for(const id of invisible) {
      const btn=make('button','buxa-sb-drawer-item');btn.type='button';btn.dataset.buxaButtonId=id;
      btn.append(iconNode({type:'fa',value:FA[id]||'fa-solid fa-square'}),document.createTextNode(LABELS[id]||id));
      const restricted = !game.user?.isGM && !this.draft.hidden.includes(id) && !this.draft.removed.includes(id);
      if(restricted){btn.title='Hidden by the GM';btn.disabled=true;}
      else {
        btn.title=`Drag to restore ${LABELS[id]||id}`;
        btn.addEventListener('pointerdown',e=>this.startFromFlyout(e,id));
        btn.addEventListener('click',()=>{
          if(this.drag || this.lastDragged===id){this.lastDragged=null;return;}
          if(this.draftWorld.visibility.allPlayers.includes(id) && !game.user.isGM){notice('Hidden by the GM.','warn');return;}
          this.draft=moveSidebarButton(this.draft,id,{});
          if(game.user?.isGM && sidebarWorldRestricts(this.draftWorld,id)){
            this.draftWorld.visibility.allPlayers=this.draftWorld.visibility.allPlayers.filter(x=>x!==id);
            for(const [uid,ids] of Object.entries(this.draftWorld.visibility.users)){
              this.draftWorld.visibility.users[uid]=ids.filter(x=>x!==id);
            }
            this.worldDirty=true;
          }
          this.apply();
        });
      }
      body.append(btn);
    }
    if(!invisible.length)body.append(make('div','buxa-sb-empty','Nothing hidden. Right-click a tab to hide it.'));
    this.drawer.append(body);
  }
  closeDrawer(){removeWithMotion(this.drawer);this.drawer=null;}
  onDown(e) {
    if(!this.edit||e.button!==0||this.saving)return;
    const target=e.target.closest?.('[data-buxa-button-id]');const id=nearestId(target);
    if(!id || target===this.editButton || e.target.closest('.buxa-sb-context'))return;
    this.prepareDrag(e,id,target);
  }
  startFromFlyout(e,id) {
    if(!this.edit||e.button!==0)return;
    e.preventDefault();this.prepareDrag(e,id,e.currentTarget,{external:true});
  }
  prepareDrag(e,id,target,{external=false}={}) {
    if(this.drag || this.dragTimer)return;
    this.pending={id,source:target,x:e.clientX,y:e.clientY,pointerId:e.pointerId,external};
    this.dragTimer=globalThis.setTimeout(()=>{this.dragTimer=null;this.activateDrag();},170);
  }
  activateDrag() {
    if(!this.pending||!this.edit)return;
    const p=this.pending;
    const ghost=p.source.cloneNode(true);
    ghost.classList.add('buxa-sb-drag-preview');
    ghost.removeAttribute('id');ghost.removeAttribute('data-tab');ghost.style.removeProperty('display');
    // Independent translate uses Chromium's compositor instead of triggering
    // left/top layout at every pointer sample.
    ghost.style.left='0px';ghost.style.top='0px';
    ghost.style.translate=`${p.x}px ${p.y}px`;
    document.body.append(ghost);
    const placeholder=make('span','buxa-sb-drop-placeholder');
    placeholder.setAttribute('aria-hidden','true');
    this.drag={...p,ghost,placeholder,into:null,before:null};annotateSidebarDrag(this,this.drag);
    this.nav.classList.add('buxa-sb-drag-active');
    this.nav.insertBefore(placeholder,this.editButton);
    startSidebarFolderSlots(this,this.drag);
    p.source.classList.add('buxa-sb-being-dragged');
    this.closeMenu();
  }
  onMove(e) {
    const samples=e.getCoalescedEvents?.();
    const latest=samples?.length?samples[samples.length-1]:e;
    const x=latest.clientX,y=latest.clientY;
    if(this.pending && !this.drag) {
      if(e.pointerId!==this.pending.pointerId)return;
      if(Math.hypot(x-this.pending.x,y-this.pending.y)>7){
        globalThis.clearTimeout(this.dragTimer);this.dragTimer=null;this.activateDrag();
      }
    }
    if(!this.drag||e.pointerId!==this.drag.pointerId)return;
    const drag=this.drag;
    drag.ghost.style.translate=`${x}px ${y}px`;
    drag.latestPoint={x,y};
    // Placement hit-tests run once per paint, not for every mouse report.
    // The translucent ghost itself always follows the latest pointer sample.
    if(drag.raf)return;
    const raf=globalThis.requestAnimationFrame;
    if(typeof raf==='function') drag.raf=raf(()=>{
      drag.raf=null;
      if(this.drag!==drag)return;
      updateSidebarDragTarget(this,drag.latestPoint);
    });
    else updateSidebarDragTarget(this,drag.latestPoint);
  }
  markDropPosition(before){
    for(const node of this.nav.querySelectorAll('.buxa-sb-drop-before')) node.classList.remove('buxa-sb-drop-before');
    const target=before?[...this.nav.children].find(n=>n.dataset?.buxaButtonId===before):null;
    if(target)target.classList.add('buxa-sb-drop-before');
    else this.editButton?.classList.add('buxa-sb-drop-before');
  }
  onUp(e) {
    if(this.pending && e.pointerId!==this.pending.pointerId)return;
    globalThis.clearTimeout(this.dragTimer);this.dragTimer=null;
    const drag=this.drag;
    this.pending=null;
    if(!drag)return;
    if(drag.raf && globalThis.cancelAnimationFrame) globalThis.cancelAnimationFrame(drag.raf);
    if(drag.latestPoint) updateSidebarDragTarget(this,drag.latestPoint);
    if(drag.overNav) {
      const before=drag.before===drag.id?null:drag.before;
      this.draft=moveSidebarButton(this.draft,drag.id,{into:drag.into,before});
    }
    this.lastDragged=drag.id;globalThis.setTimeout(()=>{this.lastDragged=null;},0);
    this.cancelDrag();this.apply();
    if(drag.overNav && !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches){
      const button=[...this.nav.children].find(n=>n.dataset?.buxaButtonId===drag.id);
      button?.animate?.([{transform:'scale(1.04)'},{transform:'scale(1)'}],
        {duration:180,easing:'cubic-bezier(.2,.8,.2,1)'});
    }
  }
  cancelDrag(){
    globalThis.clearTimeout(this.dragTimer);this.dragTimer=null;this.pending=null;
    if(this.drag?.raf && globalThis.cancelAnimationFrame)globalThis.cancelAnimationFrame(this.drag.raf);
    for(const animation of this.drag?.shiftAnimations?.values?.()||[])animation.cancel?.();
    removeSidebarFolderSlots(this.drag);
    this.drag?.source?.classList?.remove('buxa-sb-being-dragged');
    this.drag?.ghost?.remove();this.drag?.placeholder?.remove();this.drag=null;
    this.nav?.classList.remove('buxa-sb-drag-active');
    this.nav?.querySelectorAll('.buxa-sb-drop-before,.buxa-sb-folder.is-drop-target').forEach(n=>n.classList.remove('buxa-sb-drop-before','is-drop-target'));
  }
}
installSidebarDockMethods(SidebarButtonEditor,{make,iconNode,removeWithMotion,defaultSidebarLayout});
