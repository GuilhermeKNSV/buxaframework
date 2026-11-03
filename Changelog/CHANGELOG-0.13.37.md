# Buxa Framework v0.13.37 — Automatic Stacking & Max Stack

- Item Configuration → Basic → Quantity → Stackable now includes **Max Stack** (1–999999; default 99 for previously unconfigured stackable items). Stored on each Item's Buxa rules; existing Items and quantities are preserved.
- Incoming stackable Items fill matching partial stacks **in the destination area** before taking new slots. Overflow is split into separate capped Items; no stack can be incremented above its configured maximum.
- Applies to World Item → Actor, scene board → Actor, Actor → Actor, native Item-directory drops, and stored items transferred from chest/pouch containers.
- Ground-container transfers distribute stacks inside the destination compartment(s) and persist as a single serialized world-setting transaction.
- Internal Actor inventory/compartment moves automatically consolidate matching stacks and split legacy oversized stacks where there is room. Direct stack merges now transfer only available capacity and retain the unmerged source quantity.
- Refuse imports when the necessary free slots are missing, and roll back newly created stacks or previous partial-stack increments after failed operations when recovery is possible. Never destroy source quantities just to fit.
- An Unstack operation cannot create a stack larger than its configured maximum.
- Cross-surface data carries the World Item origin identity so a placed Item can continue stacking with other copies of the same template.

Automated Node regressions added for capped distribution, partial fills, one-per-stack, storage, insufficient space, Actor imports, and rollback after source write failure. Foundry V14 live UI validation is still required.
