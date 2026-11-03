# Buxa Framework 0.17.26 — Module Configuration Design System

Full Module Configuration presentation rebuild based on a **pre-change source audit** in `docs/MODULE_CONFIG_AUDIT_01726.md`. All existing settings data, selectors, game rules, serialization, and top-level section/subtab identities remain unchanged.

## Single design system

- `styles/30-module-config-system.css` is now the **only configuration presentation owner** and is imported after other module styles.
- Tokens define four navy surfaces, one calm blue-violet accent, typography, spacing, squared radii, shadow levels, easing and motion speed. Danger remains red and warnings amber.
- Component families: primary/secondary/danger/icon buttons, labels, text fields, numeric inputs with stepper buttons, custom dark glass selects, single-track toggle switches, filled sliders and value fields, segmented radio choices and option cards, swatch picker, SVG/file picker, cards and rows, collapsibles, tabs, badges and sticky action footer.
- Native selects and numeric inputs remain in the DOM as the serializer's authoritative values; `scripts/apps/layout-config-widgets.js` adds presentation wrappers and dispatches the original change/input events.
- No native white select list is shown; checkboxes render as **one switch** without extra checkmark graphics.
- Removed the obsolete configuration stylesheets `30-config`, `31-config-navigation`, `32-config-notifications`, `35-inventory-config`, `37-addons`, `151-config-layout`, and `183-module-config-refinement` and their imports. Removed old config-specific overrides from mixed item, rarity, scene and Figma styling files while retaining unrelated UI styling.

## Pages

- **Player Sheet — General, Resources, Level, Attributes, Stats, Proficiencies, Rebirths:** unified labels, switches, resource/attribute/proficiency row grid, advanced level-up/rebirth areas, SVG pickers, numeric controls and aligned row actions.
- **Inventory:** grid-aligned mode, sorting, size and weight controls, separated weight toggle and equipment layout group.
- **NPC:** readable HP-resource selection and drop slots with intentional spacing.
- **Items:** shared rarity card and switches, consistent color picker, filled opacity sliders, number steppers and segmented background choices, and consistent dropped-item option cards.
- **UI — Warning, Item UI:** option-card positioning and shared notification fields with clearly styled controls.
- **Addons:** aligned capability cards, full wrapping status text, consistent file path and folder picker controls.

## Motion and state

- Shared hover, focus, pressed, entry, row and dropdown animations; section and tab transitions; animated sidebar selection indicator, tab underline, switch movement, slider knobs, collapsible chevrons and unsaved footer status.
- Respects `prefers-reduced-motion` and retains keyboard navigation via the original controls.
- Configuration-only presentation listeners and dropdowns are destroyed on close and rebuilt cleanly after Foundry rerenders.

## Validation

- Source-audited all configuration templates, controller/row generators and styles before rewriting.
- Dedicated design-system regression tests cover sole stylesheet ownership, section completeness, switches and original native-value controls.
- Browser mock smoke checks exercised select changes, number steppers, and switch presentation; **the module still requires live Foundry V14 visual and save/reset integration testing**.
