# Buxa Framework v0.13.75 — Extended Source Audit

## Scope and counting

Audited the latest complete v0.13.74 ZIP, with emphasis on item configuration, dice/resources/limits, shape and storage placement, stack-image rendering, scene quick-drops and vision authorization, Item instance ownership, and container data integrity.

**129 regression scenarios fail on the unmodified v0.13.74 source and pass after the changes.** These are 129 input/behavior cases, **not 129 independent architectural root causes**: several cases stress the same shared validator with different real-world Foundry form values (`''`, whitespace, `null`, `false`, numeric strings, etc.). The 147-case focused suite also includes 18 preexisting safeguards. This report does not claim live Foundry testing.

## Corrected failure groups

1. **Empty dice fields:** Blank, whitespace, null or boolean inputs no longer make normal dice counts unexpectedly zero or force die faces down to two.
2. **Resource dice and Limits:** The same default-preservation rules apply to resource amounts, dice count/faces, attribute dice, and max item uses. Explicit numeric `0` remains valid for fields that allow it.
3. **Stack-artwork editor:** Empty layer x/y, size and opacity fields no longer jump to the far edge, minimum size, or nearly invisible opacity.
4. **Source storage configuration:** Empty width/height fields no longer shrink a default 4×4 compartment to 1×1.
5. **Corrupt storage masks:** Imported null/blank/boolean cell indices can no longer invent a playable cell zero when valid mask cells also exist.
6. **Corrupt saved storage coordinates:** Null/blank/boolean indices or invalid rotations cannot create ghost occupancy blocking a free cell.
7. **Storage pointer projection:** Releases outside the panel, with NaN/Infinity coordinates, or outside the clipped viewport no longer resolve to legitimate drop cells.
8. **Quick scene drops:** Tokens with missing or invalid coordinates or nonpositive width/height cannot act as valid drop origins.
9. **Scene bounds:** Explicit invalid zero or negative scene dimensions cannot be treated as usable map bounds when derived rectangles are unavailable.
10. **Scene sight authorization:** Missing player/scene/item identity is rejected before the `tokenVision=false` shortcut for non-GMs.
11. **Item ownership validation:** An obsolete embedded Item or an Item belonging to a different Actor instance cannot charge another Actor's resource by sharing an ID.
12. **Recharge material identity:** An Actor Item cannot be consumed merely because its local embedded ID happens to match a World Item template ID; original source provenance is required.
13. **Nested chest data:** Invalid and reserved generated IDs cannot be stored as nested item identities; invalid legacy rotation is recoverable, and valid numeric-string legacy rotation remains readable.
14. **String checkbox persistence:** Form-derived `"false"`/`"true"` values now round-trip safely for dice sources, roll visibility, chat, Resource/Limit/Recharge enable flags, tooltip display and compartment border/background options.
15. **Shared validation helpers:** Numeric and boolean parsing are centralized to prevent future divergent interpretations of the same form values.

## Regression results

- Untouched v0.13.74 comprehensive tests: **781/781 passing**.
- New 147-case audit suite against untouched v0.13.74: **18 passing, 129 failing**.
- New audit suite on v0.13.75: **147/147 passing**.
- Final combined suite: **928/928 passing**.
- Syntax: checked all JavaScript source files with Node; passed.
- Architecture: passed with 8 pre-existing soft file-size warnings.
- Complete ZIP: integrity verified.
- **No migration and no changes to saved game structures.** Only normalization, validation and safety checks.

## The 129 failing cases before the fix

Each line below comes directly from the regression suite run against the original v0.13.74 source.

1. dice count uses its documented default for ""
2. dice count uses its documented default for "  "
3. dice count uses its documented default for null
4. dice count uses its documented default for false
5. dice faces uses its documented default for ""
6. dice faces uses its documented default for "  "
7. dice faces uses its documented default for null
8. dice faces uses its documented default for false
9. attribute dice faces uses its documented default for ""
10. attribute dice faces uses its documented default for "  "
11. attribute dice faces uses its documented default for null
12. attribute dice faces uses its documented default for false
13. tooltip symbol count uses its documented default for ""
14. tooltip symbol count uses its documented default for "  "
15. tooltip symbol count uses its documented default for null
16. tooltip symbol count uses its documented default for false
17. resource base amount uses its documented default for ""
18. resource base amount uses its documented default for "  "
19. resource base amount uses its documented default for null
20. resource base amount uses its documented default for false
21. resource dice count uses its documented default for ""
22. resource dice count uses its documented default for "  "
23. resource dice count uses its documented default for null
24. resource dice count uses its documented default for false
25. resource dice faces uses its documented default for ""
26. resource dice faces uses its documented default for "  "
27. resource dice faces uses its documented default for null
28. resource dice faces uses its documented default for false
29. resource attribute dice faces uses its documented default for ""
30. resource attribute dice faces uses its documented default for "  "
31. resource attribute dice faces uses its documented default for null
32. resource attribute dice faces uses its documented default for false
33. maximum item uses uses its documented default for ""
34. maximum item uses uses its documented default for "  "
35. maximum item uses uses its documented default for null
36. maximum item uses uses its documented default for false
37. storage width uses its documented default for ""
38. storage width uses its documented default for "  "
39. storage width uses its documented default for null
40. storage width uses its documented default for false
41. storage height uses its documented default for ""
42. storage height uses its documented default for "  "
43. storage height uses its documented default for null
44. storage height uses its documented default for false
45. stack artwork horizontal position uses its documented default for ""
46. stack artwork horizontal position uses its documented default for "  "
47. stack artwork horizontal position uses its documented default for null
48. stack artwork horizontal position uses its documented default for false
49. stack artwork vertical position uses its documented default for ""
50. stack artwork vertical position uses its documented default for "  "
51. stack artwork vertical position uses its documented default for null
52. stack artwork vertical position uses its documented default for false
53. stack artwork image size uses its documented default for ""
54. stack artwork image size uses its documented default for "  "
55. stack artwork image size uses its documented default for null
56. stack artwork image size uses its documented default for false
57. stack artwork opacity uses its documented default for ""
58. stack artwork opacity uses its documented default for "  "
59. stack artwork opacity uses its documented default for null
60. stack artwork opacity uses its documented default for false
61. scene loot range uses its documented default for ""
62. scene loot range uses its documented default for "  "
63. scene loot range uses its documented default for null
64. scene loot range uses its documented default for false
65. scene drop range uses its documented default for ""
66. scene drop range uses its documented default for "  "
67. scene drop range uses its documented default for null
68. scene drop range uses its documented default for false
69. scene move range uses its documented default for ""
70. scene move range uses its documented default for "  "
71. scene move range uses its documented default for null
72. scene move range uses its documented default for false
73. scene max move range uses its documented default for ""
74. scene max move range uses its documented default for "  "
75. scene max move range uses its documented default for null
76. scene max move range uses its documented default for false
77. shaped pouch excludes malformed mask cell ""
78. compact pouch bounds ignore malformed cell ""
79. legacy invalid placement "" doesn't occupy first cell
80. shaped pouch excludes malformed mask cell "  "
81. compact pouch bounds ignore malformed cell "  "
82. legacy invalid placement "  " doesn't occupy first cell
83. shaped pouch excludes malformed mask cell null
84. compact pouch bounds ignore malformed cell null
85. legacy invalid placement null doesn't occupy first cell
86. shaped pouch excludes malformed mask cell false
87. compact pouch bounds ignore malformed cell false
88. legacy invalid placement false doesn't occupy first cell
89. drop mapping blocks right exterior
90. drop mapping blocks bottom exterior
91. drop mapping blocks nonfinite horizontal
92. quick scene drop ignores null horizontal
93. quick scene drop ignores blank horizontal
94. quick scene drop ignores boolean horizontal
95. quick scene drop ignores null vertical
96. quick scene drop ignores blank vertical
97. quick scene drop ignores boolean vertical
98. quick scene drop ignores negative token width
99. quick scene drop ignores zero token height
100. vision disabled cannot authorize missing player
101. vision disabled cannot authorize missing scene
102. vision disabled cannot authorize missing item
103. ground chest refuses invalid generated ID 42
104. ground chest refuses invalid generated ID true
105. ground chest refuses invalid generated ID {}
106. ground chest refuses invalid generated ID "root"
107. a stale embedded item reference cannot initiate item use
108. a different actor instance with the same ID cannot be used as owner
109. an unrelated Actor Item with coincidentally matching template ID cannot be spent as recharge material
110. persisted string checkbox: dice fixed-vs-attribute false
111. persisted string checkbox: dice show-range false
112. persisted string checkbox: dice chat publication false
113. persisted string checkbox: dice tooltip display false
114. persisted string checkbox: resource attribute dice activation
115. persisted string checkbox: Limits activation
116. persisted string checkbox: recharge button activation
117. persisted string checkbox: recharge item activation
118. persisted string checkbox: recharge combat activation
119. persisted string checkbox: storage tooltip activation
120. persisted string checkbox: storage capacity text
121. persisted string checkbox: storage compartment text
122. persisted string checkbox: storage equipment bonuses
123. persisted string checkbox: storage compartment border
124. persisted string checkbox: storage compartment background
125. Actor storage excludes corrupt rotation -1 from occupied hit map
126. Actor storage excludes corrupt rotation 4 from occupied hit map
127. Actor storage excludes corrupt rotation 1.5 from occupied hit map
128. Actor storage excludes corrupt rotation bad from occupied hit map
129. legacy numeric-string rotations remain valid for an otherwise fitting chest item

## What remains unverified

- Foundry V14 / D&D 5e live canvas and ApplicationV2 mouse interactions and multiplayer synchronization.
- Real-world legacy Actor and Scene documents with inconsistent flags require backup and targeted checking.
- Eight pre-existing oversized JS/template files still need a measured modular refactor.

Back up the world first; test in a copy and verify complex backpack drag/drop before general rollout.
