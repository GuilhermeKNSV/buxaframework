# Buxa Framework v0.13.68 — Item Use Presentation Polish

- Redesign the Item Sheet's Resource Effects and Item Uses sections to match the existing fantasy item-card presentation rather than generic blue control boxes.
- Replace the large use-count row with a compact, rarity-colored charge indicator and a visible progress meter. Exhausted Items remain visually marked.
- Show resource amount/formula first, followed by the configured resource, restore/drain action and before/after roll timing. Make dice modifiers and advantage/disadvantage easier to read.
- Apply the same typography and restrained rarity accents to inventory hover tooltips, with smaller spacing appropriate for hover previews.
- Keep the original Item Use, dice-roll, resource updates, use limits, transformations, and persistence mechanisms intact. No Actor/Item data migration.

**Verification:** 689/689 Node tests passed (2 new presentation tests), JavaScript syntax, CSS parsing and architecture validation passed. Visual integration still needs testing within Foundry V14; the Chromium smoke check was unavailable in this environment.
