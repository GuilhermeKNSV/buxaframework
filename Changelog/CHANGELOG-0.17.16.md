# Buxa Framework 0.17.16 — hidden combat lifecycle foundation

- Added deterministic combat phase observation (creation, start, round/turn begin/end, stop, deletion, rewinds, participant and initiative changes).
- Tracks Buxa preparation roster and dead drawer changes without altering encounter behavior.
- Added bounded, primary-GM persisted per-combat history with monotonic event sequence and reload-safe hydration.
- Added passive subscribers, immutable read APIs and Foundry hook `buxaCombatLifecycle` for future features.
- Added protection from duplicate hooks, flag-write loops, initiative reorder phantom-turn events and fabricated startup transitions.
- UI and combat rules are unchanged. Full contract is in `docs/COMBAT_LIFECYCLE.md`.
