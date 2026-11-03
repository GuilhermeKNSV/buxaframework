/** Drag layout feedback for Edit Buttons. One hit-test per animation frame and
 * one active FLIP per neighbor; avoids a backlog of animations while moving. */
import { hitSidebarFolderSlot, updateSidebarFolderSlots } from './sidebar-folder-drop.js';
export function updateSidebarDragTarget(editor,{x,y}) {
  const drag=editor.drag,nav=editor.nav;
  if(!drag||!nav)return;
  const rect=nav.getBoundingClientRect();
  updateSidebarFolderSlots(editor,drag);
  // Only the dedicated square extension puts a button *inside* a folder.
  // The native folder button itself always remains a normal reorder target.
  const into=hitSidebarFolderSlot({x,y},drag.folderSlots);
  if(into){
    drag.into=into;drag.before=null;drag.overNav=true;
    drag.placeholder.style.display='none';
    nav.querySelectorAll('.buxa-sb-drop-before,.buxa-sb-folder.is-drop-target').forEach(n=>
      n.classList.remove('buxa-sb-drop-before','is-drop-target'));
    for(const entry of drag.folderSlots)entry.slot.classList.toggle('is-armed',entry.id===into);
    return;
  }
  drag.into=null;
  for(const entry of drag.folderSlots||[])entry.slot.classList.remove('is-armed');
  if(x<rect.left-32||x>rect.right+40||y<rect.top-25||y>rect.bottom+25){
    drag.into=null;drag.before=null;drag.overNav=false;
    drag.placeholder.style.display='none';
    nav.querySelectorAll('.buxa-sb-folder.is-drop-target').forEach(n=>n.classList.remove('is-drop-target'));
    return;
  }
  drag.overNav=true;
  const buttons=[...nav.children].filter(n=>n.dataset?.buxaButtonId && n.dataset.buxaButtonId!==drag.id && getComputedStyle(n).display!=='none');
  const bounds=buttons.map(node=>({node,rect:node.getBoundingClientRect()}));
  nav.querySelectorAll('.buxa-sb-folder.is-drop-target').forEach(n=>n.classList.remove('is-drop-target'));
  const vertical=rect.height>rect.width;
  const target=bounds.find(({rect:r})=>(vertical?y:x) < (vertical?r.top+r.height/2:r.left+r.width/2));
  const before=target?.node?.dataset?.buxaButtonId||null;
  drag.before=before;
  drag.placeholder.style.display='block';
  if(!editor.draft.snap){
    drag.placeholder.style.position='absolute';
    drag.placeholder.style.left=`${Math.max(0,Math.min(rect.width-36,x-rect.left-18))}px`;
    drag.placeholder.style.top=`${Math.max(0,Math.min(rect.height-36,y-rect.top-18))}px`;
    drag.placeholder.style.zIndex='1';
    return;
  }
  drag.placeholder.style.position='';drag.placeholder.style.left='';drag.placeholder.style.top='';
  const insertion=target?.node||editor.editButton;
  if(insertion&&drag.placeholder.nextElementSibling!==insertion){
    // Remove the previous shift animation before measuring the next position;
    // otherwise repeated movements stack independent 235ms animations.
    for(const animation of drag.shiftAnimations?.values?.()||[])animation.cancel?.();
    drag.shiftAnimations=new Map();
    const old=new Map(bounds.map(({node})=>[node,node.getBoundingClientRect()]));
    nav.insertBefore(drag.placeholder,insertion);
    if(!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches){
      for(const {node} of bounds){
        const start=old.get(node),end=node.getBoundingClientRect();
        const dx=start.left-end.left,dy=start.top-end.top;
        if((Math.abs(dx)>1||Math.abs(dy)>1)&&typeof node.animate==='function'){
          const animation=node.animate(
            [{transform:`translate3d(${dx}px,${dy}px,0)`},{transform:'translate3d(0,0,0)'}],
            {duration:135,easing:'cubic-bezier(.18,.8,.23,1)',composite:'add'});
          drag.shiftAnimations.set(node,animation);
        }
      }
    }
  }
  editor.markDropPosition(before);
}
