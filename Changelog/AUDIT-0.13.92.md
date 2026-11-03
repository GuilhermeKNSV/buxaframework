# Buxa Framework v0.13.92 — cross-system bug audit

## Counting and scope

Baseline is the complete user-confirmed **v0.13.91** source archive. Existing baseline: **1,094/1,094 passing tests**.

This pass added **156 regression scenarios** across Actor inventory (Simple and Complex), ground storage, item configuration, rarities, item tooltip rules, and post-save observer failures. We first executed them on the **unchanged v0.13.91** build: **145 scenarios failed**, 11 passed. After fixes, all 156 passed. **The 145 are separately reproduced user-data failure scenarios, NOT 145 independent underlying root bugs.** We do not equate one option/input variant with an independent root cause, and we do not claim these findings prove live Foundry integration.

## Root-cause fixes

1. **Item rule booleans:** textual false-ish values (`"false"`, `"0"`, `"off"`, `"no"`, with case/spacing differences) previously enabled disabled descriptions, equip rules, requirements, weights, stackability, and type labels. All now use the shared normalized boolean parser.
2. **Equipment `any` rule:** textual false-ish values must not bypass configured allowed equipment types.
3. **Disable Looting access rule:** textual true-ish values now actually enable the restriction rather than silently leaving it disabled.
4. **Rarity visual toggles:** name color, animation, ornament, spectrum, and glint now correctly interpret saved false-ish values, preventing unwanted visual effects and wasted animation work.
5. **Blank Item numeric settings:** missing/null/blank/boolean Level Requirement, Max Stack, and rarity background opacity/brightness use their configured fallback defaults instead of coerced zero/minimum values.
6. **Increase tooltip enablement:** serialized false-ish text actually turns off the individual Increase tooltip.
7. **Corrupt Actor inventory indices:** invalid data no longer turns into valid cell 0 or 1 in Simple and Complex inventories. Invalid placements remain unplaced and recoverable.
8. **Legacy Complex-grid shape overlap:** an invalid overlapping saved item no longer reserves nonoverlapping fragments or rewrites the occupancy owner in geometry scans.
9. **Auto-pack string rotations:** legacy persisted `"1"` etc. are coerced to a real rotation before calculating subsequent turn options, avoiding string concatenation errors and inconsistent packing.
10. **Ground container occupancy:** invalid rotations, missing indices, off-edge shapes, masked-out or overlapping legacy items no longer create invisible blocked cells in drag-footprint checking.
11. **Post-save hook isolation:** after confirmed updates to inventory flags, world configuration, Actor portrait/token art, permission links, or Damage Reduction, exceptions from third-party observer hooks are logged but never make a completed save appear failed. The same safe observer infrastructure is reused.

## What is still unverified

- Live Foundry V14 + D&D 5e 6.0.x UI and multiplayer tests are not available to the automated Node test harness.
- External addons and GM/client synchronization should still be tested on a backup world.
- Eight source files exceed their soft maintainability line targets, though hard architecture limits pass.
- Bugs not exercised by the tested paths could remain; 145 scenarios are not a comprehensive count of all possible defects.

## Original failing cases — all pass after the fixes (145)

1. corrupt simple saved index null never becomes a valid occupied cell
2. corrupt complex saved index null never becomes a valid occupied cell
3. corrupt simple saved index "" never becomes a valid occupied cell
4. corrupt complex saved index "" never becomes a valid occupied cell
5. corrupt simple saved index " " never becomes a valid occupied cell
6. corrupt complex saved index " " never becomes a valid occupied cell
7. corrupt simple saved index " \\t " never becomes a valid occupied cell
8. corrupt complex saved index " \\t " never becomes a valid occupied cell
9. corrupt simple saved index false never becomes a valid occupied cell
10. corrupt complex saved index false never becomes a valid occupied cell
11. corrupt simple saved index true never becomes a valid occupied cell
12. corrupt complex saved index true never becomes a valid occupied cell
13. corrupt simple saved index [] never becomes a valid occupied cell
14. corrupt complex saved index [] never becomes a valid occupied cell
15. item increase tooltip disabled as "false" stays disabled
16. item increase tooltip disabled as "FALSE" stays disabled
17. item increase tooltip disabled as "0" stays disabled
18. item increase tooltip disabled as "off" stays disabled
19. item increase tooltip disabled as "OFF" stays disabled
20. item increase tooltip disabled as "no" stays disabled
21. item increase tooltip disabled as " No " stays disabled
22. overlapping legacy shapes never reserve extra phantom cells
23. packing normalizes legacy string rotations before exploring all orientations
24. saved inventory observer throwing cannot invalidate a confirmed Actor write
25. actor portrait save remains successful even if an observer throws
26. token prototype texture save remains successful even if an observer throws
27. saved world settings succeed even if a third-party observer throws
28. ground footprint checker ignores off-edge item rather than inventing occupied cells
29. ground footprint checker ignores illegal rotation rather than inventing occupied cells
30. ground footprint checker ignores missing index rather than inventing occupied cells
31. ground footprint checker ignores blank index rather than inventing occupied cells
32. ground footprint checker ignores later corrupted overlaps in full, not partially
33. item settings interpret description.enabled="false" as disabled
34. item settings interpret description.enabled="FALSE" as disabled
35. item settings interpret description.enabled="0" as disabled
36. item settings interpret description.enabled="off" as disabled
37. item settings interpret description.enabled="OFF" as disabled
38. item settings interpret description.enabled="no" as disabled
39. item settings interpret description.enabled=" No " as disabled
40. item settings interpret levelRequirement.enabled="false" as disabled
41. item settings interpret levelRequirement.enabled="FALSE" as disabled
42. item settings interpret levelRequirement.enabled="0" as disabled
43. item settings interpret levelRequirement.enabled="off" as disabled
44. item settings interpret levelRequirement.enabled="OFF" as disabled
45. item settings interpret levelRequirement.enabled="no" as disabled
46. item settings interpret levelRequirement.enabled=" No " as disabled
47. item settings interpret equip.enabled="false" as disabled
48. item settings interpret equip.enabled="FALSE" as disabled
49. item settings interpret equip.enabled="0" as disabled
50. item settings interpret equip.enabled="off" as disabled
51. item settings interpret equip.enabled="OFF" as disabled
52. item settings interpret equip.enabled="no" as disabled
53. item settings interpret equip.enabled=" No " as disabled
54. item settings interpret weight.enabled="false" as disabled
55. item settings interpret weight.enabled="FALSE" as disabled
56. item settings interpret weight.enabled="0" as disabled
57. item settings interpret weight.enabled="off" as disabled
58. item settings interpret weight.enabled="OFF" as disabled
59. item settings interpret weight.enabled="no" as disabled
60. item settings interpret weight.enabled=" No " as disabled
61. item settings interpret multiple.enabled="false" as disabled
62. item settings interpret multiple.enabled="FALSE" as disabled
63. item settings interpret multiple.enabled="0" as disabled
64. item settings interpret multiple.enabled="off" as disabled
65. item settings interpret multiple.enabled="OFF" as disabled
66. item settings interpret multiple.enabled="no" as disabled
67. item settings interpret multiple.enabled=" No " as disabled
68. item settings interpret typeLabel.enabled="false" as disabled
69. item settings interpret typeLabel.enabled="FALSE" as disabled
70. item settings interpret typeLabel.enabled="0" as disabled
71. item settings interpret typeLabel.enabled="off" as disabled
72. item settings interpret typeLabel.enabled="OFF" as disabled
73. item settings interpret typeLabel.enabled="no" as disabled
74. item settings interpret typeLabel.enabled=" No " as disabled
75. item settings interpret equip.any="false" as disabled
76. item settings interpret equip.any="FALSE" as disabled
77. item settings interpret equip.any="0" as disabled
78. item settings interpret equip.any="off" as disabled
79. item settings interpret equip.any="OFF" as disabled
80. item settings interpret equip.any="no" as disabled
81. item settings interpret equip.any=" No " as disabled
82. rarity settings interpret nameColor="false" as disabled
83. rarity settings interpret nameColor="FALSE" as disabled
84. rarity settings interpret nameColor="0" as disabled
85. rarity settings interpret nameColor="off" as disabled
86. rarity settings interpret nameColor="OFF" as disabled
87. rarity settings interpret nameColor="no" as disabled
88. rarity settings interpret nameColor=" No " as disabled
89. rarity settings interpret animated="false" as disabled
90. rarity settings interpret animated="FALSE" as disabled
91. rarity settings interpret animated="0" as disabled
92. rarity settings interpret animated="off" as disabled
93. rarity settings interpret animated="OFF" as disabled
94. rarity settings interpret animated="no" as disabled
95. rarity settings interpret animated=" No " as disabled
96. rarity settings interpret ornament="false" as disabled
97. rarity settings interpret ornament="FALSE" as disabled
98. rarity settings interpret ornament="0" as disabled
99. rarity settings interpret ornament="off" as disabled
100. rarity settings interpret ornament="OFF" as disabled
101. rarity settings interpret ornament="no" as disabled
102. rarity settings interpret ornament=" No " as disabled
103. rarity settings interpret spectrum="false" as disabled
104. rarity settings interpret spectrum="FALSE" as disabled
105. rarity settings interpret spectrum="0" as disabled
106. rarity settings interpret spectrum="off" as disabled
107. rarity settings interpret spectrum="OFF" as disabled
108. rarity settings interpret spectrum="no" as disabled
109. rarity settings interpret spectrum=" No " as disabled
110. rarity settings interpret glint="false" as disabled
111. rarity settings interpret glint="FALSE" as disabled
112. rarity settings interpret glint="0" as disabled
113. rarity settings interpret glint="off" as disabled
114. rarity settings interpret glint="OFF" as disabled
115. rarity settings interpret glint="no" as disabled
116. rarity settings interpret glint=" No " as disabled
117. item settings interpret disableLooting="true" as enabled
118. item settings interpret disableLooting="TRUE" as enabled
119. item settings interpret disableLooting="1" as enabled
120. item settings interpret disableLooting="on" as enabled
121. item settings interpret disableLooting="On" as enabled
122. item settings interpret disableLooting="yes" as enabled
123. item settings interpret disableLooting=" YES " as enabled
124. blank level null restores level 1 default
125. blank maxStack null restores 99 default
126. blank background opacity null restores 100 default
127. blank background brightness null restores 100 default
128. blank level "" restores level 1 default
129. blank maxStack "" restores 99 default
130. blank background opacity "" restores 100 default
131. blank background brightness "" restores 100 default
132. blank level " " restores level 1 default
133. blank maxStack " " restores 99 default
134. blank background opacity " " restores 100 default
135. blank background brightness " " restores 100 default
136. blank level " \\t " restores level 1 default
137. blank maxStack " \\t " restores 99 default
138. blank background opacity " \\t " restores 100 default
139. blank background brightness " \\t " restores 100 default
140. blank level false restores level 1 default
141. blank maxStack false restores 99 default
142. blank background opacity false restores 100 default
143. blank background brightness false restores 100 default
144. linked user permissions are saved even if an optional observer throws
145. damage-reduction saves cannot be undone by a third-party observer exception
