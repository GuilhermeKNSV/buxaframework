# Buxa Framework 0.13.72 — Item Recharge

- **Limits → Recharge:** configure three independent recharge methods per Item:
  - **Button:** right-click owned Item → Recharge, optionally spending flat or percentage HP/MP/other configured resource, restoring configurable uses.
  - **Item:** select a world Item template, then drag its **owned Actor inventory copy** onto the target Item to consume one unit and restore configurable uses (other copies are not changed).
  - **Combat Turns:** restore configurable uses every N combat turns advanced within Foundry's active encounter; progress and an encounter high-water mark are persisted to prevent duplicate processing or farming through rewinds.
- Item Sheets and inventory hover tooltips show configured recharge methods and amounts.
- Recharge applies per Actor Item instance and never exceeds the configured max uses; old Items have recharge disabled until configured.
- Added guards for missing recharge resources, exhausted source materials, cross-Actor drags, double activations, post-save hook failures and quick consecutive combat-turn changes.
- Added `scripts/core/item-recharge.js`, `scripts/apps/inventory-recharge-drop.js`, `scripts/integrations/combat-item-recharge.js`, `styles/159-item-recharge.css` and dedicated recharge regression tests.
- No saved-data migration. **Recharge requires an existing Item**: for replenishable Items use Limits → On Exhaust: Disable. Destroy/Transform removes or replaces the original instance.

## Verification

Automated tests and architecture validation pass. Live Foundry V14 drag/drop, combat lifecycle and UI interactions remain to be checked.
