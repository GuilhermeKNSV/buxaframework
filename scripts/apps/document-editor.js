/** Buxa tabbed Actor/prototype-token editor and selective Actor/Item batch editor. */
import { MODULE_ID } from "../core/constants.js";
import { getSheetConfig } from "../core/config.js";
import { buildDocumentPatch, editorView, getEditorValues } from "./document-editor-fields.js";
import { enableWindowResize } from "./window-resize.js";
import { updateTokenPreview, syncRangePair } from "./document-editor-preview.js";
import { BuxaAssetBrowser } from "./asset-browser.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const TEMPLATE=`modules/${MODULE_ID}/templates/document-editor.hbs`;
const editable = doc => !!(game.user?.isGM && doc && !doc.pack && !doc.parent);
export class BuxaDocumentEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS={
    id:"buxa-document-editor",classes:["buxa","buxa-document-editor"], tag:"form",
    position:{width:930,height:690}, window:{resizable:true,icon:"fa-solid fa-sliders"},
    form:{handler:BuxaDocumentEditor.#submit,closeOnSubmit:false,submitOnChange:false}
  };
  static PARTS={body:{template:TEMPLATE}};
  constructor({kind="Actor",docs=[],forceBatch=false}={}) {
    const chosen=docs.filter(d=>d?.documentName===kind || (!d?.documentName && kind==="Actor"?Boolean(d?.prototypeToken):!!d?.system));
    super({id:`buxa-${kind.toLowerCase()}-editor-${foundry.utils.randomID(8).toLowerCase()}`});
    this.kind=kind;this.docs=chosen;this.batch=forceBatch||chosen.length>1;this.activeTab=kind==="Actor"?"general":"item";
    this._busy=false;
  }
  get title(){return this.batch?`Buxa · Edit ${this.docs.length} ${this.kind}s`:`Buxa · Edit ${this.docs[0]?.name||this.kind}`;}
  _optionsData(){return {canvasConfig:CONFIG.Canvas??{},rarities:getSheetConfig()?.items?.rarities??[]};}
  async _prepareContext(options) {
    const c=await super._prepareContext(options);
    const sections=editorView(this.kind,this.docs[0],this._optionsData());
    return {...c,kind:this.kind,batch:this.batch,count:this.docs.length,sections:sections.map(s=>({...s,active:s.id===this.activeTab})),names:this.docs.slice(0,10).map(d=>d.name),extraCount:Math.max(0,this.docs.length-10),actorPreview:this.kind==="Actor",previewName:this.docs[0]?.name??"Token",previewImage:this.docs[0]?.prototypeToken?.texture?.src||this.docs[0]?.img||"icons/svg/mystery-man.svg"};
  }
  async _onRender(context,options) {
    await super._onRender(context,options);
    enableWindowResize(this);
    this.element.querySelectorAll('[data-buxa-edit-tab]').forEach(button=>button.addEventListener("click",()=>{
      this.activeTab=button.dataset.buxaEditTab;
      this.element.querySelectorAll('[data-buxa-edit-tab]').forEach(el=>{const active=el.dataset.buxaEditTab===this.activeTab;el.classList.toggle("is-active",active);el.setAttribute("aria-selected",String(active));});
      this.element.querySelectorAll('[data-buxa-edit-panel]').forEach(el=>{el.hidden=el.dataset.buxaEditPanel!==this.activeTab;});
    }));
    const refresh = event => {
      const field=event.target.closest?.("[data-buxa-edit-field]");
      if(!field) return;
      if(event.target.matches?.("[data-buxa-range], [data-buxa-value][type=number], [data-buxa-detection-range]")) syncRangePair(field,event.target);
      // Only user input marks a field for single-editor updates. The preview
      // itself never writes documents or dirties fields.
      field.dataset.buxaTouched="1";
      if(this.kind==="Actor") updateTokenPreview(this.element,this.docs[0]);
    };
    this.element.addEventListener("input",refresh);
    this.element.addEventListener("change",refresh);
    this.element.querySelectorAll('.buxa-edit-toggle input').forEach(toggle=>toggle.addEventListener('change',()=>{const text=toggle.closest('label')?.querySelector('.buxa-edit-switch-word');if(text)text.textContent=toggle.checked?'On':'Off';}));
    this.element.querySelectorAll('[data-buxa-edit-field]').forEach(field=>{
      const input=field.querySelector('[data-buxa-apply]');
      if(!input) return;
      const update=()=>{field.classList.toggle("is-unselected",!input.checked);field.querySelectorAll('[data-buxa-value], [data-buxa-range], [data-buxa-detection-type], [data-buxa-detection-range], [data-buxa-pick-art]').forEach(el=>el.disabled=!input.checked);if(this.kind==="Actor")updateTokenPreview(this.element,this.docs[0]);};
      input.addEventListener('change',update);update();
    });
    this.element.querySelectorAll('[data-buxa-pick-art]').forEach(button=>button.addEventListener('click',async()=>{
      const field=button.closest('[data-buxa-edit-field]');
      const input=field?.querySelector('[data-buxa-value]');
      if(!input||button.disabled)return;
      const browser=new BuxaAssetBrowser({type:"image",current:input.value,title:"Buxa · Choose Artwork",onSelect:async path=>{
        if(!path)return;
        input.value=path;
        input.dispatchEvent(new Event("input",{bubbles:true}));
      }});
      await browser.render({force:true});
    }));
    if(this.kind==="Actor")updateTokenPreview(this.element,this.docs[0]);
    this.element.querySelector('[data-buxa-close-editor]')?.addEventListener('click',()=>this.close());
  }
  static async #submit(event) {
    event?.preventDefault?.();
    if(this._busy||!this.docs.length||!game.user?.isGM) return;
    this._busy=true;
    const submit=this.element.querySelector('[data-buxa-save-editor]');if(submit)submit.disabled=true;
    try {
      const {formValues,applied}=getEditorValues(this.element,this.kind,{...this._optionsData(),onlyTouched:!this.batch});
      if(!applied.size){ if(this.batch)ui.notifications?.warn?.("Select at least one field to apply.");return; }
      // Validate all documents before the first update, avoiding partial writes.
      const updates=this.docs.map(doc=>({_id:doc.id,...buildDocumentPatch(doc,this.kind,formValues,applied,this._optionsData())})).filter(p=>Object.keys(p).length>1);
      if(!updates.length){await this.close();return;}
      if(this.kind==="Actor")await Actor.updateDocuments(updates);
      else await Item.updateDocuments(updates);
      await this.close();
    } catch(error){console.error("Buxa | Editor update failed",error);ui.notifications?.error?.(error?.message||"Could not update documents.");}
    finally{this._busy=false;if(submit?.isConnected)submit.disabled=false;}
  }
}
export function openActorEditor(actor) {
  if(!editable(actor))return null;
  return new BuxaDocumentEditor({kind:"Actor",docs:[actor]}).render({force:true});
}
export function openBatchEditor(kind,docs) {
  if(!game.user?.isGM || !["Actor","Item"].includes(kind))return null;
  const valid=[...new Map(docs.filter(d=>editable(d)).map(d=>[d.id,d])).values()];
  if(!valid.length)return null;
  return new BuxaDocumentEditor({kind,docs:valid,forceBatch:true}).render({force:true});
}
