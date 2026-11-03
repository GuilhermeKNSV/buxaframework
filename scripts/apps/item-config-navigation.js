/** Item configuration navigation: presentation-only grouping of existing editors.
 * The actual controls (and their input names/data attributes) are moved, never
 * cloned, so each form field is saved once by the existing Item rule handlers.
 */
export const ITEM_CONFIG_GROUPS = Object.freeze([
  { id: "overview", label: "Overview", icon: "fa-circle-info", tabs: [
    ["info", "Identity", "fa-tag"], ["description", "Description", "fa-align-left"],
    ["details", "Properties", "fa-sliders"]
  ] },
  { id: "function", label: "Function", icon: "fa-gears", tabs: [
    ["dice", "Dice", "fa-dice-d20"], ["resource", "Resources", "fa-heart-pulse"],
    ["increase", "Increases", "fa-arrow-trend-up"], ["limits", "Limits & Recharge", "fa-hourglass-half"],
    ["stack", "Stacking", "fa-layer-group"], ["equipment", "Equipment", "fa-shirt"],
    ["storage", "Storage", "fa-box-open"]
  ] },
  { id: "visuals", label: "Visuals", icon: "fa-palette", tabs: [
    ["image", "Image", "fa-image"], ["equipSize", "Equip Size", "fa-shirt"], ["size", "Size & Shape", "fa-table-cells-large"],
    ["stackArt", "Stack Artwork", "fa-images"], ["decorations", "Decorations", "fa-wand-magic-sparkles"]
  ] },
  { id: "access", label: "Access", icon: "fa-shield-halved", tabs: [
    ["control", "Discovery", "fa-unlock-keyhole"], ["ground", "Ground Rules", "fa-lock"]
  ] }
]);

const ALL_TABS = new Map(ITEM_CONFIG_GROUPS.flatMap(group => group.tabs.map(([id]) => [id, group.id])));
const LEGACY_TAB_ALIASES = { basic: "details" };

function addButton(doc, dataset, label, icon) {
  const button = doc.createElement("button");
  button.type = "button";
  for (const [key, value] of Object.entries(dataset)) button.dataset[key] = value;
  const glyph = doc.createElement("i");
  glyph.className = `fa-solid ${icon}`;
  glyph.setAttribute("aria-hidden", "true");
  const text = doc.createElement("span");
  text.textContent = label;
  button.append(glyph, text);
  return button;
}

function makePanel(doc, id) {
  const panel = doc.createElement("div");
  panel.className = "buxa-item-config-stack";
  panel.dataset.itemConfigPanel = id;
  panel.hidden = true;
  return panel;
}

function rehome(root, panels, source, selector, destination) {
  const element = panels[source]?.querySelector(selector);
  if (!element || !panels[destination]) return false;
  panels[destination].append(element);
  return true;
}

/** Called once after mountItemUseEditor, before setting active tabs or rule editors. */
export function mountItemConfigNavigation(root, { activeTab = "info", onSelect = () => {} } = {}) {
  const doc = root?.ownerDocument;
  const mainNav = root?.querySelector?.(".buxa-item-config-tabs");
  const scroll = root?.querySelector?.(".buxa-item-config-scroll");
  if (!doc || !mainNav || !scroll) return null;

  const panels = Object.fromEntries([...root.querySelectorAll("[data-item-config-panel]")]
    .map(panel => [panel.dataset.itemConfigPanel, panel]));
  // Base / usage / storage panels exist before we touch the DOM. If a dynamic
  // editor was not mounted, do not replace navigation with unusable empty tabs.
  if (!ITEM_CONFIG_GROUPS.every(group => group.tabs.every(([id]) =>
    Boolean(panels[id] || ["description", "details", "equipment", "storage", "stackArt", "decorations", "ground", "equipSize"].includes(id))))) return null;

  for (const id of ["description", "equipment", "storage", "stackArt", "decorations", "ground", ...(!panels.equipSize ? ["equipSize"] : [])]) {
    panels[id] = makePanel(doc, id);
    scroll.append(panels[id]);
  }
  // The Basic panel contains the level and weight properties once the ground,
  // equipment and storage sections have been moved to their own pages.
  panels.details = panels.basic;
  rehome(root, panels, "info", ".buxa-description-builder", "description");
  rehome(root, panels, "basic", ".buxa-ground-loot-policy", "ground");
  rehome(root, panels, "basic", ".buxa-item-equip-config", "equipment");
  rehome(root, panels, "basic", ".buxa-storage-config", "storage");
  rehome(root, panels, "basic", "template[data-storage-external-template]", "storage");
  rehome(root, panels, "stack", ".buxa-stack-image-section", "stackArt");
  rehome(root, panels, "dice", ".buxa-item-decoration-head", "decorations");
  rehome(root, panels, "dice", "[data-item-decoration-list]", "decorations");
  // The image browser still updates the identity thumbnail, but its image path
  // is configured beside the Board Image preview in Visuals > Image.
  const imageField = panels.info?.querySelector(".buxa-item-image-path");
  if (imageField && panels.image) {
    const section = doc.createElement("section");
    section.className = "buxa-item-config-section buxa-item-artwork-path";
    const title = doc.createElement("header");
    const heading = doc.createElement("strong");
    heading.textContent = "ITEM ARTWORK";
    title.append(heading);
    const body = doc.createElement("div");
    body.className = "buxa-item-config-section-body";
    body.append(imageField);
    section.append(title, body);
    panels.image.prepend(section);
  }
  panels.details.dataset.itemConfigPanel = "details";
  delete panels.basic;

  const subNav = doc.createElement("nav");
  subNav.className = "buxa-item-config-subtabs";
  subNav.setAttribute("aria-label", "Item configuration sub-tabs");
  subNav.setAttribute("role", "tablist");
  mainNav.classList.add("buxa-item-config-group-nav");
  mainNav.setAttribute("aria-label", "Item configuration categories");
  mainNav.setAttribute("role", "tablist");
  const groupButtons = new Map();
  const subButtons = new Map();
  const groupItems = [];
  const subItems = [];
  for (const group of ITEM_CONFIG_GROUPS) {
    const button = addButton(doc, { itemGroupTab: group.id }, group.label, group.icon);
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", "false");
    button.tabIndex = -1;
    groupButtons.set(group.id, button);
    groupItems.push(button);
    for (const [id, label, icon] of group.tabs) {
      const subButton = addButton(doc, { itemConfigTab: id, group: group.id }, label, icon);
      subButton.setAttribute("role", "tab");
      subButton.hidden = true;
      subButton.setAttribute("aria-selected", "false");
      subButton.tabIndex = -1;
      subButtons.set(id, subButton);
      subItems.push(subButton);
      panels[id].setAttribute("role", "tabpanel");
      panels[id].setAttribute("aria-label", `${group.label}: ${label}`);
    }
  }
  mainNav.replaceChildren(...groupItems);
  subNav.append(...subItems);
  mainNav.after(subNav);
  // Explicitly arrange panels by category and sub-tab order. This also keeps
  // hidden template nodes in the DOM for the existing add-row workflows.
  for (const group of ITEM_CONFIG_GROUPS) for (const [id] of group.tabs) scroll.append(panels[id]);

  let selectedTab = null;
  function activate(tab, { resetScroll = false } = {}) {
    const resolved = LEGACY_TAB_ALIASES[tab] || tab;
    const nextTab = ALL_TABS.has(resolved) ? resolved : "info";
    if (selectedTab === nextTab) return;
    const previousTab = selectedTab;
    const previousGroup = previousTab ? ALL_TABS.get(previousTab) : null;
    const selectedGroup = ALL_TABS.get(nextTab);
    const selectButton = (button, selected) => {
      if (!button) return;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    };
    if (previousGroup !== selectedGroup) {
      if (previousGroup) selectButton(groupButtons.get(previousGroup), false);
      selectButton(groupButtons.get(selectedGroup), true);
      if (previousGroup) {
        for (const [id] of ITEM_CONFIG_GROUPS.find(group => group.id === previousGroup).tabs) {
          subButtons.get(id).hidden = true;
        }
      }
      for (const [id] of ITEM_CONFIG_GROUPS.find(group => group.id === selectedGroup).tabs) {
        subButtons.get(id).hidden = false;
      }
    }
    if (previousTab) {
      panels[previousTab].hidden = true;
      selectButton(subButtons.get(previousTab), false);
    }
    panels[nextTab].hidden = false;
    selectButton(subButtons.get(nextTab), true);
    selectedTab = nextTab;
    if (resetScroll) scroll.scrollTop = 0;
    onSelect(selectedTab, selectedGroup);
  }
  for (const group of ITEM_CONFIG_GROUPS) {
    groupButtons.get(group.id).addEventListener("click", event => {
      event.preventDefault();
      const preferred = selectedTab && ALL_TABS.get(selectedTab) === group.id
        ? selectedTab : group.tabs[0][0];
      activate(preferred, { resetScroll: true });
    });
    for (const [id] of group.tabs) subButtons.get(id).addEventListener("click", event => {
      event.preventDefault();
      activate(id, { resetScroll: true });
    });
  }
  // Standard accessible tab-list keys; inactive tabs stay out of the normal
  // Tab order but remain reachable via arrow keys, Home and End.
  const installKeyboardNavigation = (nav, buttons) => nav.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const visible = buttons.filter(button => !button.hidden);
    const index = visible.indexOf(event.target);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? visible.length - 1
      : (index + (event.key === "ArrowLeft" ? -1 : 1) + visible.length) % visible.length;
    visible[next].click();
    visible[next].focus?.();
  });
  installKeyboardNavigation(mainNav, groupItems);
  installKeyboardNavigation(subNav, subItems);
  for (const panel of Object.values(panels)) panel.hidden = true;
  activate(activeTab);
  return { activate, get activeTab() { return selectedTab; } };
}
