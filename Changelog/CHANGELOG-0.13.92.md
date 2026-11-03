# Buxa Framework 0.13.92

- Cross-system audit on the complete 0.13.91 build.
- Fixed Item Rule, rarity, tooltip and access boolean settings interpreting string values incorrectly.
- Fixed defaults for blank numeric Item settings.
- Fixed corrupt Actor inventory indices, Complex shape occupancy, and numeric-string rotations.
- Fixed malformed saved ground-container placements blocking legal free cells.
- Protected six post-save observer notification paths from third-party listener exceptions.
- Added 156 automated regression cases (145 reproduced failures on original v0.13.91).
- See AUDIT-0.13.92.md for the complete per-case list, scope and verification limitations.
