# v0.13.71 — Exhausted-item icon polish

- Replace the broken Font Awesome pseudo-element on exhausted inventory tiles with a small, unboxed inline SVG lock.
- Avoid using `::after` so Complex inventory outline decorators and rarity borders are not overridden.
- Keep the exhausted item dimming and existing use/lock gameplay untouched.
- Apply the icon consistently to equipped, Simple, Complex, external storage, and Overflow tiles.
