/** One low-cost delegated selection handler per directory type.
 * Never re-renders lists while selecting: only toggles card classes. */
import { openBatchEditor } from "./document-editor.js";

const controllers = new Map();
export function directoryMultiEdit(kind) {
  if (controllers.has(kind)) return controllers.get(kind);
  const type = kind === "Actor" ? "actors" : "items";
  const root = () => document.querySelector(`#sidebar #${type}, #${type}.sidebar-tab, [data-tab="${type}"].sidebar-tab`);
  const current = id => (kind === "Actor" ? game.actors : game.items)?.get(id);
  const visibleCard = event => event.target?.closest?.("[data-buxa-dir-item], [data-buxa-doc], [data-buxa-item]");
  const panels = () => document.querySelectorAll(`.buxa-folder-panels${kind==="Actor"?".buxa-generic-panels":":not(.buxa-generic-panels)"} [data-buxa-doc], .buxa-folder-panels${kind==="Actor"?".buxa-generic-panels":":not(.buxa-generic-panels)"} [data-buxa-item]`);
  const state = {enabled:false,selected:new Set(),shell:null,bar:null,button:null,
    paint(){
      const currentIds = new Set([...state.selected].filter(id=>current(id)));
      if(currentIds.size!==state.selected.size)state.selected=currentIds;
      const shell=state.shell;
      shell?.classList.toggle("is-multi-select",state.enabled);
      state.button?.classList.toggle("is-active",state.enabled);
      state.button?.setAttribute("aria-pressed",String(state.enabled));
      if(state.bar){state.bar.hidden=!state.enabled;const count=state.bar.querySelector(".buxa-multi-count");if(count)count.textContent=`${state.selected.size} selected`;const apply=state.bar.querySelector("[data-buxa-multi-apply]");if(apply)apply.disabled=!state.selected.size;}
      const rows=[...shell?.querySelectorAll?.("[data-buxa-dir-item], [data-buxa-doc]")??[],...panels()];
      for(const row of rows){const id=row.dataset.buxaDirItem||row.dataset.buxaDoc||row.dataset.buxaItem;row.classList.toggle("is-multi-selected",state.enabled&&state.selected.has(id));row.setAttribute("aria-pressed",String(state.enabled&&state.selected.has(id)));}
    },
    toggle(on=!state.enabled){state.enabled=Boolean(on);if(!state.enabled)state.selected.clear();state.paint();},
    mount(shell) {
      if(state.shell===shell)return;
      state.shell=shell;state.bar=null;state.button=null;
      const toolbar=shell.querySelector(".buxa-world-toolbar");
      if(!toolbar)return;
      state.button=document.createElement("button");state.button.type="button";state.button.className="buxa-multiedit-toggle";state.button.innerHTML='<i class="fa-solid fa-list-check"></i><span>Multi edit</span>';
      state.button.title=`Select multiple ${kind.toLowerCase()}s`;
      toolbar.after(state.button);
      state.bar=document.createElement("div");state.bar.className="buxa-world-multibar";state.bar.hidden=true;
      state.bar.innerHTML='<span class="buxa-multi-count">0 selected</span><button type="button" data-buxa-multi-clear>Clear</button><button type="button" data-buxa-multi-apply>EDIT</button>';
      state.button.after(state.bar);
      state.button.addEventListener('click',()=>state.toggle());
      state.bar.querySelector('[data-buxa-multi-clear]').addEventListener('click',()=>{state.selected.clear();state.paint();});
      state.bar.querySelector('[data-buxa-multi-apply]').addEventListener('click',()=>{
        const docs=[...state.selected].map(current).filter(Boolean);
        if(docs.length)openBatchEditor(kind,docs);
      });
      state.paint();
    }
  };
  function applicable(target){
    if(!state.enabled || !state.shell?.isConnected || !root()?.classList.contains("active"))return false;
    return Boolean(state.shell.contains(target) || [...panels()].some(node=>node===target || node.contains(target)));
  }
  document.addEventListener("click",event=>{
    if(!applicable(event.target))return;
    const row=visibleCard(event);if(!row)return;
    const id=row.dataset.buxaDirItem||row.dataset.buxaDoc||row.dataset.buxaItem;
    if(!current(id))return;
    event.preventDefault();event.stopImmediatePropagation();
    state.selected.has(id)?state.selected.delete(id):state.selected.add(id);
    state.paint();
  },true);
  document.addEventListener("dragstart",event=>{
    if(!applicable(event.target)||!visibleCard(event))return;
    event.preventDefault();event.stopImmediatePropagation();
  },true);
  document.addEventListener("keydown",event=>{if(event.key==="Escape"&&state.enabled)state.toggle(false);});
  controllers.set(kind,state);
  return state;
}
