# Buxa Framework v0.13.39 — Image Library default folder consistency

- All artwork Image Library pickers now open in the folder and source saved under **Module Configuration → Addons → Icon source**, regardless of the currently selected image or any previous caller-specific browse path.
- Keep the selected image available for preview/confirmation without navigating away from the configured folder.
- The Addons **Choose Folder** picker remains independently browsable so a GM can change the setting before saving.
- New regression coverage for forced configured location and settings changes between picker openings.
