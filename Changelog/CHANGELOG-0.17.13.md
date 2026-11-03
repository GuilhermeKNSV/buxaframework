# Buxa Framework v0.17.13 — Additional data-integrity and interaction fixes

Continues the 0.17.12 bug audit. No intentional gameplay rules, saved-world schema, or sheet layout changes. **Back up your world before installing.**

## Inventory and stack integrity
- **Automatic stacking** now confirms the original source quantity and every target quantity against its plan after asynchronous Item creation. Another GM or external hook editing either stack can no longer make an old plan overfill a destination or silently overwrite the source amount.
- Automatic-stack recovery now restores only known values written by the current operation. It refuses to overwrite newer quantities or delete an overflow copy another action already modified; uncertain cases explicitly request GM review.
- If a source stack was successfully deleted but a post-delete Foundry hook throws, the merge is recognized as already committed rather than rolling back its receiver.
- Stack planning rejects malformed source quantities rather than using the legacy display fallback of **one item**. Malformed destination quantities are never treated as having free capacity.
- Item-material recharge now checks for a valid, nonnegative whole-number quantity both before granting charges and before consuming the material. Invalid/fractional quantities cannot grant charges.

## NPC corpse inventory
- Repeated inventory drop-table entries now receive unique, stable loot-entry IDs, retaining the original first entry ID for existing references.
- Old corpse saves with duplicate inventory IDs now fail safely on pickup and ask the GM to reconcile, rather than removing all copies with a single pickup. Ground drop ID behavior from v0.17.12 is unchanged.

## Ground containers
- Fixed a 249-versus-250 limit mismatch: a 250-item nested bundle can now be validated and reopened, consistent with the writer's 250-item limit. A 251st item remains rejected.

## Scene and input handling
- Synthetic token progression FX now require the referenced token to belong to the advertised Actor, preventing a mismatched socket payload from animating someone else's token.
- Inventory's quick-drop shortcut correctly prioritizes a selected scene token when Foundry supplies its ID through `token.document.id` rather than `token.id`.

## Verification
- 2,861 / 2,861 automated tests passed (10 additional regression tests).
- Architecture check passed; 11 preexisting nonfatal file-size warnings.
- Syntax and complete ZIP integrity checks performed.

## Still unresolved / live verification
- True crash-atomic, multi-GM scene/Actor inventory transactions require a coordinated server-side transaction system; local rollback guards cannot provide that guarantee.
- Foundry V14 and D&D5e 6.x manual multiplayer tests are still needed for delayed hooks, canvas visuals, and real sheet interaction.
