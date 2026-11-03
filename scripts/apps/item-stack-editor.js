/** Item Configuration → Stacking. The compositing dialog is local to the Item
 * Configuration form; artwork is saved as image paths and transforms, never blobs. */
import { normalizeStackImages } from '../core/item-stack-artwork.js';
import { BuxaAssetBrowser } from './asset-browser.js';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=(n,fallback)=>n == null || (typeof n === 'string' && !n.trim())
  ? fallback : Number.isFinite(Number(n)) ? Number(n) : fallback;
const freshLayer=(img,x=50,y=50)=>({img,x,y,size:55,rotation:0,opacity:1});
/** Modal operations never mutate the Item Configuration draft before Apply. */
export const stackCompositionDraft = rule => structuredClone(rule?.layers||[]);
/** Explicit apply/cancel transaction for the layered editor, including
 * asynchronous image-picker callbacks that can arrive after cancellation. */
export function createStackCompositionSession(rule) {
  const draft={layers:stackCompositionDraft(rule)};
  let active=true;
  return {
    draft,
    get active(){return active;},
    apply(){if(!active)return false;rule.layers=stackCompositionDraft(draft);active=false;return true;},
    cancel(){active=false;}
  };
}
export function bindItemStackEditor(app,root){
  const list=root.querySelector('[data-stack-images-list]');
  if(!list)return;
  app._stackImagesDraft??=normalizeStackImages(app._stackRulesSource||[]);
  const browse=(current,cb)=>{const picker=new BuxaAssetBrowser({type:'image',current:current||'',title:'Buxa · Stack Artwork',onSelect:path=>{if(path)cb(path);}});void picker.render({force:true});};
  const preview=rule=>rule.mode==='custom'?`<span class="buxa-stack-composite">${rule.layers.map(layer=>`<img src="${escape(layer.img)}" style="left:${layer.x}%;top:${layer.y}%;width:${layer.size}%;transform:translate(-50%,-50%) rotate(${layer.rotation}deg);opacity:${layer.opacity}" alt="">`).join('')}</span>`:`<img src="${escape(rule.img||app.item?.img||'')}" alt="">`;
  const redraw=()=>{
    list.innerHTML=app._stackImagesDraft.map((r,i)=>`<article class="buxa-stack-art-row" data-stack-rule-index="${i}">
      <div class="buxa-stack-art-thumb">${preview(r)}</div>
      <label>AFTER QUANTITY<input type="number" min="2" max="999999" step="1" data-stack-at value="${r.at}"></label>
      <label>ARTWORK TYPE<select data-stack-mode><option value="image" ${r.mode==='image'?'selected':''}>Different image</option><option value="custom" ${r.mode==='custom'?'selected':''}>Custom image for stack</option></select></label>
      <button type="button" data-stack-edit><i class="fa-solid fa-${r.mode==='custom'?'object-group':'image'}"></i> ${r.mode==='custom'?'Edit composition':'Choose image'}</button>
      <button type="button" data-stack-remove title="Remove rule" aria-label="Remove stack image rule"><i class="fa-solid fa-trash"></i></button>
    </article>`).join('');
    root.querySelector('[data-stack-empty]')?.toggleAttribute('hidden',app._stackImagesDraft.length>0);
  };
  const openEditor=rule=>{
    const doc=root.ownerDocument;
    const overlay=doc.createElement('div');overlay.className='buxa-stack-art-modal';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-label','Custom stack image editor');
    const session=createStackCompositionSession(rule),draft=session.draft;
    let selected=Math.max(0,draft.layers.length-1);
    const itemSrc=()=>root.querySelector('[data-item-image]')?.value||app.item?.img||'';
    const stageMarkup=()=>draft.layers.map((layer,i)=>`<div class="buxa-stack-art-layer ${i===selected?'is-selected':''}" data-stack-layer="${i}" style="left:${layer.x}%;top:${layer.y}%;width:${layer.size}%;transform:translate(-50%,-50%) rotate(${layer.rotation}deg);opacity:${layer.opacity}"><img src="${escape(layer.img)}" draggable="false" alt=""><span class="buxa-stack-art-resize" data-stack-resize title="Drag to resize">↘</span><span class="buxa-stack-art-rotate" data-stack-rotate title="Drag to rotate">↻</span></div>`).join('');
    overlay.tabIndex=-1;
    overlay.innerHTML=`<div class="buxa-stack-art-dialog"><header><strong><i class="fa-solid fa-object-group"></i> CUSTOM STACK IMAGE</strong><button type="button" data-stack-close aria-label="Cancel editor">×</button></header><div class="buxa-stack-art-workspace"><div class="buxa-stack-art-stage" data-stack-stage>${stageMarkup()}</div><aside><strong>LAYERS</strong><small>Use multiple copies of the same image, or choose other artwork.</small><div data-stack-layer-list></div><div class="buxa-stack-art-add"><button type="button" data-stack-add-current>+ Add current image</button><button type="button" data-stack-add-other>+ Browse image</button></div><div data-stack-layer-controls><label>SIZE <input type="number" min="5" max="250" data-stack-size></label><label>ROTATION <input type="number" min="-3600" max="3600" data-stack-rotation></label><label>OPACITY <input type="range" min="0.05" max="1" step="0.01" data-stack-opacity></label><button type="button" data-stack-delete-layer><i class="fa-solid fa-trash"></i> Remove layer</button></div></aside></div><footer><small>Drag to move. Apply saves the layers to the Item draft.</small><div class="buxa-stack-art-actions"><button type="button" data-stack-cancel>Cancel</button><button type="button" data-stack-done>Apply</button></div></footer></div>`;
    const stage=overlay.querySelector('[data-stack-stage]');
    const draw=()=>{
      stage.innerHTML=stageMarkup();
      overlay.querySelector('[data-stack-layer-list]').innerHTML=draft.layers.map((l,i)=>`<button type="button" class="${i===selected?'is-selected':''}" data-stack-pick="${i}"><img src="${escape(l.img)}" alt=""> Layer ${i+1}</button>`).join('');
      const layer=draft.layers[selected];
      const controls=overlay.querySelector('[data-stack-layer-controls]');controls.hidden=!layer;
      if(layer){controls.querySelector('[data-stack-size]').value=layer.size;controls.querySelector('[data-stack-rotation]').value=layer.rotation;controls.querySelector('[data-stack-opacity]').value=layer.opacity;}
      redraw();
    };
    const add=(src)=>{if(!session.active || draft.layers.length>=12)return;const n=draft.layers.length;draft.layers.push(freshLayer(src,50+Math.min(n*9,27),50-Math.min(n*8,24)));selected=n;draw();};
    let drag=null;
    const cleanupDrag=()=>{drag=null;globalThis.window?.removeEventListener('pointermove',move,true);globalThis.window?.removeEventListener('pointerup',end,true);globalThis.window?.removeEventListener('pointercancel',end,true);globalThis.window?.removeEventListener('blur',cancelDrag,true);};
    const cancelDrag=()=>{if(drag)cleanupDrag();};
    const close=apply=>{
      if(app._stackModalCleanup===cancelModal)app._stackModalCleanup=null;
      cleanupDrag();
      doc.removeEventListener('keydown',onKey,true);
      if(apply)session.apply();else session.cancel();
      overlay.remove();redraw();
    };
    const cancelModal=()=>{if(overlay.isConnected)close(false);};
    app._stackModalCleanup?.();
    app._stackModalCleanup=cancelModal;
    const onKey=e=>{if(e.key==='Escape' && overlay.isConnected){e.preventDefault();e.stopImmediatePropagation?.();close(false);}};
    doc.addEventListener('keydown',onKey,true);
    overlay.addEventListener('click',e=>{
      if(e.target.closest('[data-stack-done]')){close(true);return;}
      if(e.target===overlay || e.target.closest('[data-stack-close],[data-stack-cancel]')){close(false);return;}
      const pick=e.target.closest('[data-stack-pick]');if(pick){selected=Number(pick.dataset.stackPick);draw();return;}
      const at=e.target.closest('[data-stack-layer]');if(at){selected=Number(at.dataset.stackLayer);draw();return;}
      if(e.target.closest('[data-stack-add-current]'))add(itemSrc());
      if(e.target.closest('[data-stack-add-other]'))browse(itemSrc(),src=>{if(overlay.isConnected)add(src);});
      if(e.target.closest('[data-stack-delete-layer]')){draft.layers.splice(selected,1);selected=Math.max(0,selected-1);draw();}
    });
    overlay.addEventListener('input',e=>{
      const layer=draft.layers[selected];if(!layer)return;
      if(e.target.matches('[data-stack-size]'))layer.size=Math.max(5,Math.min(250,number(e.target.value,55)));
      if(e.target.matches('[data-stack-rotation]'))layer.rotation=number(e.target.value,0);
      if(e.target.matches('[data-stack-opacity]'))layer.opacity=Math.max(.05,Math.min(1,number(e.target.value,1)));
      const active=stage.querySelector(`[data-stack-layer="${selected}"]`);
      if(active){active.style.width=`${layer.size}%`;active.style.transform=`translate(-50%,-50%) rotate(${layer.rotation}deg)`;active.style.opacity=layer.opacity;}
      // The controls are already updated in-place. Rebuilding the selected
      // control input here detaches it on every keystroke and loses focus.
    });
    const move=e=>{
      if(!drag||drag.id!==e.pointerId)return;
      const layer=draft.layers[drag.index];if(!layer)return;
      const rect=stage.getBoundingClientRect();
      if(drag.mode==='move'){layer.x=Math.max(-50,Math.min(150,Math.round((drag.x+(e.clientX-drag.clientX)/rect.width*100)*10)/10));layer.y=Math.max(-50,Math.min(150,Math.round((drag.y+(e.clientY-drag.clientY)/rect.height*100)*10)/10));}
      else if(drag.mode==='resize')layer.size=Math.max(5,Math.min(250,Math.round(drag.size+(e.clientX-drag.clientX)/rect.width*150)));
      else{
        const ang=Math.atan2(e.clientY-(rect.top+rect.height*layer.y/100),e.clientX-(rect.left+rect.width*layer.x/100));
        // Accumulate the shortest signed angular delta. Unlike absolute atan2
        // subtraction, dragging across -180/180 degrees cannot jump by 360°.
        const delta=Math.atan2(Math.sin(ang-drag.lastAngle),Math.cos(ang-drag.lastAngle));
        layer.rotation=Math.max(-3600,Math.min(3600,Math.round(layer.rotation+delta*180/Math.PI)));
        drag.lastAngle=ang;
      }
      const el=stage.querySelector(`[data-stack-layer="${drag.index}"]`);
      if(el)Object.assign(el.style,{left:`${layer.x}%`,top:`${layer.y}%`,width:`${layer.size}%`,transform:`translate(-50%,-50%) rotate(${layer.rotation}deg)`});
      e.preventDefault();
    };
    const end=()=>{if(!drag)return;cleanupDrag();if(overlay.isConnected)draw();};
    stage.addEventListener('pointerdown',e=>{
      const el=e.target.closest('[data-stack-layer]');if(!el||e.button!==0)return;
      selected=Number(el.dataset.stackLayer);const layer=draft.layers[selected];const rect=stage.getBoundingClientRect();
      drag={id:e.pointerId,index:selected,mode:e.target.closest('[data-stack-resize]')?'resize':e.target.closest('[data-stack-rotate]')?'rotate':'move',x:layer.x,y:layer.y,size:layer.size,rotation:layer.rotation,clientX:e.clientX,clientY:e.clientY,lastAngle:Math.atan2(e.clientY-(rect.top+rect.height*layer.y/100),e.clientX-(rect.left+rect.width*layer.x/100))};
      globalThis.window?.addEventListener('pointermove',move,true);globalThis.window?.addEventListener('pointerup',end,true);globalThis.window?.addEventListener('pointercancel',end,true);globalThis.window?.addEventListener('blur',cancelDrag,true);e.preventDefault();
    });
    (root.closest('.buxa-item-config-app')||root).append(overlay);draw();overlay.focus();
  };
  root.querySelector('[data-stack-add-rule]')?.addEventListener('click',()=>{
    const thresholds=new Set(app._stackImagesDraft.map(r=>r.at));let at=2;while(thresholds.has(at))at++;
    app._stackImagesDraft.push({at,mode:'image',img:root.querySelector('[data-item-image]')?.value||app.item?.img||'',layers:[]});redraw();
  });
  list.addEventListener('change',e=>{
    const row=e.target.closest('[data-stack-rule-index]');if(!row)return;const rule=app._stackImagesDraft[Number(row.dataset.stackRuleIndex)];
    if(e.target.matches('[data-stack-at]')){
      const next=Math.max(2,Math.min(999999,Math.round(number(e.target.value,2))));
      if(app._stackImagesDraft.some(other=>other!==rule && other.at===next)) {
        globalThis.ui?.notifications?.warn?.('Each stack image needs a unique quantity threshold.');
        e.target.value=rule.at;
        return;
      }
      rule.at=next;
    }
    if(e.target.matches('[data-stack-mode]')){
      rule.mode=e.target.value==='custom'?'custom':'image';
      if(rule.mode==='custom'&&!rule.layers.length)rule.layers=[freshLayer(root.querySelector('[data-item-image]')?.value||app.item?.img||'')];
    }
    redraw();
  });
  list.addEventListener('click',e=>{
    const row=e.target.closest('[data-stack-rule-index]');if(!row)return;const i=Number(row.dataset.stackRuleIndex),rule=app._stackImagesDraft[i];
    if(e.target.closest('[data-stack-remove]')){app._stackImagesDraft.splice(i,1);redraw();}
    if(e.target.closest('[data-stack-edit]')){
      if(rule.mode==='custom')openEditor(rule);
      else browse(rule.img,path=>{if(!app._stackImagesDraft.includes(rule)||!root.isConnected)return;rule.img=path;redraw();});
    }
  });
  redraw();
}
