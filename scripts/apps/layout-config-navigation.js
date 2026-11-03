const PLAYER_SHEET_TABS = new Set([
  "basic",
  "resources",
  "level",
  "attributes",
  "stats",
  "proficiencies",
  "rebirths"
]);

const ROOT_SECTIONS = new Set(["player-sheet", "inventory", "items", "addons", "ui", "npc"]);
const UI_TABS = new Set(["warning", "item-ui"]);

/** Paint one sliding selection indicator; never change navigation semantics. */
function animateConfigNavigation(root) {
  const update = () => {
    if (!root?.isConnected) return;
    const tree = root.querySelector('.buxa-config-tree');
    const chosen = tree?.querySelector('button.is-selected');
    if (tree && chosen?.offsetHeight && tree.style?.setProperty) {
      tree.style.setProperty('--bc-active-y', `${chosen.offsetTop}px`);
      tree.style.setProperty('--bc-active-h', `${chosen.offsetHeight}px`);
      tree.style.setProperty('--bc-active-ready', '1');
    }
    for (const tabs of root.querySelectorAll('.buxa-config-tabs:not([hidden])')) {
      const selected = tabs.querySelector('button.is-active');
      if (!selected?.offsetWidth || !tabs.style?.setProperty) continue;
      tabs.style.setProperty('--bc-tab-x', `${selected.offsetLeft}px`);
      tabs.style.setProperty('--bc-tab-w', `${selected.offsetWidth}px`);
      tabs.style.setProperty('--bc-tab-ready', '1');
    }
  };
  const raf = root.ownerDocument?.defaultView?.requestAnimationFrame;
  if (typeof raf === 'function') raf(update);
  else update();
}

export function applyConfigNavigation(app) {
  const root = app?.element;
  if (!root) return;

  if (!PLAYER_SHEET_TABS.has(app._activeTab)) app._activeTab = "basic";
  if (!ROOT_SECTIONS.has(app._activeSection)) app._activeSection = "player-sheet";
  if (!UI_TABS.has(app._activeUiTab)) app._activeUiTab = "warning";

  root.querySelectorAll("[data-config-section]").forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.configSection === app._activeSection);
  });

  const tabs = root.querySelector("[data-player-sheet-tabs]");
  if (tabs) tabs.hidden = app._activeSection !== "player-sheet";
  const uiTabs = root.querySelector("[data-ui-tabs]");
  if (uiTabs) uiTabs.hidden = app._activeSection !== "ui";

  root.querySelectorAll("[data-config-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.configTab === app._activeTab);
  });

  root.querySelectorAll("[data-config-ui-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.configUiTab === app._activeUiTab);
  });

  const visiblePanel = app._activeSection === "player-sheet"
    ? app._activeTab
    : app._activeSection === "ui" ? `ui-${app._activeUiTab}` : app._activeSection;
  root.querySelectorAll("[data-config-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.configPanel !== visiblePanel;
  });

  const heading = root.querySelector("[data-config-heading]");
  if (heading) {
    const headings = {
      "player-sheet": "Player Sheet",
      inventory: "Inventory",
      items: "Items",
      addons: "Addons",
      npc: "NPC",
      ui: "UI"
    };
    heading.textContent = headings[app._activeSection] ?? "Player Sheet";
  }
  animateConfigNavigation(root);
}

export function bindConfigNavigation(app) {
  const root = app?.element;
  if (!root) return;

  root.querySelectorAll("[data-config-section]").forEach((button) => {
    button.addEventListener("click", () => {
      app._activeSection = button.dataset.configSection || "player-sheet";
      applyConfigNavigation(app);
    });
  });

  root.querySelectorAll("[data-config-ui-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      app._activeSection = "ui";
      app._activeUiTab = button.dataset.configUiTab || "warning";
      applyConfigNavigation(app);
    });
  });

  root.querySelectorAll("[data-config-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      app._activeSection = "player-sheet";
      app._activeTab = button.dataset.configTab || "basic";
      applyConfigNavigation(app);
    });
  });
}
