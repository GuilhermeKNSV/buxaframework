# Buxa Framework 0.13.63 — Full-bar Rebirth Unlock

- Widened the responsive attribute score control to accommodate three and more digits without squeezing the controls or the name. Includes a two-row fallback for narrower sheet windows.
- Replaced the tiny rebirth icon and readiness label with a full-attribute-bar lock gate, using the next rarity color as an accent.
- After confirmation, the gate charges before committing the rebirth. On successful persistence the new rarity palette appears with a lock-shatter/sweep/glow reveal. Failed/cancelled rebirths do not reveal a new tier.
- Blocked double-submission from rapid clicks, kept keyboard focus via a native button, and honored reduced-motion preferences.
- Added interaction tests for confirmation, duplicate clicks, failed saves, lock-break overlays, and Source/CSS layout checks.
- No change to Actor flag schemas, attribute point accounting, or item/inventory behavior.

Automated and DOM layout tests run locally; real Foundry V14 gameplay testing remains necessary.
