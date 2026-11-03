# Buxa Framework 0.13.75 — Additional source audit

- Introduces a shared safe numeric/boolean input parser to stop blank Foundry form values and serialized string checkboxes from altering mechanics unexpectedly.
- Corrects dice, resource, limit, storage and stack artwork normalization.
- Hardens storage clipping, invalid mask and item occupancy, token-based quick drops, scene bounds and visibility authorization.
- Enforces actual Item ownership and World Item source identity for uses and material recharge.
- Validates nested chest IDs and invalid rotations while retaining compatible legacy numeric rotation strings.
- Adds 147 focused regression cases, of which 129 fail on untouched 0.13.74.
- 928 total tests pass; see AUDIT-0.13.75.md.
