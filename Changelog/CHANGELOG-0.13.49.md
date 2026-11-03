## 0.13.49 — Closed chest pickup: validate before saving Actor inventory

- Fix the reproduced Foundry V14 `Actor is not a valid embedded Document within the Actor Document` error triggered by the **second** Actor inventory update while restoring a closed chest with conflicting child placement metadata.
- Preflight the complete restored backpack, its nested compartments, saved positions, rotations and actual embedded Item shapes using the existing Actor inventory geometry, **before** writing any new child placements to the Actor document.
- Preserve every legal cell exactly. Only if a saved placement is invalid, try a legal location inside the **same** compartment. Abort safely without consuming the scene chest if none exists. Avoid the previous write-invalid-flags-then-rewrite repair path.
- Commit validated child placements in **one Actor update** after item creation. Confirm final accepted placements before removing the ground source.
- New regression tests reproduce the original v0.13.48 failure text, verify this build avoids it, and confirm a rejected final Actor update leaves the chest and all contents on the ground without embedded Item duplication.
- No migration or destructive cleanup. Live Foundry V14 validation still required.
