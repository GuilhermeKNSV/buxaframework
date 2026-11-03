import { MODULE_ID, SETTINGS } from "./constants.js";

/** Client-owned image-library bookmarks; never modify world or user assets. */
export function registerAssetBrowserSettings() {
  game.settings.register(MODULE_ID, SETTINGS.ASSET_FAVORITES, {
    name: "Buxa Image Library Favorites",
    scope: "client", config: false, type: Object,
    default: { data: { folders: [], images: [] }, public: { folders: [], images: [] } }
  });
}
