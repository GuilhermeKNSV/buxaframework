# Buxa Framework 0.16.2 — Ground loot VFX correction

- Fixed Common/Junk/Uncommon/Rare/Epic beam animation: the canvas ticker no longer treats the Item Sheet “Animated glow” and “glint” flags as prerequisites for beam motion.
- Low-rarity particles use a nonzero beam animation speed even where the sheet rarity theme is visually still.
- Added traveling light pulses inside all beam shafts, including tiers without god-rays, and preserved reduced-motion behavior.
- Replaced oversized beam height scaling (previously up to 620px for larger items) with a bounded item-proportional default beam of 95–280 scene pixels; independent saved per-item beam scaling remains functional.
- Reduced excessive god-ray fan angles and synchronized foreground wisps/motes with the beam's independent width/height scale.
- Retained the subtle ground contact footprint, now proportionate to the smaller beam rather than visually dwarfed by it.
- Removed the excessively layered DOM fallback animations introduced in 0.16.1; fallback beams still breathe regardless of the sheet Animated glow flag.
- Kept the previous removal of only the decorative frame around the item image on the item sheet.

Validation: Node 1,941/1,941 tests passed; 223 JS syntax checks passed; architecture check passed (8 existing soft warnings). Live Foundry V14 visuals still need user verification.
