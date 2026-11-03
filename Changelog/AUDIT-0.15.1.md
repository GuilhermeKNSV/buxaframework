# Buxa Framework v0.15.1 — Reliability audit

**Baseline:** the user-provided v0.15.0 ZIP, not an older module build.

**Reproductions against v0.15.0:** 15 pre-existing failing tests + **50 additional failing test scenarios** (42 rarity/display/geometry, 8 loot-beam/tracking), 65 failing scenarios in total. **These are NOT 65 independent root bugs.** Several older failures were test assumptions about intentional UI redesigns; those assertions were updated to verify the new behavior rather than reverting that design. No unsupported claim of 55 unique defects is made.

## Actual changes

- Rarity tier parsing accepts normalized IDs and treats legacy disabled flags (such as `"false"`, `"0"`, `"off"`) as disabled instead of falsely raising a rarity tier.
- Loot-beam spectrum uses the same normalized flag behavior. Malformed or missing beam accent colors fall back to a safe color.
- Loot-beam tracking ignores invalid or infinite coordinates and survives exceptions when a scene item disappears during an animation.
- Scene-item FX positioning tolerates the valid minimal PIXI-compatible harnesses and avoids a crash when optional effect layers are absent; original sprite-bottom positioning retained for full effects.
- Item-effect labels, resource names and GM-authored uppercase abbreviations retain their original capitalization and spelling.
- Tooltip no longer adds a redundant image thumbnail, the now-single-column header doesn't leave a blank image gutter, and oversized tooltip content is constrained and scrollable inside the viewport.
- Correct numeric dice notation, including `+ 0`, is preserved in item resource text and dice display; unresolved attribute/proficiency modifiers remain clearly marked as `MOD`.
- Exhausted/disabled item-use feedback is explicit. The full Item Sheet continues to hide a dead Use button for exhausted items, while making exhaustion visible.
- The existing compact rarity-based v0.15 item sheet and canvas loot nameplate remain intact. Tests that depended on obsolete button labels, case, layout or the previous VFX signature were updated to test the present functionality rather than reverting the new design.

## What the counts mean

An individual test scenario is one distinct set of inputs and expected behavior. Many combinations share one root cause; for example 24 string-valued disabled rarity flags are a single parsing defect. Some of the 15 old failures were intentionally changed presentation, not bugs. Live Foundry V14 and third-party addon interactions still require in-world confirmation.

## Original 15 failing tests

1. item editor exposes modular description, reveal and merge controls
2. inventory hover increase reads icon → +20% → HP Maximum, with passive last
3. full item sheet puts computed value before text for both dice and increases
4. resource tooltip resolves attribute-derived dice and numeric zero modifier
5. world Item preview marks unresolved modifiers and keeps formula notation
6. four successful uses then lock; fifth use does not spend resources
7. new tabs, sheet UI, context menu, and hover tooltip expose their working controls
8. external use-counter updates during async roll are preserved, not refunded
9. Resource/Uses display is sourced from real item counters and rules
10. exhausted items keep their art unobstructed and do not show a dead Use Item button
11. uses/resources are rarity-led unboxed effects with a discreet inline action
12. large artwork beams stay below visual cap and marker follows short/wide icon bottom
13. ground loot is a permanent single-line world-space item-name label, not a popup card
14. scene menu reveals the canvas rarity beam without adding a DOM overlay
15. scene renderer uses configured rarity visuals and GM E uses the on-scene editor

## 50 additional failures reproduced on the original v0.15.0

1. rarity: disabled ornament="false" does not raise a common drop
2. rarity: disabled ornament="FALSE" does not raise a common drop
3. rarity: disabled ornament="0" does not raise a common drop
4. rarity: disabled ornament="off" does not raise a common drop
5. rarity: disabled ornament="no" does not raise a common drop
6. rarity: disabled ornament="disabled" does not raise a common drop
7. rarity: disabled glint="false" does not raise a common drop
8. rarity: disabled glint="FALSE" does not raise a common drop
9. rarity: disabled glint="0" does not raise a common drop
10. rarity: disabled glint="off" does not raise a common drop
11. rarity: disabled glint="no" does not raise a common drop
12. rarity: disabled glint="disabled" does not raise a common drop
13. rarity: disabled animated="false" does not raise a common drop
14. rarity: disabled animated="FALSE" does not raise a common drop
15. rarity: disabled animated="0" does not raise a common drop
16. rarity: disabled animated="off" does not raise a common drop
17. rarity: disabled animated="no" does not raise a common drop
18. rarity: disabled animated="disabled" does not raise a common drop
19. rarity: disabled spectrum="false" does not raise a common drop
20. rarity: disabled spectrum="FALSE" does not raise a common drop
21. rarity: disabled spectrum="0" does not raise a common drop
22. rarity: disabled spectrum="off" does not raise a common drop
23. rarity: disabled spectrum="no" does not raise a common drop
24. rarity: disabled spectrum="disabled" does not raise a common drop
25. rarity: normalized id " COMMON " resolves its true tier
26. rarity: normalized id " Divine " resolves its true tier
27. item text: preserve authored label MOD
28. item text: preserve authored label HTML
29. item text: preserve authored label ARCANE POWER
30. item text: preserve authored label LUCKY HIT
31. item text: preserve authored label BONUS HP
32. item text: preserve authored label WILD MAGIC
33. item text: preserve authored label NASA
34. VFX: geometry function tolerates valid minimal effect {"size":20}
35. VFX: geometry function tolerates valid minimal effect {"size":76}
36. VFX: geometry function tolerates valid minimal effect {"size":200}
37. VFX: geometry function tolerates valid minimal effect {"size":450}
38. VFX: geometry function tolerates valid minimal effect {"size":800}
39. VFX: geometry function tolerates valid minimal effect {"size":1200}
40. VFX: geometry function tolerates valid minimal effect {"size":76,"x":0,"y":0}
41. VFX: geometry function tolerates valid minimal effect {"size":76,"x":100,"y":200}
42. VFX: geometry function tolerates valid minimal effect {"size":200,"rotation":90}
43. loot beam: legacy disabled spectrum=false never enables rainbow
44. loot beam: legacy disabled spectrum=FALSE never enables rainbow
45. loot beam: legacy disabled spectrum=0 never enables rainbow
46. loot beam: legacy disabled spectrum=off never enables rainbow
47. loot beam: legacy disabled spectrum=no never enables rainbow
48. loot beam: invalid coordinates cannot write NaNpx or Infinitypx
49. loot beam: stale scene-anchor exceptions do not bubble out of animation
50. loot beam: missing accent resolves to a safe CSS hex color

## Verification

Run inside `buxaframework/`:

```sh
node --test --test-concurrency=4 tests/*.test.mjs
node check-architecture.mjs
```

A green automated suite does not guarantee visuals, multiplayer, and add-on behavior inside a live Foundry V14 instance. Preserve a world backup before updates.
