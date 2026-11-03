# Buxa Framework v0.13.38 — Image Library Rebuild

- Replaced the previous asset-browser implementation and stylesheet with a standalone image picker, using the legacy UI **only as a visual reference** (no legacy code imported or copied).
- Redesigned the modal with a browsable sidebar folder tree, favorite folders, searchable artwork gallery, large live preview, and an image/folder selection footer.
- Client-persistent favorite images and folders, grouped by Foundry data source. New hidden client setting `assetFavorites`.
- In-use artwork labels and filters for World/Actor Items, portraits, tokens, scene tiles/backgrounds; GMs can additionally see placed ground-item artwork in the world storage.
- Search within the current folder and recursively through child folders, with result limits and cached native FilePicker directory listings; cancellation of outdated searches.
- Unchanged selection callbacks for Actor, Item, SVG and equipment artwork, plus the folder-only configuration picker.
- Normal pickers start from **Module Configuration → Addons → Icon source** by default, regardless of the currently selected image. Explicit folder/source overrides remain supported.
- No file movement, uploading, folder creation, deletion, or background-removal utilities.
- No legacy source code included.

Automated tests validate favorites, usage, path handling, folder trees, visual integration markers, configured default-folder behavior and callback contracts. Live Foundry V14 verification remains recommended.
