import { BuxaAssetBrowser } from "./asset-browser.js";

export function openIconSourcePicker(app) {
  const root = app?.element;
  const sourceInput = root?.querySelector?.("[data-addon-icon-source-source]");
  const pathInput = root?.querySelector?.("[data-addon-icon-source-path]");
  const source = ["data", "public"].includes(sourceInput?.value) ? sourceInput.value : "data";
  const target = String(pathInput?.value || "").trim();

  new BuxaAssetBrowser({
    type: "image",
    extensions: ["svg"],
    source,
    target,
    current: "",
    allowClear: false,
    allowDirectorySelect: true,
    title: "Buxa · Icon Source Folder",
    onSelect: async (path, meta = {}) => {
      const nextSource = meta.source || source;
      if (sourceInput) sourceInput.value = nextSource;
      if (pathInput) pathInput.value = path;
      const display = root?.querySelector?.("[data-addon-icon-source-display]");
      if (display) display.textContent = path || "ROOT";
      const sourceDisplay = root?.querySelector?.("[data-addon-icon-source-source-display]");
      if (sourceDisplay) sourceDisplay.textContent = nextSource === "public" ? "CORE DATA" : "USER DATA";
    }
  }).render({ force: true });
}
