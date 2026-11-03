# 0.13.67 — Resource & Limits Reliability Audit

- Apply advantage/disadvantage to non-d20 Item and Resource dice (for example, 2d10 advantage now evaluates as `4d10kh2`, instead of ignoring advantage).
- Resource effects check configured attribute-dice and modifier references before spending resources; missing sources produce a clear error rather than silently omitting their effects.
- Validate the Actor's current resource amount before each before/after effect write. If another operation changed HP/MP during an async roll, do not overwrite it with stale values.
- Track only the resources actually written by an Item use and roll back only those values. Do not wipe out unrelated HP/MP updates when a use fails.
- Keep independent Item use-counter changes intact when another operation updated the count while a roll was pending.
- Handle Foundry post-save hook errors carefully: verify the actual committed state before treating a rollback as failed.
- Existing Resource/Limits flags and saved Item instances are unchanged. No migrations.

**Validation:** 687/687 automated tests pass, including new coverage for resource conflicts, usage-counter conflicts, non-d20 advantage, deleted modifier sources and post-save failures. Architecture and JavaScript syntax checks pass. Actual Foundry V14 interaction testing is still needed.
