# Buxa Framework 0.17.27 — Module Configuration switch repair

- Changed Module Configuration checkboxes to preserve the native input invisibly and render exactly one separate square-cornered switch track immediately after the original input. This prevents Foundry/Chromium native orange checkmarks from appearing over a CSS switch.
- Applies consistently to fixed and dynamically added controls across all Module Configuration sections (General, Resources, Level, Attributes, Stats, Proficiencies, Rebirths, Inventory, NPC, Items, UI and Addons).
- The original checkbox is still the source of truth for saving, resetting, keyboard accessibility and data serialization. No layout or settings schema changed.
- Enhancer is idempotent during rerenders and MutationObserver updates; repeated rendering never duplicates tracks.
- Added unit regressions plus a headless Chromium smoke verification of checkmark suppression, toggle interaction and dynamically added options.
