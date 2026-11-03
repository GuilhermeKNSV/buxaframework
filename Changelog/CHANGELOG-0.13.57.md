# Buxa Framework v0.13.57 — Inventory-to-Backpack Tile Drops

- Drag an Actor inventory item directly onto the occupied tile of a storage-granting backpack/container in the same Actor inventory to put the item into its first compartment with room.
- Honors Complex footprints, rotation, storage masks, available cells, nesting protections, and additional compartments. Uses the same storage-geometry validator as regular compartment drops.
- Shows green feedback on an eligible bag tile; indicates blocked/full targets in red. A full bag never forces a normal inventory relocation.
- Preserves compatible item stacking when dropping on ordinary items; explicit storage targets take precedence over stacking into the container itself.
- Adds unit, pointer-hit, placement, and real Actor inventory-move regression coverage. No migration required.

Tested with Node automated suite; not yet verified inside a live Foundry V14 instance.
