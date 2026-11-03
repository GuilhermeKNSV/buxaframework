# Buxa Framework v0.13.65 — Module Configuration UI Polish

- Rebalanced Module Configuration field spacing and heights: label above input, same baseline and 32px control height across Resource, Attribute, Stats and Proficiencies settings.
- Removed the redundant framed backgrounds around compact checkbox rows; preserved a restrained, intentional highlight on the primary enable toggle.
- Reworked expandable settings to use quieter disclosure headers with compact content, eliminating the excessive nested blue borders.
- Made nested Resource, Attribute and Proficiency editing cards smaller and better aligned without removing icon selection, row ordering, checkbox, Save or Reset behavior.
- Tightened resource and proficiency form grids, stat selectors and action button sizing to avoid top-heavy or clipped fields.
- Introduced container-width breakpoints so the layout responds to the **Foundry window width**, not only the monitor's viewport size.
- Entire change is CSS; no saved configuration, module logic, Actor / Item data or transfer mechanics were modified.

**Verification:** Existing automated regression suite plus new configuration layout checks, CSS parsing, JS syntax, architecture validator and ZIP integrity. Native Foundry visual inspection is still required; Chromium navigation in this environment could not be completed.
