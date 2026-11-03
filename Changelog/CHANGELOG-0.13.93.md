# Buxa Framework 0.13.93 — Rarity hover flash correction

- Removed chromatic border/shadow interpolation on occupied Simple inventory and equipment slots. CSS transitions outrank even `!important` hover colors during their lifetime, so a Spectrum item could briefly display its prior hue (often red).
- Removed filter transitions on Complex item perimeter/decorations; their rarity glow applies immediately without blending through the current Spectrum hue.
- Kept configured Spectrum border animations running continuously rather than resetting them on hover; preserved brightness animation and rarity-colored drag ghosts.
- No saved flags, Item/Actor data, or gameplay rules changed.
