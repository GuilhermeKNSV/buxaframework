/** Sidecar Actor chooser. Keep DOM paging out of the encounter controller so
 * initiative, death/archive and placement logic stay separate from picker UI. */
export function toggleEncounterActorPicker(controller, { icon, combatantSummary }) {
    if (controller.picker?.isConnected) {controller.disposePickerPosition?.();controller.picker.remove();controller.picker=null;return;}
    const picker = document.createElement('aside');
    picker.className = 'buxa-enc-picker';
    picker.setAttribute('aria-label', 'Actor picker');
    picker.innerHTML = '<div class="buxa-enc-picker-head"><b>SELECT ACTOR</b><button data-picker-close>×</button></div><input type="search" placeholder="Search Actors..." aria-label="Search Actors"><div class="buxa-enc-picker-list"></div>';
    document.body.append(picker); controller.picker = picker;
    const reposition=()=>{
      if(!picker.isConnected)return;
      const rect=controller.root.getBoundingClientRect();
      const width=picker.offsetWidth||360;
      const left=rect.left-width-8 >= 8 ? rect.left-width-8 : rect.right+8;
      picker.style.left=`${Math.max(8,Math.min(window.innerWidth-width-8,left))}px`;
      picker.style.right='auto';
      picker.style.top=`${Math.max(8,Math.min(window.innerHeight-220,rect.top+30))}px`;
    };
    controller.disposePickerPosition?.();
    window.addEventListener('resize',reposition,{passive:true});
    controller.disposePickerPosition=()=>window.removeEventListener('resize',reposition);
    reposition();
    picker.querySelector('[data-picker-close]').addEventListener('click', () => { controller.disposePickerPosition?.();picker.remove();controller.picker=null; });
    const listing = picker.querySelector('.buxa-enc-picker-list');
    let visibleLimit = 150;
    const draw = () => {
      const query = picker.querySelector('input').value.toLowerCase();
      const previousScroll = listing.scrollTop;
      listing.replaceChildren();
      const matches = [...game.actors]
        .filter(actor => actor.name.toLowerCase().includes(query))
        .sort((a, b) => a.name.localeCompare(b.name));
      matches.slice(0, visibleLimit).forEach(actor => {
          const row = document.createElement('div'); row.className = 'buxa-enc-picker-row'; row.draggable = true;
          const art = document.createElement('img'); art.src = icon(actor); art.alt = '';
          const desc = document.createElement('span');
          const name = document.createElement('b'); name.textContent = actor.name;
          const info = document.createElement('small'); info.textContent = combatantSummary(actor); desc.append(name, info);
          const actions = document.createElement('div'); actions.className = 'buxa-enc-picker-actions';
          const open = document.createElement('button'); open.textContent = '↗'; open.title = 'Open sheet'; open.addEventListener('click', () => actor.sheet?.render?.({force:true}));
          const add = document.createElement('button'); add.textContent = '＋'; add.title = 'Add to combat'; add.addEventListener('click', () => void controller.addActor(actor.id));
          actions.append(open, add);
          row.append(art, desc, actions);
          row.addEventListener('dragstart', event => {
            event.dataTransfer.setData('application/x-buxa-encounter-actor', actor.id);
            event.dataTransfer.setData('text/plain', JSON.stringify({type:'Actor', uuid:actor.uuid}));
            event.dataTransfer.effectAllowed = 'copy';
          });
          listing.append(row);
        });
      if (matches.length > visibleLimit) {
        const more = document.createElement('button');
        more.type = 'button';
        more.className = 'buxa-enc-picker-more';
        more.textContent = `Show more Actors (${visibleLimit} / ${matches.length})`;
        more.addEventListener('click', () => { visibleLimit += 150; draw(); });
        listing.append(more);
      }
      listing.scrollTop = previousScroll;
    };
    picker.querySelector('input').addEventListener('input', () => { visibleLimit = 150; listing.scrollTop=0; draw(); });
    draw();
}
