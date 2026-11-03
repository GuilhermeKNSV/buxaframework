import { findOppositeDockPlacement, findFoundryUiObstacles, dockOverlap } from "./sidebar-dock-placement.js";
/** Presentation-only controls for the sidebar editor.
 * Methods are mixed into the existing editor. No persistence or layout
 * semantics live here; saving still uses the original editor APIs. */
export function installSidebarDockMethods(EditorClass,{make,iconNode,removeWithMotion,defaultSidebarLayout}) {
  const dockMethods = {
showToolbar() {
    this.toolbar?.remove();
    this.closeDockMenu();
    const dock = make('section','buxa-sb-toolbar buxa-sb-dock');
    dock.setAttribute('aria-label','Sidebar layout controls');
    const group = (name) => { const div=make('div',`buxa-sb-dock-group ${name}`); dock.append(div); return div; };
    const makeAction=(container,icon,tip,fn,cls='')=>{
      const b=make('button',`buxa-sb-dock-button ${cls}`);
      b.type='button'; b.title=tip; b.setAttribute('aria-label',tip);
      b.dataset.tip=tip;
      b.append(iconNode({type:'fa',value:`fa-solid ${icon}`}));
      b.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();fn();});
      container.append(b);return b;
    };
    dock.append(make('span','buxa-sb-dock-caption','EDIT'));
    const saves=group('buxa-sb-save-group');
    makeAction(saves,'fa-floppy-disk','Save for me',()=>this.save(Boolean(this.worldDirty)),'buxa-sb-dock-save');
    makeAction(saves,'fa-chevron-down','Save options',()=>this.toggleDockMenu(),'buxa-sb-dock-save-arrow');
    const core=group('buxa-sb-dock-essential');
    makeAction(core,'fa-xmark','Cancel editing',()=>this.cancel(),'buxa-sb-dock-cancel');
    const controls=group('buxa-sb-dock-extras');
    makeAction(controls,'fa-folder-plus','Add Folder',()=>this.createFolder());
    makeAction(controls,'fa-eye-slash','Hidden buttons',()=>this.showDrawer(),'buxa-sb-restore');
    const snap=makeAction(controls,'fa-border-all','Snap to Grid',()=>{this.draft.snap=!this.draft.snap;this.apply();},'buxa-sb-dock-toggle');
    snap.dataset.buxaToggle='snap';
    const align=makeAction(controls,'fa-align-center','Auto-Align',()=>{this.draft.autoAlign=!this.draft.autoAlign;this.apply();},'buxa-sb-dock-toggle');
    align.dataset.buxaToggle='autoAlign';
    const more=group('buxa-sb-dock-more');
    makeAction(more,'fa-ellipsis','More options',()=>this.toggleDockMenu('more'));
    const collapse=group('buxa-sb-dock-collapse');
    makeAction(collapse,'fa-angles-left','Collapse controls',()=>{
      this.dockCollapsed=!this.dockCollapsed;
      dock.classList.toggle('is-compact',this.dockCollapsed);
      this.closeDockMenu();this.positionToolbar();
      const btn=dock.querySelector('.buxa-sb-dock-collapse button');
      const tip=this.dockCollapsed?'Expand controls':'Collapse controls';
      btn.dataset.tip=tip;btn.title=tip;btn.setAttribute('aria-label',tip);
    });
    dock.classList.toggle('is-compact',this.dockCollapsed);
    document.body.append(dock);this.toolbar=dock;
    this.dockExpandedHeight=dock.offsetHeight || 330;
    this.dockExpandedWidth=dock.offsetWidth || 52;
    this.dockPlacement=null;this.positionToolbar();this.updateToolbar();
  },
  positionToolbar() {
    if (!this.nav || !this.toolbar) return;
    const dock=this.toolbar;
    const sidebar=this.nav.getBoundingClientRect();
    const obstacles=findFoundryUiObstacles(document,window);
    // Never remeasure the shrinking/expanding dock for placement. Reserving the
    // full expanded footprint prevents the jump on Collapse / Expand.
    const w=this.dockExpandedWidth || 52;
    const h=this.dockExpandedHeight || 330;
    const viewport={width:window.innerWidth,height:window.innerHeight};
    let position=this.dockPlacement;
    const usable=position && position.side===(sidebar.left>viewport.width*.5?'left':'right')
      && position.x>=7 && position.y>=7
      && position.x+w<=viewport.width-7 && position.y+h<=viewport.height-7
      && dockOverlap({x:position.x,y:position.y,width:w,height:h},obstacles)===0;
    if(!usable){
      position=findOppositeDockPlacement({...viewport,sidebarRect:sidebar,dockWidth:w,dockHeight:h,obstacles});
      this.dockPlacement=position;
    }
    dock.classList.toggle('is-left-sidebar',position.side==='left');
    dock.classList.toggle('is-right-sidebar',position.side==='right');
    // The GM Controls panel owns the left edge while expanded. Keep its
    // original layering: the edit dock tucks BEHIND it rather than floating
    // over the GM settings or jumping onto the middle of the canvas.
    const gmOpen=Boolean(document.querySelector('.buxa-gm-panel.is-open'));
    const underGm=gmOpen && position.side==='left';
    dock.classList.toggle('is-gm-covered',underGm);
    if(underGm && this.dockMenu)this.closeDockMenu();
    // Position remains stable across an expanded/compact transition.
    if(dock.style.left!==`${position.x}px`)dock.style.left=`${position.x}px`;
    if(dock.style.top!==`${position.y}px`)dock.style.top=`${position.y}px`;
    this.positionDockMenu();
  },
  updateToolbar() {
    if (!this.toolbar || !this.draft) return;
    for(const b of this.toolbar.querySelectorAll('[data-buxa-toggle]')){
      const active=Boolean(this.draft[b.dataset.buxaToggle]);
      b.classList.toggle('is-on',active);
      b.setAttribute('aria-pressed',String(active));
      b.title=`${b.dataset.buxaToggle==='snap'?'Snap to Grid':'Auto-Align'}: ${active?'On':'Off'}`;
      b.dataset.tip=b.title;
    }
    const save=this.toolbar.querySelector('.buxa-sb-dock-save');
    const label=this.worldDirty?'Save for everyone':'Save for me';
    save.title=label;save.dataset.tip=label;save.setAttribute('aria-label',label);
    this.toolbar.classList.toggle('has-world-changes',this.worldDirty);
    this.toolbar.classList.toggle('is-saving',this.saving);
    for(const b of this.toolbar.querySelectorAll('button')) b.disabled=this.saving;
  },
  toggleDockMenu(mode='save') {
    if(this.dockMenu && this.dockMenu.dataset.mode===mode){this.closeDockMenu();return;}
    this.closeDockMenu();
    const popup=make('div','buxa-sb-save-menu');
    popup.dataset.mode=mode;
    popup.setAttribute('role','menu');
    const add=(text,icon,action)=>{
      const b=make('button','buxa-sb-save-option');b.type='button';b.setAttribute('role','menuitem');
      b.append(iconNode({type:'fa',value:`fa-solid ${icon}`}),document.createTextNode(text));
      b.addEventListener('click',e=>{e.stopPropagation();this.closeDockMenu();action();});popup.append(b);
    };
    if(mode==='save'){
      add('Save for me','fa-user',()=>this.save(false));
      if(game.user?.isGM)add('Save for everyone','fa-users',()=>this.save(true));
    } else {
      add('Reset to default','fa-arrow-rotate-left',()=>{this.draft=defaultSidebarLayout(this.allIds());this.apply();});
      add('Reset to world default','fa-globe',()=>this.resetWorld());
    }
    popup.addEventListener('keydown',event=>{
      const buttons=[...popup.querySelectorAll('button')],index=buttons.indexOf(event.target);
      if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
        event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1
          :(index+(event.key==='ArrowUp'?-1:1)+buttons.length)%buttons.length;
        buttons[next]?.focus();
      }
      if(event.key==='Escape'){event.preventDefault();this.closeDockMenu();this.toolbar?.querySelector('.buxa-sb-dock-save-arrow')?.focus();}
    });
    document.body.append(popup);this.dockMenu=popup;this.positionDockMenu();popup.querySelector('button')?.focus();
  },
  positionDockMenu(){
    if(!this.dockMenu||!this.toolbar)return;
    const rect=this.toolbar.getBoundingClientRect();
    const w=this.dockMenu.offsetWidth||210,h=this.dockMenu.offsetHeight||90;
    // Pop toward the centre, not outside the screen. The dock is now on the
    // OPPOSITE side of the native sidebar, so this must follow the dock itself.
    const left=this.toolbar.classList.contains('is-left-sidebar')?rect.right+9:rect.left-w-9;
    this.dockMenu.style.left=`${Math.max(7,Math.min(window.innerWidth-w-7,left))}px`;
    this.dockMenu.style.top=`${Math.max(7,Math.min(window.innerHeight-h-7,rect.top))}px`;
  },
  closeDockMenu(){removeWithMotion(this.dockMenu);this.dockMenu=null;}
  };
  Object.assign(EditorClass.prototype,dockMethods);
}
