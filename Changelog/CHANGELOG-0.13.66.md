# 0.13.66 — Item Resource Effects and Use Limits

- **Item Configuration → RESOURCE**: multiple independently configured HP/MP and other configured resource drain/restore effects. Each triggers before or after an Item use/roll and supports a flat amount, a percentage of maximum, or Foundry dice. Resource dice use the same fixed/attribute source, flat bonus, modifier and advantage/disadvantage rules as Item Dice.
- **Item Configuration → LIMITS**: max uses per embedded Item instance (tracked in `flags.buxaframework.itemUsage`), and exhaustion behavior: Disable (visible lock), Destroy, or Transform into a chosen World Item of the same Foundry type. A GM may manually edit/reset the spent uses on owned Items.
- Item context actions and Item Sheet rolls invoke the resource/limits checks. A **USE ITEM** action supports limited-use or resource-only Items with no configured dice.
- The Item Sheet and inventory hover tooltip display resource charges/restoration and remaining uses. Exhausted inventory tiles and Item Sheets are visually marked as locked. Resource-only uses show results in Chat.
- Insufficient resource amounts prevent a roll and do not consume uses. Failed use operations attempt to restore paid resources and spent-use flags. Foundry resource document writes are batched by phase.
- Safety: limited-use Items never auto-merge and discard independent use counters. Destroying a stacked item consumes a single unit (then resets its counter); transformation requires unstacking first and preserves the embedded Item ID and inventory placement.
- Legacy Items have Resource/Limits disabled by default. No destructive migration of existing settings or items.

**Verification:** 681 tests pass (14 new targeted tests), syntax and architecture validation pass. Browser navigation for visual smoke checks was blocked in the test environment; Foundry V14 runtime verification remains necessary.

