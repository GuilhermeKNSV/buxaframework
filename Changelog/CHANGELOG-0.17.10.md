# Buxa Framework v0.17.10 — Reliability & audit follow-up

Follow-up remediation on top of v0.17.9. No gameplay rule changes intended.

- Combat roster/death archive preserves all entries instead of silently truncating after 400; actor chooser loads further 150-entry pages on demand.
- Initiative reorder requires a current GM-local drag gesture, started on a valid Combatant in the same encounter.
- Extracted combat actor picker into its own module to restore architecture hard limit.
- Hotbar Item slot actions cannot be re-triggered while an action for the same Item is still pending, even after a hotbar rerender. Attribute context menu survives routine hotbar refresh.
- Image tree browse uses up to 4 concurrent FilePicker calls; order remains stable, path validation and cancellation remain intact. Deep folder nodes remain visible past depth nine.
- Stack composer no longer detaches active numeric controls on every input. World Actor/Scene directory searches are debounced.
- Defunct Item icon/image-picker callbacks ignore missing/replaced inputs.
- Browser blur/visibility loss clears native physical Item drag sessions and ghosts.
- Invalid persisted stack quantities cannot enter destructive merge/split operations.
- Scene progression rejects tokens belonging to other Scenes and hidden/nonvisible actors where token state exposes it.
- NPC Kill hover position polling limited to ~11Hz and avoids unnecessary CSS writes.
- Corpse window listens for remote token loot changes, cleans up the listener on close, and locks in-flight Item requests.
- Escape in the corpse window avoids capturing keystrokes targeted at another modal dialog.

## Testing limits

Automated Node tests and architecture checks do not simulate Foundry UI rendering, reconnects, or concurrent GM clients. High-risk distributed transaction and crash-recovery issues in the previous 131-point audit are **not** claimed resolved by this release. Test with a backed-up world.
