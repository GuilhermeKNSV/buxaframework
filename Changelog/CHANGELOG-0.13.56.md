# Buxa Framework v0.13.56 — Second audit

- Fail closed on corrupt/duplicate Scene physical-item metadata; block unrelated writes and migrations from silently losing hidden bad records. Validate incoming records too.
- Recover newly created stack Items from a Foundry post-create hook error; never delete existing Items with the same appearance.
- Repair Unstack's post-create and post-update hook rollback so unsuccessful operations do not leave duplicate stacks or lose quantity.
- No change to item geometry, normal drop routing, existing flags, or default inventory behavior. Seven regression tests added.
- See `AUDIT-0.13.56.md` for the review, safety guarantees and remaining runtime risks.
