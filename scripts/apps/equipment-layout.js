import { enableWindowResize } from "./window-resize.js";
import { TEMPLATE_PATHS } from "../core/constants.js";
import { getSheetConfig } from "../core/config.js";
import { getEquipmentSvgIcon } from "../core/icons.js";
import { BuxaAssetBrowser } from "./asset-browser.js";
import {
  EQUIPMENT_SLOT_DEFINITIONS,
  INVENTORY_SIZE_PATTERNS,
  createEquipmentSlot,
  duplicateEquipmentSlot,
  getInventorySizePattern,
  normalizeInventoryConfig
} from "../core/inventory-config.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

function clone(value) { return foundry.utils.deepClone(value); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); }
function normalizedLayout(layout) { return normalizeInventoryConfig({ slots: 1, equipmentLayout: layout }).equipmentLayout; }

function slotBackground(slot) {
  const custom = String(slot?.background || "").trim();
  if (custom) return custom;
  return getSheetConfig().addons.svgIcons.enabled ? getEquipmentSvgIcon(slot?.type) : "";
}

function slotStyle(slot, layout) {
  const size = getInventorySizePattern(slot.size);
  return [
    `--buxa-designer-x:${slot.x}`,
    `--buxa-designer-y:${slot.y}`,
    `--buxa-designer-w:${size.width}`,
    `--buxa-designer-h:${size.height}`,
    `--buxa-designer-columns:${layout.columns}`,
    `--buxa-designer-rows:${layout.rows}`,
    `--buxa-designer-color:${slot.color || "#344052"}`
  ].join(";");
}

export class BuxaEquipmentLayout extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "buxa-equipment-layout",
    classes: ["buxa", "buxa-equipment-layout-app"],
    tag: "div",
    position: { width: 1040, height: 760 },
    window: { title: "Buxa Framework · Equipment Layout", icon: "fa-solid fa-shirt", resizable: true },
    actions: {
      addEquipmentSlot: BuxaEquipmentLayout.#addEquipmentSlot,
      duplicateEquipmentSlot: BuxaEquipmentLayout.#duplicateEquipmentSlot,
      deleteEquipmentSlot: BuxaEquipmentLayout.#deleteEquipmentSlot,
      browseEquipmentBackground: BuxaEquipmentLayout.#browseEquipmentBackground,
      saveEquipmentLayout: BuxaEquipmentLayout.#saveEquipmentLayout,
      cancelEquipmentLayout: BuxaEquipmentLayout.#cancelEquipmentLayout
    }
  };

  static PARTS = { body: { template: TEMPLATE_PATHS.EQUIPMENT_LAYOUT } };

  constructor({ layout, onSave, ...options } = {}) {
    super({ id: `buxa-equipment-layout-${foundry.utils.randomID(5).toLowerCase()}`, ...options });
    this._layout = normalizedLayout(layout);
    this._onSaveLayout = typeof onSave === "function" ? onSave : null;
    this._selectedSlotId = this._layout.slots[0]?.id ?? null;
    this._placementSlot = null;
    this._activeEquipmentTab = this._layout.tabs[0]?.id || "main";
  }

  #tab() {return this._layout.tabs.find(t=>t.id===this._activeEquipmentTab) || this._layout.tabs[0];}
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const tab=this.#tab();
    this._layout.columns=tab.columns;this._layout.rows=tab.rows;
    return {
      equipmentTabs:this._layout.tabs.map(t=>({...t,active:t.id===tab.id})),
      activeEquipmentTab:tab,
      ...context,
      layout: clone(this._layout),
      canvasStyle: `--buxa-designer-columns:${this._layout.columns};--buxa-designer-rows:${this._layout.rows}`,
      slotTypes: EQUIPMENT_SLOT_DEFINITIONS,
      sizePatterns: INVENTORY_SIZE_PATTERNS,
      slots: this._layout.slots.filter(slot=>slot.tabId===tab.id).map((slot) => {
        const background = slotBackground(slot);
        return { ...slot, background, style: slotStyle(slot, this._layout), hasBackground: Boolean(background), selected: slot.id === this._selectedSlotId };
      })
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    enableWindowResize(this);
    this._placementSlot = null;
    const root = this.element;
    const canvas = root?.querySelector?.("[data-equipment-layout-canvas]");
    if (!root || !canvas) return;
    root.querySelectorAll('[data-designer-tab]').forEach(button=>button.addEventListener('click',()=>{
      this._activeEquipmentTab=button.dataset.designerTab;
      this._selectedSlotId=this._layout.slots.find(s=>s.tabId===this._activeEquipmentTab)?.id||null;
      void this.render({force:true});
    }));
    root.querySelector('[data-tab-add]')?.addEventListener('click',()=>{
      if (this._layout.tabs.length >= 16) {
        globalThis.ui?.notifications?.warn?.('Equipment layouts support up to 16 tabs.');
        return;
      }
      const id='tab-'+(foundry.utils.randomID?.(6)||Math.random().toString(36).slice(2,8));
      const current=this.#tab();this._layout.tabs.push({id,label:'New tab',columns:current.columns,rows:current.rows});
      this._activeEquipmentTab=id;this._selectedSlotId=null;void this.render({force:true});
    });
    root.querySelector('[data-tab-rename]')?.addEventListener('change',e=>{
      const label=String(e.target.value).trim().slice(0,32)||'Tab';
      if(this._layout.tabs.some(tab=>tab.id!==this._activeEquipmentTab && tab.label.toLowerCase()===label.toLowerCase())) {
        e.target.value=this.#tab().label;
        globalThis.ui?.notifications?.warn?.('Choose a different equipment tab name.');
        return;
      }
      this.#tab().label=label;
    });
    root.querySelector('[data-tab-remove]')?.addEventListener('click',async()=>{
      if(this._layout.tabs.length<=1)return;
      const current=this.#tab().id;const fallback=this._layout.tabs.find(t=>t.id!==current).id;
      const count=this._layout.slots.filter(slot=>slot.tabId===current).length;
      if(count){
        const confirm=globalThis.foundry?.applications?.api?.DialogV2?.confirm;
        if(typeof confirm!=='function') return;
        const accepted=await confirm({window:{title:'Remove equipment tab'},
          content:`<p>Delete this tab and its ${count} equipment slots? This cannot be undone after saving.</p>`,
          yes:{label:'Delete tab and slots'},no:{label:'Cancel'},modal:true});
        if(!accepted) return;
      }
      this._layout.slots=this._layout.slots.filter(slot=>slot.tabId!==current);
      this._layout.tabs=this._layout.tabs.filter(t=>t.id!==current);
      this._activeEquipmentTab=fallback;this._selectedSlotId=this._layout.slots.find(s=>s.tabId===fallback)?.id||null;
      void this.render({force:true});
    });

    root.querySelector("[data-layout-snap]")?.addEventListener("change", (event) => {
      this._layout.snapToGrid = Boolean(event.currentTarget.checked);
    });
    const resizeLayout = () => this.#resizeLayout(root);
    root.querySelector("[data-layout-columns]")?.addEventListener("change", resizeLayout);
    root.querySelector("[data-layout-rows]")?.addEventListener("change", resizeLayout);

    for (const element of root.querySelectorAll("[data-designer-slot]")) {
      element.addEventListener("click", (event) => {
        if (this._placementSlot) return;
        event.preventDefault();
        this.#selectSlot(element.dataset.designerSlot);
      });
      element.addEventListener("contextmenu", (event) => {
        if (this._placementSlot) return;
        event.preventDefault();
        event.stopPropagation();
        this.#selectSlot(element.dataset.designerSlot);
        this.#showContextMenu(event);
      });
      element.addEventListener("pointerdown", (event) => this.#startSlotDrag(event, element, canvas));
    }

    this.#bindInspector(root.querySelector("[data-slot-inspector]"));
    root.querySelector("[data-slot-context-color]")?.addEventListener("input", (event) => {
      const slot = this.#selectedSlot();
      if (!slot) return;
      slot.color = event.currentTarget.value;
      this.#slotElement(slot.id)?.style.setProperty("--buxa-designer-color", slot.color);
    });
    root.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest("[data-slot-context-menu]")) return;
      this.#hideContextMenu();
    });

    canvas.addEventListener("pointermove", (event) => this.#movePlacementGhost(event, canvas));
    canvas.addEventListener("pointerdown", (event) => {
      if (!this._placementSlot || event.button !== 0) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      this.#placeCopiedSlot(event, canvas);
    }, true);
    canvas.addEventListener("contextmenu", (event) => {
      if (!this._placementSlot) return;
      event.preventDefault();
      this.#cancelCopyPlacement(canvas);
    });

    this.#selectSlot(this._selectedSlotId);
  }

  #resizeLayout(root) {
    const columns = clamp(root.querySelector("[data-layout-columns]")?.value, 4, 24);
    const requestedRows = clamp(root.querySelector("[data-layout-rows]")?.value, 1, 24);
    const minimumRows = Math.max(1, ...this._layout.slots.filter(slot=>slot.tabId===this._activeEquipmentTab).map((slot) => getInventorySizePattern(slot.size).height));
    this._layout.columns = Math.round(columns);
    this._layout.rows = Math.max(minimumRows, Math.round(requestedRows));
    Object.assign(this.#tab(),{columns:this._layout.columns,rows:this._layout.rows});
    for (const slot of this._layout.slots.filter(s=>s.tabId===this._activeEquipmentTab)) this.#clampSlot(slot);
    void this.render({ force: true });
  }

  #bindInspector(inspector) {
    inspector?.querySelector("[data-slot-label]")?.addEventListener("input", (event) => {
      const slot = this.#selectedSlot();
      if (!slot) return;
      slot.label = String(event.currentTarget.value || "").slice(0, 40);
      const element = this.#slotElement(slot.id);
      const label = element?.querySelector("[data-designer-slot-label]");
      if (label) label.textContent = slot.label;
      if (element) element.title = slot.label;
    });
    inspector?.querySelector("[data-slot-size]")?.addEventListener("change", (event) => {
      const slot = this.#selectedSlot();
      if (!slot) return;
      slot.size = INVENTORY_SIZE_PATTERNS.some((entry) => entry.id === event.currentTarget.value) ? event.currentTarget.value : "small";
      const pattern = getInventorySizePattern(slot.size);
      if (pattern.height > this._layout.rows) this._layout.rows = pattern.height;
      this.#clampSlot(slot);
      void this.render({ force: true });
    });
    inspector?.querySelector("[data-slot-hidden]")?.addEventListener("change", event=>{
      const slot=this.#selectedSlot();if(slot)slot.hidden=event.currentTarget.checked;
    });
    inspector?.querySelector("[data-slot-capacity]")?.addEventListener("change", (event) => {
      const slot = this.#selectedSlot();
      if (!slot) return;
      slot.capacity = Math.max(1, Math.min(12, Math.round(Number(event.currentTarget.value) || 1)));
      event.currentTarget.value = String(slot.capacity);
      const badge = this.#slotElement(slot.id)?.querySelector?.("[data-designer-slot-capacity]");
      if (badge) badge.textContent = `×${slot.capacity}`;
    });
    inspector?.querySelector("[data-slot-background]")?.addEventListener("input", (event) => {
      const slot = this.#selectedSlot();
      if (!slot) return;
      slot.background = String(event.currentTarget.value || "").trim().slice(0, 500);
      this.#syncSlotBackground(slot);
    });
  }

  #selectedSlot() { return this._layout.slots.find((slot) => slot.id === this._selectedSlotId) ?? null; }
  #slotElement(slotId) { return this.element?.querySelector?.(`[data-designer-slot="${CSS.escape(slotId)}"]`) ?? null; }

  #clampSlot(slot) {
    const size = getInventorySizePattern(slot.size);
    slot.x = clamp(slot.x, 0, Math.max(0, this._layout.columns - size.width));
    slot.y = clamp(slot.y, 0, Math.max(0, this._layout.rows - size.height));
  }

  #selectSlot(slotId) {
    const slot = this._layout.slots.find((entry) => entry.id === slotId) ?? null;
    this._selectedSlotId = slot?.id ?? null;
    this.element?.querySelectorAll?.("[data-designer-slot]").forEach((element) => {
      element.classList.toggle("is-selected", element.dataset.designerSlot === this._selectedSlotId);
    });
    const inspector = this.element?.querySelector?.("[data-slot-inspector]");
    if (!inspector) return;
    inspector.hidden = !slot;
    if (!slot) return;
    const pairs = [
      ["[data-slot-label]", slot.label], ["[data-slot-size]", slot.size],
      ["[data-slot-capacity]", String(slot.capacity)], ["[data-slot-background]", slot.background || ""]
    ];
    const hidden=inspector.querySelector("[data-slot-hidden]");if(hidden)hidden.checked=slot.hidden===true;
    for (const [selector, value] of pairs) {
      const input = inspector.querySelector(selector);
      if (input) input.value = value;
    }
    const type = inspector.querySelector("[data-slot-type-name]");
    if (type) type.textContent = EQUIPMENT_SLOT_DEFINITIONS.find((entry) => entry.id === slot.type)?.label ?? slot.type;
  }

  #syncSlotElement(slot, element = this.#slotElement(slot.id)) {
    if (!element) return;
    const size = getInventorySizePattern(slot.size);
    element.style.setProperty("--buxa-designer-x", slot.x);
    element.style.setProperty("--buxa-designer-y", slot.y);
    element.style.setProperty("--buxa-designer-w", size.width);
    element.style.setProperty("--buxa-designer-h", size.height);
    element.style.setProperty("--buxa-designer-color", slot.color);
  }

  #syncSlotBackground(slot) {
    const element = this.#slotElement(slot.id);
    if (!element) return;
    let image = element.querySelector("[data-designer-slot-bg]");
    const background = slotBackground(slot);
    if (!background) return image?.remove();
    if (!image) {
      image = element.ownerDocument.createElement("img");
      image.className = "buxa-equipment-designer-slot-bg";
      image.dataset.designerSlotBg = "";
      image.alt = "";
      element.prepend(image);
    }
    image.src = background;
  }

  #showContextMenu(event) {
    const menu = this.element?.querySelector?.("[data-slot-context-menu]");
    const slot = this.#selectedSlot();
    if (!menu || !slot) return;
    const hostRect = (menu.offsetParent || this.element).getBoundingClientRect();
    const color = menu.querySelector("[data-slot-context-color]");
    if (color) color.value = slot.color;
    menu.hidden = false;
    const width = menu.offsetWidth || 160;
    const height = menu.offsetHeight || 90;
    menu.style.left = `${clamp(event.clientX - hostRect.left, 6, hostRect.width - width - 6)}px`;
    menu.style.top = `${clamp(event.clientY - hostRect.top, 6, hostRect.height - height - 6)}px`;
  }

  #hideContextMenu() {
    const menu = this.element?.querySelector?.("[data-slot-context-menu]");
    if (menu) menu.hidden = true;
  }

  #startSlotDrag(event, element, canvas) {
    if (event.button !== 0 || this._placementSlot) return;
    const slot = this._layout.slots.find((entry) => entry.id === element.dataset.designerSlot);
    if (!slot) return;
    event.preventDefault();
    this.#hideContextMenu();
    this.#selectSlot(slot.id);
    element.classList.add("is-dragging");
    const canvasRect = canvas.getBoundingClientRect();
    const slotRect = element.getBoundingClientRect();
    const grabX = event.clientX - slotRect.left;
    const grabY = event.clientY - slotRect.top;
    const view = element.ownerDocument?.defaultView ?? window;
    const move = (moveEvent) => {
      const size = getInventorySizePattern(slot.size);
      let x = ((moveEvent.clientX - canvasRect.left - grabX) / canvasRect.width) * this._layout.columns;
      let y = ((moveEvent.clientY - canvasRect.top - grabY) / canvasRect.height) * this._layout.rows;
      const precision = this._layout.snapToGrid ? 1 : 20;
      x = Math.round(x * precision) / precision;
      y = Math.round(y * precision) / precision;
      slot.x = clamp(x, 0, Math.max(0, this._layout.columns - size.width));
      slot.y = clamp(y, 0, Math.max(0, this._layout.rows - size.height));
      this.#syncSlotElement(slot);
    };
    const end = () => {
      element.classList.remove("is-dragging");
      view.removeEventListener("pointermove", move);
      view.removeEventListener("pointerup", end);
      view.removeEventListener("pointercancel", end);
    };
    view.addEventListener("pointermove", move);
    view.addEventListener("pointerup", end, { once: true });
    view.addEventListener("pointercancel", end, { once: true });
  }

  #placementPosition(event, canvas, slot) {
    const rect = canvas.getBoundingClientRect();
    const size = getInventorySizePattern(slot.size);
    let x = ((event.clientX - rect.left) / rect.width) * this._layout.columns - (size.width / 2);
    let y = ((event.clientY - rect.top) / rect.height) * this._layout.rows - (size.height / 2);
    const precision = this._layout.snapToGrid ? 1 : 20;
    x = Math.round(x * precision) / precision;
    y = Math.round(y * precision) / precision;
    return {
      x: clamp(x, 0, Math.max(0, this._layout.columns - size.width)),
      y: clamp(y, 0, Math.max(0, this._layout.rows - size.height))
    };
  }

  #movePlacementGhost(event, canvas) {
    if (!this._placementSlot) return;
    Object.assign(this._placementSlot, this.#placementPosition(event, canvas, this._placementSlot));
    const ghost = canvas.querySelector("[data-placement-ghost]");
    this.#syncSlotElement(this._placementSlot, ghost);
  }

  #startCopyPlacement(copy) {
    this._placementSlot = copy;
    this.#hideContextMenu();
    const canvas = this.element?.querySelector?.("[data-equipment-layout-canvas]");
    if (!canvas) return;
    const ghost = canvas.ownerDocument.createElement("article");
    ghost.className = "buxa-equipment-designer-slot is-placement-ghost";
    ghost.dataset.placementGhost = "";
    ghost.innerHTML = `<span>${foundry.utils.escapeHTML(copy.label)}</span><small>${copy.size} <b>×${copy.capacity}</b></small>`;
    const background = slotBackground(copy);
    if (background) {
      const image = canvas.ownerDocument.createElement("img");
      image.className = "buxa-equipment-designer-slot-bg";
      image.src = background;
      image.alt = "";
      ghost.prepend(image);
    }
    canvas.append(ghost);
    this.#syncSlotElement(copy, ghost);
    canvas.classList.add("is-copy-placement");
  }

  #placeCopiedSlot(event, canvas) {
    const copy = this._placementSlot;
    if (!copy) return;
    Object.assign(copy, this.#placementPosition(event, canvas, copy));
    copy.tabId=this._activeEquipmentTab;
    this._layout.slots.push(copy);
    this._selectedSlotId = copy.id;
    this._placementSlot = null;
    void this.render({ force: true });
  }

  #cancelCopyPlacement(canvas) {
    this._placementSlot = null;
    canvas?.querySelector?.("[data-placement-ghost]")?.remove();
    canvas?.classList?.remove("is-copy-placement");
  }

  static #addEquipmentSlot(_event, target) {
    const slot = createEquipmentSlot(target.dataset.slotType, this._layout.slots, { columns: this._layout.columns, rows: this._layout.rows });
    slot.tabId=this._activeEquipmentTab;
    this._layout.slots.push(slot);
    this._selectedSlotId = slot.id;
    void this.render({ force: true });
  }

  static #duplicateEquipmentSlot() {
    const selected = this.#selectedSlot();
    if (!selected) return;
    const copy = duplicateEquipmentSlot(selected, this._layout.slots, { columns: this._layout.columns, rows: this._layout.rows });
    this.#clampSlot(copy);
    this.#startCopyPlacement(copy);
  }

  static #deleteEquipmentSlot() {
    const selected = this.#selectedSlot();
    if (!selected) return;
    this.#hideContextMenu();
    this._layout.slots = this._layout.slots.filter((slot) => slot.id !== selected.id);
    this._selectedSlotId = this._layout.slots[0]?.id ?? null;
    void this.render({ force: true });
  }

  static async #browseEquipmentBackground() {
    const selected = this.#selectedSlot();
    const input = this.element?.querySelector?.("[data-slot-background]");
    if (!selected || !input) return;
    const picker = new BuxaAssetBrowser({
      type: "image",
      current: selected.background || "",
      title: `Buxa · ${selected.label || "Equipment"} Background`,
      onSelect: async (path) => {
        selected.background = String(path || "");
        input.value = selected.background;
        this.#syncSlotBackground(selected);
      }
    });
    await picker.render({ force: true });
  }

  static async #saveEquipmentLayout() {
    this._layout = normalizedLayout(this._layout);
    await this._onSaveLayout?.(clone(this._layout));
    await this.close();
  }

  static async #cancelEquipmentLayout() { await this.close(); }
}
