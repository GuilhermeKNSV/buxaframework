# Buxa Module Configuration — Pre-redesign Audit (v0.17.25)

This inventory was generated **before** editing v0.17.25. It is an audit of actual source, not the current visual state.

## Controls and structural elements

- Handlebars template: `templates/layout-config.hbs`; native input types: text (13), checkbox (36), number (26), color (4), hidden (5), radio (7), range (3).
- Native `<select>`: 12; `<button>`: 45; `<details>`: 3.
- Dynamic markup emitted by: `scripts/apps/layout-config-helpers.js`, `scripts/apps/rarity-config.js`.
- Settings/submission binding: `scripts/apps/layout-config.js` and `scripts/core/config.js` (unchanged).
- Navigation at baseline: `scripts/apps/layout-config-navigation.js`; the redesign later added animated active indicators without changing the tab/section logic.
- Component families: text, number, color, native select, checkboxes, radio, range, action buttons, nav tabs, option cards, expandable details, resource/attribute/proficiency/rebirth/rarity list rows, SVG picker, physical file picker, badge, footer, panel.

## Stylesheet rule / override inventory

Every line below is a source location where the selector or declaration references configuration visuals. Some legacy files also contain unrelated general UI rules; those are preserved when removing config overrides.

### `styles/105-source-polish.css` — 9 matching lines

```css
110: .buxa-icon-source-config {
115: .buxa-icon-source-config .buxa-config-section-title { margin-bottom: 7px; }
116: .buxa-icon-source-row {
122: .buxa-icon-source-location {
132: .buxa-icon-source-location small {
138: .buxa-icon-source-location strong {
145: .buxa-icon-source-row > button {
161: .buxa-icon-source-row { grid-template-columns: 1fr; }
162: .buxa-icon-source-row > button { min-height: 34px !important; }
```

### `styles/107-rarity-global-background.css` — 7 matching lines

```css
48: .buxa-rarity-global-background {
58: .buxa-rarity-global-background > label {
65: .buxa-rarity-global-background > label > span {
72: .buxa-rarity-global-background > label > div {
79: .buxa-rarity-global-background input[type="range"] {
85: .buxa-rarity-global-background output {
97: .buxa-rarity-global-background { grid-template-columns: 1fr; }
```

### `styles/122-design-tokens.css` — 4 matching lines

```css
38: .buxa .window-content :is(.buxa-section-card,.buxa-basic-card,.buxa-resource,.buxa-field,.buxa-config-panel,.buxa-item-config-section,.buxa-item-property-card,.buxa-rule-card,.buxa-rule-sour
74: .buxa .window-content :is(.buxa-field-label,.buxa-config-mini-grid label>span,.buxa-item-field>span) {
80: .buxa .window-content :is(.buxa-config-section-title h3,.buxa-section-heading,.buxa-rule-section-heading strong) { color:#c9dbed; }
81: .buxa .window-content :is(.buxa-config-section-title,.buxa-section-heading,.buxa-progression-heading) { border-bottom-color:#27394e; }
```

### `styles/124-figma-editor-ui.css` — 31 matching lines

```css
2: .buxa-layout-config-app .window-content,
5: .buxa-config-shell-v2 { background:#070b12; grid-template-columns:clamp(135px,21%,205px) minmax(0,1fr); }
6: .buxa-config-sidebar { background:#0e1623; border-right:1px solid #27394e; padding:14px 9px; }
7: .buxa-config-brand { padding:8px 10px 18px; color:#7fbce9; }
8: .buxa-config-brand strong { color:#eaf2fc; letter-spacing:.11em; font-size:13px; }
9: .buxa-config-brand small { color:#91a4ba; font-size:9px; }
10: .buxa-config-tree-label { color:#879ab0; font-size:9px; margin-top:8px; }
11: .buxa-config-tree button {
18: .buxa-config-tree button:hover { background:#18293f !important; color:#eef6ff !important; }
19: .buxa-config-tree button.is-selected { background:#203955 !important; border-color:#4c7293 !important; color:#eff8ff !important; box-shadow:inset 3px 0 #7fbce9; }
20: .buxa-config-top,.buxa-config-header { background:#0e1623; }
21: .buxa-config-header { padding:14px 17px 11px; }
22: .buxa-config-header h2 { color:#f1f6ff; font-size:18px; line-height:1.3; }
23: .buxa-config-header p { color:#97adc4; font-size:11px; }
24: .buxa-config-tabs { padding-inline:12px; background:#0e1623; border-bottom:1px solid #27394e; gap:4px; overflow:auto; scrollbar-width:thin; }
25: .buxa-config-tabs button { min-width:fit-content; flex:none; height:36px; padding-inline:13px; color:#a5b8cd !important; font-size:10px; font-weight:750; border-bottom:2px solid transparent 
26: .buxa-config-tabs button.is-active { border-bottom-color:#8dbfe9 !important; background:#192c44 !important; color:#eef7ff !important; }
27: .buxa-config-main { min-height:0; min-width:0; padding:14px; background:#070b12; scrollbar-color:#425a74 transparent; }
28: .buxa-config-panel { min-width:0; padding:13px; margin-bottom:12px; border:1px solid #27394e; background:#0e1623; box-shadow:none; }
29: .buxa-config-section-title { min-height:40px; margin-bottom:12px; border-bottom:1px solid #27394e; }
30: .buxa-config-section-title h3 { font-size:12px; letter-spacing:.04em; color:#d8e7f7; }
31: .buxa-config-field-row,.buxa-config-resource,.buxa-config-toggle,.buxa-config-advanced {
34: .buxa-config-footer,.buxa-item-config-footer { background:#0e1623; border-top:1px solid #27394e; }
92: .buxa-config-shell-v2{grid-template-columns:minmax(108px,26%) minmax(0,1fr)}
93: .buxa-config-sidebar{padding:9px 5px}
94: .buxa-config-main{padding:9px}
95: .buxa-config-panel{padding:9px}
100: .buxa-config-shell-v2{grid-template-columns:minmax(90px,29%) minmax(0,1fr)}
101: .buxa-config-tree button{font-size:9px;padding:7px 5px}
102: .buxa-config-header{padding:10px}
103: .buxa-config-header h2{font-size:14px}
```

### `styles/126-figma-utility-ui.css` — 1 matching lines

```css
35: .buxa-dialog-lead,.buxa-config-intro p { color:#a2b5ca; }
```

### `styles/145-physical-items.css` — 9 matching lines

```css
74: .buxa-physical-visual-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}
75: .buxa-physical-visual-options label{display:flex;cursor:pointer;min-width:0;}
76: .buxa-physical-visual-options input{position:absolute;opacity:0;width:1px;height:1px;}
77: .buxa-physical-visual-options label>span{display:flex;flex-direction:column;gap:5px;flex:1;padding:15px 14px;background:#101e2c;border:1px solid #304b60;color:#e5f3ff;}
78: .buxa-physical-visual-options label strong{font-size:13px;font-weight:800;}
79: .buxa-physical-visual-options label small{color:#8ba9bf;font-size:11px;line-height:1.35;}
80: .buxa-physical-visual-options input:checked+span{border-color:#7acfff;background:#163046;box-shadow:inset 3px 0 #7acfff;}
81: .buxa-physical-visual-options input:focus-visible+span{outline:2px solid #8cdaff;outline-offset:2px;}
82: @media(max-width:550px){.buxa-physical-visual-options{grid-template-columns:1fr;}}
```

### `styles/151-config-layout.css` — 92 matching lines

```css
4: .buxa-layout-config-app .buxa-config-workspace {
8: .buxa-layout-config-app .buxa-config-main {
12: .buxa-layout-config-app .buxa-config-panel {
18: .buxa-layout-config-app .buxa-config-section-title {
25: .buxa-layout-config-app .buxa-config-section-title h3 {
30: .buxa-layout-config-app .buxa-config-section-title button {
36: .buxa-layout-config-app :is(
37: .buxa-config-mini-grid > label,
38: .buxa-config-resource-main > label,
39: .buxa-config-attribute-main > label,
40: .buxa-config-stat-block > label:not(.buxa-config-toggle),
41: .buxa-config-proficiency-top > label:not(.buxa-config-toggle),
42: .buxa-config-proficiency-main > label:not(.buxa-config-inline-check),
43: .buxa-proficiency-attribute-options > label:not(.buxa-config-toggle)
55: .buxa-layout-config-app :is(
56: .buxa-config-mini-grid,
57: .buxa-config-resource-main,
58: .buxa-config-attribute-main,
59: .buxa-config-stat-grid,
60: .buxa-config-proficiency-top,
61: .buxa-config-proficiency-main,
66: .buxa-layout-config-app :is(
67: .buxa-config-mini-grid,
68: .buxa-config-resource-main,
69: .buxa-config-attribute-main,
70: .buxa-config-stat-block,
71: .buxa-config-proficiency-top,
72: .buxa-config-proficiency-main,
74: ) label > span:not(.buxa-config-toggle span) {
81: .buxa-layout-config-app .buxa-config-main :is(input:not([type="checkbox"]):not([type="radio"]):not([type="color"]), select) {
91: .buxa-layout-config-app .buxa-config-main input[type="color"] {
99: .buxa-layout-config-app .buxa-config-main :is(input,select,textarea):focus-visible {
105: .buxa-layout-config-app .buxa-config-main .buxa-config-toggle {
120: .buxa-layout-config-app .buxa-config-main .buxa-config-toggle.prominent {
126: .buxa-layout-config-app .buxa-config-main .buxa-config-toggle input[type="checkbox"] {
130: .buxa-layout-config-app .buxa-config-main .buxa-config-toggle > span {
137: .buxa-layout-config-app .buxa-config-main .buxa-config-toggle strong {
142: .buxa-layout-config-app .buxa-config-main .buxa-config-toggle small {
146: .buxa-layout-config-app .buxa-config-toggle-grid {
150: .buxa-layout-config-app .buxa-config-toggle-grid .buxa-config-toggle {
155: .buxa-layout-config-app :is(.buxa-config-resource,.buxa-config-attribute,.buxa-config-proficiency) {
163: .buxa-layout-config-app :is(.buxa-config-resource-list,.buxa-config-attribute-list,.buxa-config-proficiency-list) {
166: .buxa-layout-config-app .buxa-config-attribute-list {
169: .buxa-layout-config-app .buxa-config-resource-main {
174: .buxa-layout-config-app .buxa-config-attribute-main {
179: .buxa-layout-config-app .buxa-config-proficiency-main {
184: .buxa-layout-config-app .buxa-config-row-actions {
191: .buxa-layout-config-app .buxa-config-row-actions button {
198: .buxa-layout-config-app .buxa-config-fixed-link {
206: .buxa-layout-config-app .buxa-config-resource > .buxa-config-icon-control,
207: .buxa-layout-config-app .buxa-config-proficiency > .buxa-config-icon-control {
210: .buxa-layout-config-app .buxa-config-icon-control {
215: .buxa-layout-config-app .buxa-config-main .buxa-config-advanced {
224: .buxa-layout-config-app .buxa-config-main .buxa-config-advanced > summary {
235: .buxa-layout-config-app .buxa-config-main .buxa-config-advanced[open] > summary {
240: .buxa-layout-config-app .buxa-config-main .buxa-config-advanced > :not(summary) {
243: .buxa-layout-config-app .buxa-config-main .buxa-config-advanced > .buxa-config-mini-grid {
246: .buxa-layout-config-app .buxa-config-attribute-features {
250: .buxa-layout-config-app .buxa-config-mini-grid {
255: .buxa-layout-config-app .buxa-config-stat-grid {
258: .buxa-layout-config-app .buxa-config-stat-block {
265: .buxa-layout-config-app .buxa-config-stat-title {
270: .buxa-layout-config-app .buxa-config-stat-block .buxa-config-toggle {
276: .buxa-layout-config-app .buxa-config-proficiency-top {
281: .buxa-layout-config-app .buxa-config-proficiency-top .buxa-config-toggle {
284: .buxa-layout-config-app .buxa-config-proficiency-points {
290: .buxa-layout-config-app .buxa-config-proficiency-points > .buxa-config-toggle {
295: .buxa-layout-config-app .buxa-config-proficiency-main .buxa-config-inline-check {
298: .buxa-layout-config-app .buxa-proficiency-attribute-options {
303: .buxa-layout-config-app .buxa-proficiency-attribute-options .buxa-config-toggle {
309: .buxa-layout-config-app .buxa-config-main { padding: 10px; }
310: .buxa-layout-config-app .buxa-config-panel { padding: 11px; }
311: .buxa-layout-config-app .buxa-config-resource-main {
314: .buxa-layout-config-app .buxa-config-resource-main > label:nth-of-type(4) {
317: .buxa-layout-config-app .buxa-config-resource-main .buxa-config-row-actions {
320: .buxa-layout-config-app .buxa-config-attribute-main {
323: .buxa-layout-config-app .buxa-config-attribute-main .buxa-config-row-actions {
326: .buxa-layout-config-app .buxa-config-proficiency-main {
329: .buxa-layout-config-app .buxa-config-proficiency-main .buxa-config-row-actions {
334: .buxa-layout-config-app .buxa-config-proficiency-top,
335: .buxa-layout-config-app .buxa-config-stat-grid {
338: .buxa-layout-config-app .buxa-config-proficiency-top > label:first-child {
341: .buxa-layout-config-app .buxa-config-stat-block {
344: .buxa-layout-config-app .buxa-config-mini-grid.four {
347: .buxa-layout-config-app .buxa-proficiency-attribute-options {
352: .buxa-layout-config-app .buxa-config-main { padding: 7px; }
353: .buxa-layout-config-app .buxa-config-panel { padding: 8px; }
354: .buxa-layout-config-app .buxa-config-attribute-features,
355: .buxa-layout-config-app .buxa-config-toggle-grid,
356: .buxa-layout-config-app .buxa-config-mini-grid.three,
357: .buxa-layout-config-app .buxa-config-proficiency-top,
358: .buxa-layout-config-app .buxa-config-stat-grid {
```

### `styles/164-scene-item-menu.css` — 9 matching lines

```css
74: .buxa-sequencer-asset{display:grid;gap:7px;margin:12px 0 15px;padding:12px;border:1px solid #314457;background:#0b1522;}
75: .buxa-sequencer-asset label{display:grid;gap:6px;}
76: .buxa-sequencer-asset label span{font:700 10px Arial,sans-serif;letter-spacing:.08em;color:#98bad2;}
77: .buxa-sequencer-asset input{width:100%;min-width:0;background:#101f30;color:#ecf4ff;border:1px solid #44627b;padding:8px;box-sizing:border-box;}
78: .buxa-sequencer-asset small{font:11px/1.5 Arial,sans-serif;color:#879bad;}
79: .buxa-addon-card.buxa-addon-info{cursor:default;}
81: .buxa-sequencer-asset label>button,.buxa-addon-card.buxa-addon-info .buxa-addon-asset-button{justify-self:start;padding:7px 10px;border:1px solid #4a6b81;border-radius:0;background:#12283c;c
82: .buxa-sequencer-asset label>button:hover,.buxa-addon-card.buxa-addon-info .buxa-addon-asset-button:hover{background:#1b394d;color:#fff;}
83: .buxa-addon-card.buxa-addon-info{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
```

### `styles/183-module-config-refinement.css` — 212 matching lines

```css
5: .buxa-layout-config-app {
33: .buxa-layout-config-app :is(.buxa-config-shell-v2,.buxa-config-shell-v2 *,
34: .buxa-config-shell-v2 *::before,.buxa-config-shell-v2 *::after) {
38: .buxa-layout-config-app .window-content {
42: .buxa-layout-config-app .buxa-config-shell-v2 {
48: .buxa-layout-config-app .buxa-config-sidebar {
53: .buxa-layout-config-app .buxa-config-brand { padding: 8px 10px 24px; gap: 11px; }
54: .buxa-layout-config-app .buxa-config-brand > i { font-size: 23px; color: var(--bc-blue); }
55: .buxa-layout-config-app .buxa-config-brand strong { font-size: 14px; line-height: 1.1; color: var(--bc-ink); }
56: .buxa-layout-config-app .buxa-config-brand small { font-size: 9px; line-height: 1.5; color: var(--bc-muted); }
57: .buxa-layout-config-app .buxa-config-tree { gap: 5px; }
58: .buxa-layout-config-app .buxa-config-tree-label {
61: .buxa-layout-config-app .buxa-config-tree button[data-config-section] {
69: .buxa-layout-config-app .buxa-config-tree button[data-config-section] > i {
72: .buxa-layout-config-app .buxa-config-tree button[data-config-section]:hover {
76: .buxa-layout-config-app .buxa-config-tree button[data-config-section].is-selected {
83: .buxa-layout-config-app .buxa-config-top,
84: .buxa-layout-config-app .buxa-config-header {
87: .buxa-layout-config-app .buxa-config-header { padding: 20px 24px 15px; }
88: .buxa-layout-config-app .buxa-config-header h2 {
91: .buxa-layout-config-app .buxa-config-tabs {
95: .buxa-layout-config-app .buxa-config-tabs button {
105: .buxa-layout-config-app .buxa-config-tabs button:hover { background: #1a3048 !important; color: #e5f4ff !important; }
106: .buxa-layout-config-app .buxa-config-tabs button.is-active {
110: .buxa-layout-config-app .buxa-config-tabs[hidden] { display: none !important; }
112: .buxa-layout-config-app .buxa-config-main {
120: .buxa-layout-config-app .buxa-config-main > section:not([hidden]) {
123: .buxa-layout-config-app .buxa-config-main > section[hidden] { display: none !important; }
124: .buxa-layout-config-app .buxa-config-panel {
131: .buxa-layout-config-app .buxa-config-panel.no-top-margin { margin-top: 0; }
132: .buxa-layout-config-app .buxa-config-section-title {
137: .buxa-layout-config-app .buxa-config-section-title > div { min-width: 0; }
138: .buxa-layout-config-app .buxa-config-section-title h3 {
142: .buxa-layout-config-app .buxa-config-section-title :is(small,p),
143: .buxa-layout-config-app .buxa-config-note,
144: .buxa-layout-config-app .buxa-config-panel :is(.buxa-config-toggle small, .buxa-label-cell small) {
147: .buxa-layout-config-app .buxa-config-section-title :is(small,p) { margin-top: 5px; }
148: .buxa-layout-config-app .buxa-config-section-title button { margin-left: auto; flex: none; }
150: .buxa-layout-config-app .buxa-config-main :is(
151: .buxa-config-mini-grid,.buxa-config-resource-main,.buxa-config-attribute-main,
152: .buxa-config-stat-block,.buxa-config-proficiency-top,.buxa-config-proficiency-main,
153: .buxa-proficiency-attribute-options,.buxa-sequencer-asset,.buxa-rarity-config-main,
154: .buxa-config-advanced,.buxa-rarity-global-background
155: ) label:not(.buxa-config-toggle):not(.buxa-config-inline-check) > span:first-child,
156: .buxa-layout-config-app .buxa-config-main :is(.buxa-field-label,.buxa-rarity-beam-opacity > span,
157: .buxa-rarity-background-config > span,.buxa-config-stat-title) {
161: .buxa-layout-config-app .buxa-config-main :is(
162: .buxa-config-mini-grid > label,.buxa-config-resource-main > label,
163: .buxa-config-attribute-main > label,.buxa-config-stat-block > label:not(.buxa-config-toggle),
164: .buxa-config-proficiency-top > label:not(.buxa-config-toggle),
165: .buxa-config-proficiency-main > label:not(.buxa-config-inline-check),
166: .buxa-proficiency-attribute-options > label:not(.buxa-config-toggle)
168: .buxa-layout-config-app .buxa-config-main :is(
169: .buxa-config-mini-grid,.buxa-config-resource-main,.buxa-config-attribute-main,
170: .buxa-config-proficiency-top,.buxa-config-proficiency-main,
171: .buxa-config-stat-grid,.buxa-proficiency-attribute-options
173: .buxa-layout-config-app .buxa-config-mini-grid { gap: 16px; }
174: .buxa-layout-config-app .buxa-config-mini-grid > * { min-width: 0; }
176: .buxa-layout-config-app .buxa-config-main :is(
189: .buxa-layout-config-app .buxa-config-main select {
198: .buxa-layout-config-app .buxa-config-main :is(input,select,textarea):not([type="checkbox"]):not([type="radio"]):hover { border-color: #5e86a9 !important; }
199: .buxa-layout-config-app :is(button,input,select,textarea,summary):focus-visible,
200: .buxa-layout-config-app .buxa-config-main :is(input,select,textarea):focus-visible {
205: .buxa-layout-config-app .buxa-config-main :is(input,select,textarea):disabled { opacity: .55; cursor:not-allowed; }
206: .buxa-layout-config-app .buxa-config-main input[type="color"] {
212: .buxa-layout-config-app .buxa-config-main input[type="color"]:hover { border-color:var(--bc-blue); transform:translateY(-1px); }
213: .buxa-layout-config-app .buxa-config-main input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
214: .buxa-layout-config-app .buxa-config-main input[type="color"]::-webkit-color-swatch { border: 1px solid #ffffff40; }
216: .buxa-layout-config-app .buxa-config-main input[type="checkbox"] {
225: .buxa-layout-config-app .buxa-config-main input[type="checkbox"]::before {
230: .buxa-layout-config-app .buxa-config-main input[type="checkbox"]:checked {
233: .buxa-layout-config-app .buxa-config-main input[type="checkbox"]:checked::before {
236: .buxa-layout-config-app .buxa-config-main input[type="radio"] {
240: .buxa-layout-config-app .buxa-config-main input[type="radio"]:checked { background:#86caff; box-shadow:inset 0 0 0 4px #102137; }
241: .buxa-layout-config-app .buxa-config-main :is(.buxa-config-toggle,.buxa-config-inline-check) {
244: .buxa-layout-config-app .buxa-config-main .buxa-config-toggle {
248: .buxa-layout-config-app .buxa-config-main .buxa-config-toggle.prominent {
252: .buxa-layout-config-app .buxa-config-main .buxa-config-toggle strong { color:#e5f1ff; font-size:12px; font-weight:680; }
253: .buxa-layout-config-app .buxa-config-main .buxa-config-toggle small { font-size:10px; }
254: .buxa-layout-config-app .buxa-config-toggle-grid { margin-top:14px; gap:10px 20px; }
255: .buxa-layout-config-app .buxa-config-toggle-grid .buxa-config-toggle { padding:10px 8px; border-top:1px solid #2d43575c; }
257: .buxa-layout-config-app .buxa-config-shell-v2 button:not([data-config-section]):not([data-config-tab]):not([data-config-ui-tab]) {
269: .buxa-layout-config-app .buxa-config-shell-v2 button:not([data-config-section]):not([data-config-tab]):not([data-config-ui-tab]):hover {
274: .buxa-layout-config-app .buxa-config-shell-v2 button:not([data-config-section]):not([data-config-tab]):not([data-config-ui-tab]):active { transform:translateY(1px); box-shadow:inset 0 2px 4p
275: .buxa-layout-config-app .buxa-config-row-actions { gap:6px; align-items:center; }
276: .buxa-layout-config-app .buxa-config-row-actions button {
280: .buxa-layout-config-app .buxa-config-row-actions button:is([data-action^="remove"],[data-rarity-action="remove"]):hover {
285: .buxa-layout-config-app :is(.buxa-config-resource-list,.buxa-config-attribute-list,
286: .buxa-config-proficiency-list,.buxa-rarity-config-list,.buxa-config-rebirth-rule-list,
287: .buxa-config-fields) { display:grid; gap:14px; }
288: .buxa-layout-config-app :is(.buxa-config-resource,.buxa-config-attribute,
289: .buxa-config-proficiency,.buxa-config-field-row,.buxa-rarity-config-row,
290: .buxa-config-rebirth-rule,.buxa-config-stat-block,.buxa-config-proficiency-points) {
296: .buxa-layout-config-app :is(.buxa-config-resource,.buxa-config-attribute,.buxa-config-proficiency,
297: .buxa-config-field-row,.buxa-rarity-config-row,.buxa-config-rebirth-rule):hover {
301: .buxa-layout-config-app .buxa-config-field-row { grid-template-columns: 24px minmax(0,1fr) 82px 120px; align-items:center; gap:12px; }
302: .buxa-layout-config-app .buxa-config-field-head { color:#a6bad0; font-size:10px; padding:0 13px 8px; }
303: .buxa-layout-config-app .buxa-drag-handle { color:#9db6ce; font-size:15px; cursor:grab; }
304: .buxa-layout-config-app .buxa-drag-handle:active { cursor:grabbing; }
305: .buxa-layout-config-app .buxa-config-resource-main { gap:12px; grid-template-columns: 18px minmax(118px,1.45fr) 52px minmax(78px,.62fr) minmax(115px,1fr) 104px; }
306: .buxa-layout-config-app .buxa-config-attribute-main { gap:12px; grid-template-columns: 18px minmax(145px,1.6fr) minmax(122px,1fr) 104px; }
307: .buxa-layout-config-app .buxa-config-proficiency-main { gap:12px; grid-template-columns: 18px 32px minmax(130px,1.4fr) minmax(120px,1fr) 104px; }
308: .buxa-layout-config-app .buxa-config-resource-main :is(input,select),
309: .buxa-layout-config-app .buxa-config-attribute-main :is(input,select),
310: .buxa-layout-config-app .buxa-config-proficiency-main :is(input,select) { min-width:0; }
311: .buxa-layout-config-app .buxa-config-fixed-link { min-height:39px; height:auto; padding:9px 11px; border:1px solid #365571; background:#112137; font-size:11px; color:#b8d4e9; }
312: .buxa-layout-config-app .buxa-config-icon-control {
317: .buxa-layout-config-app .buxa-config-icon-control > label { font-size:11px; color:var(--bc-label); }
318: .buxa-layout-config-app .buxa-config-icon-preview { width:38px; height:38px; min-width:38px; background:#0a182a; border:1px solid #466784; display:grid; place-items:center; }
319: .buxa-layout-config-app .buxa-config-icon-preview img { max-width:28px; max-height:28px; object-fit:contain; }
320: .buxa-layout-config-app .buxa-config-icon-pick { justify-self:start; min-width:105px; }
321: .buxa-layout-config-app .buxa-config-advanced {
325: .buxa-layout-config-app .buxa-config-advanced > summary {
330: .buxa-layout-config-app .buxa-config-advanced[open] > summary { background:#1b3146; border-bottom:1px solid #3c5570; }
331: .buxa-layout-config-app .buxa-config-advanced > :not(summary) { margin:14px !important; }
332: .buxa-layout-config-app .buxa-config-advanced[open] > :not(summary) { animation:bc-reveal var(--bc-motion) ease-out both; }
333: .buxa-layout-config-app .buxa-config-proficiency-points { margin-top:18px; }
334: .buxa-layout-config-app .buxa-config-attribute-features { gap:14px; margin-top:15px; }
336: .buxa-layout-config-app .buxa-config-main [data-config-panel="inventory"] .buxa-config-mini-grid { gap:18px 16px; }
337: .buxa-layout-config-app .buxa-config-main [data-config-panel="inventory"] .buxa-config-toggle.prominent { margin-top:18px; }
338: .buxa-layout-config-app .buxa-equipment-layout-config-row { margin-top:12px; padding:16px; min-height:65px; border:1px solid #37536d70; background:#132438; gap:16px; }
339: .buxa-layout-config-app .buxa-equipment-layout-config-row strong { font-size:12px; font-weight:650; color:#daeaf8; }
340: .buxa-layout-config-app .buxa-equipment-layout-config-row button { min-width:180px !important; min-height:38px !important; font-size:11px !important; }
341: .buxa-layout-config-app [data-config-panel="npc"] .buxa-config-panel {
346: .buxa-layout-config-app [data-config-panel="npc"] .buxa-config-mini-grid { max-width:690px; gap:18px; }
348: .buxa-layout-config-app .buxa-rarity-global-background { padding:15px; gap:20px; margin-bottom:16px; border:1px solid #304b66; background:#12253a; }
349: .buxa-layout-config-app .buxa-rarity-global-background > label { min-width:0; gap:8px; }
350: .buxa-layout-config-app .buxa-rarity-global-background > label > span { font-size:11px; font-weight:680; letter-spacing:.02em; color:var(--bc-label); }
351: .buxa-layout-config-app .buxa-rarity-global-background > label > div { min-width:0; gap:12px; }
352: .buxa-layout-config-app .buxa-rarity-global-background output { min-width:56px; text-align:center; padding:7px 9px; font-size:11px; color:#e5f3ff; border:1px solid #34536c; background:#0d1e3
353: .buxa-layout-config-app .buxa-rarity-config-main { min-height:65px; grid-template-columns:10px minmax(135px,1fr) 58px 65px 38px; gap:12px; align-items:center; padding:14px 15px; }
354: .buxa-layout-config-app .buxa-rarity-config-main > label { min-width:0; display:flex; flex-direction:column; gap:7px; font-size:11px; }
355: .buxa-layout-config-app .buxa-rarity-config-main > label > span { font-size:11px !important; font-weight:680; color:var(--bc-label); }
356: .buxa-layout-config-app .buxa-rarity-config-id { font-size:10px; font-weight:650; color:#9cb1c5; overflow-wrap:anywhere; }
357: .buxa-layout-config-app .buxa-rarity-config-main button { width:36px !important; min-width:36px !important; min-height:36px !important; height:36px !important; color:var(--bc-danger) !import
358: .buxa-layout-config-app .buxa-rarity-swatch { width:7px; height:40px; }
359: .buxa-layout-config-app .buxa-rarity-config-flags { display:flex; flex-wrap:wrap; align-items:center; gap:10px 15px; padding:0 16px 14px; color:var(--bc-label); font-size:11px; }
360: .buxa-layout-config-app .buxa-rarity-config-flags label { display:inline-flex; align-items:center; gap:8px; min-height:28px; color:#c4d6e8; font-size:11px; }
361: .buxa-layout-config-app .buxa-rarity-beam-opacity { display:grid; grid-template-columns:98px minmax(90px,1fr) 64px auto; gap:12px; align-items:center; padding:12px 16px 16px; }
362: .buxa-layout-config-app .buxa-rarity-beam-opacity > span { min-width:0; }
363: .buxa-layout-config-app .buxa-rarity-beam-opacity input[type="number"] { width:64px !important; height:38px; }
364: .buxa-layout-config-app .buxa-rarity-beam-opacity small { font-size:11px; color:var(--bc-muted); }
365: .buxa-layout-config-app .buxa-rarity-background-config { padding:12px 16px; border-top:1px solid #3449607a; font-size:11px; }
366: .buxa-layout-config-app .buxa-rarity-background-options { gap:7px; }
367: .buxa-layout-config-app .buxa-rarity-background-options label { min-height:36px; display:inline-flex; gap:7px; align-items:center; padding:7px 11px; color:#cbdbea; border:1px solid #37516c; 
368: .buxa-layout-config-app .buxa-rarity-background-options input[type="radio"] { position:static; opacity:1; width:14px; height:14px; }
370: .buxa-layout-config-app .buxa-config-main input[type="range"] {
375: .buxa-layout-config-app .buxa-config-main input[type="range"]::-webkit-slider-thumb {
378: .buxa-layout-config-app .buxa-config-main input[type="range"]::-moz-range-thumb {
381: .buxa-layout-config-app .buxa-config-main input[type="range"]:hover::-webkit-slider-thumb { border-color:#fff; background:#3d86b3; }
383: .buxa-layout-config-app .buxa-config-rebirth-rule-head { padding-bottom:12px; border-bottom:1px solid #2d4660; }
384: .buxa-layout-config-app .buxa-config-rebirth-rule-head strong { color:#f0f7ff; font-size:13px; }
385: .buxa-layout-config-app .buxa-rebirth-global-editor { padding:16px; background:#132338; border:1px solid #34506c; }
386: .buxa-layout-config-app .buxa-rebirth-style-head { padding:0 12px 9px; font-size:10px; color:#a9bfd3; }
387: .buxa-layout-config-app .buxa-rebirth-style-row { padding:11px 12px; gap:12px; border-top:1px solid #38506777; }
388: .buxa-layout-config-app .buxa-rebirth-style-level { font-size:12px; }
389: .buxa-layout-config-app .buxa-rebirth-style-row input[type="text"] { height:39px !important; }
390: .buxa-layout-config-app .buxa-rebirth-style-row input[type="color"] { height:39px !important; }
391: .buxa-layout-config-app .buxa-rebirth-style-row button { height:36px !important; width:36px !important; min-width:36px !important; }
392: .buxa-layout-config-app .buxa-add-rebirth-style { margin-top:14px; min-height:40px !important; }
394: .buxa-layout-config-app .buxa-addon-grid { gap:14px; }
395: .buxa-layout-config-app .buxa-addon-card {
401: .buxa-layout-config-app .buxa-addon-card:hover { border-color:#75a8cf; background:#203c56; transform:translateY(-1px); }
402: .buxa-layout-config-app .buxa-addon-main { display:flex; flex-direction:column; align-items:flex-start; justify-content:start; gap:9px; min-width:0; }
403: .buxa-layout-config-app .buxa-addon-main strong { color:#ecf6ff; font-size:12px; line-height:1.4; font-weight:730; overflow:visible; white-space:normal; text-overflow:clip; overflow-wrap:any
404: .buxa-layout-config-app .buxa-addon-main small {
409: .buxa-layout-config-app .buxa-addon-main small.is-active { background:#193c35; color:#95eacb; }
410: .buxa-layout-config-app .buxa-addon-info { grid-template-columns:1fr; }
411: .buxa-layout-config-app .buxa-addon-asset-button { margin-top:7px !important; justify-self:start; }
412: .buxa-layout-config-app .buxa-sequencer-asset,
413: .buxa-layout-config-app .buxa-icon-source-config {
416: .buxa-layout-config-app .buxa-sequencer-asset label { gap:10px; }
417: .buxa-layout-config-app .buxa-sequencer-asset small { font-size:11px; line-height:1.6; color:var(--bc-muted); }
418: .buxa-layout-config-app .buxa-icon-source-row { gap:13px; }
420: .buxa-layout-config-app .buxa-config-footer {
426: .buxa-layout-config-app .buxa-config-footer::before {
431: .buxa-layout-config-app .buxa-config-shell-v2.has-unsaved-changes .buxa-config-footer::before {
436: .buxa-layout-config-app .buxa-config-footer button { min-width:90px; min-height:39px; font-size:12px; }
437: .buxa-layout-config-app .buxa-config-footer button.buxa-primary { min-width:108px; background:linear-gradient(145deg,#5baedc,#30789f) !important; color:#071827 !important; border-color:#9bd7
439: .buxa-layout-config-app .buxa-warning-position-picker { gap:12px; }
440: .buxa-layout-config-app .buxa-warning-position-content { min-height:103px; padding:17px 13px; background:linear-gradient(160deg,#21364b,#142337); border:1px solid #48627b; color:#b8cde0; }
441: .buxa-layout-config-app .buxa-warning-position-option input:checked + .buxa-warning-position-content { background:linear-gradient(155deg,#24435c,#19334a); border-color:var(--bc-blue); box-sh
442: .buxa-layout-config-app .buxa-warning-position-content strong { font-size:12px; }
445: .buxa-layout-config-app .buxa-config-main { padding:15px; }
446: .buxa-layout-config-app .buxa-config-panel { padding:16px; }
447: .buxa-layout-config-app .buxa-config-resource-main { grid-template-columns:20px minmax(120px,1fr) 50px minmax(75px,.75fr); }
448: .buxa-layout-config-app .buxa-config-resource-main > label:nth-of-type(3) { grid-column:2 / 4; }
449: .buxa-layout-config-app .buxa-config-resource-main > label:nth-of-type(4) { grid-column:4; }
450: .buxa-layout-config-app .buxa-config-resource-main .buxa-config-row-actions { grid-column:2 / -1; justify-content:flex-end; }
451: .buxa-layout-config-app .buxa-config-attribute-main { grid-template-columns:20px minmax(120px,1fr) minmax(125px,1fr); }
452: .buxa-layout-config-app .buxa-config-attribute-main .buxa-config-row-actions { grid-column:2 / -1; }
453: .buxa-layout-config-app .buxa-config-proficiency-main { grid-template-columns:20px 33px minmax(135px,1fr) minmax(112px,1fr); }
454: .buxa-layout-config-app .buxa-config-proficiency-main .buxa-config-row-actions { grid-column:3 / -1; }
457: .buxa-layout-config-app .buxa-config-main { padding:12px; }
458: .buxa-layout-config-app .buxa-config-panel { padding:14px; }
459: .buxa-layout-config-app :is(.buxa-config-mini-grid.three,.buxa-config-stat-grid,.buxa-addon-grid) { grid-template-columns:1fr; }
460: .buxa-layout-config-app .buxa-rarity-config-main { grid-template-columns:10px minmax(100px,1fr) 52px 36px; }
461: .buxa-layout-config-app .buxa-rarity-config-id { display:none; }
462: .buxa-layout-config-app .buxa-rarity-beam-opacity { grid-template-columns:minmax(80px,1fr) 64px auto; }
463: .buxa-layout-config-app .buxa-rarity-beam-opacity>span { grid-column:1 / -1; }
464: .buxa-layout-config-app .buxa-config-field-row { grid-template-columns:20px minmax(0,1fr) 60px; }
465: .buxa-layout-config-app .buxa-config-field-row .buxa-config-row-actions { grid-column:2/-1; }
468: .buxa-layout-config-app .buxa-config-shell-v2 { grid-template-columns:1fr; }
469: .buxa-layout-config-app .buxa-config-sidebar { display:block; padding:8px; }
470: .buxa-layout-config-app .buxa-config-tree { display:flex; gap:5px; flex-wrap:wrap; }
471: .buxa-layout-config-app .buxa-config-tree button[data-config-section] { width:auto; min-width:90px; flex:1 1 auto; }
472: .buxa-layout-config-app .buxa-config-header { padding:13px 15px; }
473: .buxa-layout-config-app .buxa-config-tabs { padding:0 10px; overflow-x:auto; }
474: .buxa-layout-config-app .buxa-config-footer { padding:10px 12px; }
477: .buxa-layout-config-app .buxa-config-shell-v2 *,
478: .buxa-layout-config-app .buxa-config-shell-v2 *::before,
479: .buxa-layout-config-app .buxa-config-shell-v2 *::after { animation:none !important; transition:none !important; scroll-behavior:auto !important; }
```

### `styles/20-dialogs.css` — 7 matching lines

```css
57: .buxa-config-control > span {
80: .buxa-config-footer {
88: .buxa-config-footer button,
89: .buxa-config-section-title button {
96: .buxa-config-footer .buxa-primary {
102: .buxa-config-intro h2 {
108: .buxa-config-intro p {
```

### `styles/30-config.css` — 128 matching lines

```css
5: .buxa-layout-config-app .window-content {
9: .buxa-config-shell-v2 {
16: .buxa-config-sidebar {
23: .buxa-config-brand {
31: .buxa-config-brand > i {
35: .buxa-config-brand > div {
40: .buxa-config-brand strong {
46: .buxa-config-brand small {
53: .buxa-config-tree-label {
62: .buxa-config-tree button {
78: .buxa-config-tree button.is-selected {
84: .buxa-config-workspace {
92: .buxa-config-top {
96: .buxa-config-header {
101: .buxa-config-header h2 {
107: .buxa-config-header p {
113: .buxa-config-tabs {
121: .buxa-config-tabs button {
138: .buxa-config-tabs button.is-active {
143: .buxa-config-main {
149: .buxa-config-main > section[hidden] {
153: .buxa-config-panel {
161: .buxa-config-panel.no-top-margin {
165: .buxa-config-section-title {
174: .buxa-config-section-title small,
175: .buxa-config-note {
181: .buxa-config-section-title small {
186: .buxa-config-note {
190: .buxa-config-section-title h3 {
196: .buxa-config-section-title p {
205: .buxa-config-toggle {
214: .buxa-config-toggle.prominent {
221: .buxa-config-toggle.compact {
226: .buxa-config-toggle input[type="checkbox"] {
231: .buxa-config-toggle > span {
238: .buxa-config-toggle strong {
243: .buxa-config-toggle small,
250: .buxa-config-toggle-grid {
257: .buxa-config-mini-grid {
263: .buxa-config-mini-grid.two {
267: .buxa-config-mini-grid.three {
271: .buxa-config-mini-grid.one-line {
275: .buxa-config-mini-grid > label,
276: .buxa-config-resource-main > label,
277: .buxa-config-attribute-main > label {
283: .buxa-config-mini-grid label > span,
284: .buxa-config-resource-main label > span,
285: .buxa-config-attribute-main label > span {
293: .buxa-config-field-head,
294: .buxa-config-field-row {
301: .buxa-config-field-head {
310: .buxa-config-field-row {
315: .buxa-config-field-row:first-child {
334: .buxa-config-row-actions {
340: .buxa-config-row-actions button {
348: .buxa-config-row-actions button[data-action^="remove"]:hover {
388: .buxa-config-resource-list,
389: .buxa-config-attribute-list {
394: .buxa-config-resource,
395: .buxa-config-attribute {
402: .buxa-config-resource-main {
409: .buxa-config-attribute-main {
416: .buxa-config-fixed-link {
429: .buxa-config-advanced {
435: .buxa-config-advanced > summary {
442: .buxa-config-advanced[open] > summary {
449: .buxa-config-attribute-features {
455: .buxa-config-footer {
491: .buxa-config-shell-v2 {
495: .buxa-config-resource-main,
496: .buxa-config-attribute-main {
500: .buxa-config-resource-main .buxa-config-row-actions,
501: .buxa-config-attribute-main .buxa-config-row-actions {
505: .buxa-config-resource-main > label:nth-of-type(3),
506: .buxa-config-resource-main > label:nth-of-type(4) {
510: .buxa-config-mini-grid.three {
538: .buxa-config-shell-v2 {
542: .buxa-config-sidebar {
546: .buxa-config-tabs {
550: .buxa-config-mini-grid,
551: .buxa-config-mini-grid.two,
552: .buxa-config-mini-grid.three,
553: .buxa-config-toggle-grid,
554: .buxa-config-attribute-features {
558: .buxa-config-field-head {
562: .buxa-config-field-row {
566: .buxa-config-field-row .buxa-config-row-actions {
572: .buxa-config-attribute-features.three {
576: .buxa-config-attribute-features.three > details:nth-child(3) {
584: .buxa-rebirth-style-head,
585: .buxa-rebirth-style-row {
592: .buxa-rebirth-style-head {
601: .buxa-rebirth-style-row {
606: .buxa-rebirth-style-level {
612: .buxa-rebirth-style-row input[type="text"] {
616: .buxa-rebirth-style-row input[type="color"] {
621: .buxa-rebirth-style-row button {
642: .buxa-config-attribute-features.three {
649: .buxa-config-mini-grid.four {
653: .buxa-config-stat-grid {
659: .buxa-config-stat-block {
671: .buxa-config-stat-title {
680: .buxa-config-stat-block > label:not(.buxa-config-toggle),
681: .buxa-config-proficiency-top > label:not(.buxa-config-toggle),
682: .buxa-config-proficiency-main > label:not(.buxa-config-inline-check),
683: .buxa-proficiency-attribute-options > label:not(.buxa-config-toggle) {
689: .buxa-config-stat-block > label > span,
690: .buxa-config-proficiency-top > label > span,
691: .buxa-config-proficiency-main > label > span,
700: .buxa-config-proficiency-top {
707: .buxa-config-proficiency-points {
715: .buxa-config-proficiency-points > .buxa-config-toggle {
720: .buxa-config-proficiency-list {
726: .buxa-config-proficiency {
733: .buxa-config-proficiency-main {
740: .buxa-config-inline-check {
746: .buxa-config-inline-check input {
764: .buxa-proficiency-attribute-options .buxa-config-toggle {
770: .buxa-config-mini-grid.four,
771: .buxa-config-stat-grid {
775: .buxa-config-proficiency-top,
776: .buxa-config-proficiency-main,
781: .buxa-config-proficiency-main .buxa-drag-handle,
782: .buxa-config-proficiency-main .buxa-config-inline-check {
786: .buxa-config-proficiency-main .buxa-config-row-actions {
792: .buxa-config-mini-grid.four,
793: .buxa-config-stat-grid,
794: .buxa-config-proficiency-top,
```

### `styles/31-config-navigation.css` — 5 matching lines

```css
5: .buxa-config-tree {
10: .buxa-config-tree-label {
14: .buxa-config-tree button[data-config-section] {
19: .buxa-config-tree button[data-config-section] > i {
24: .buxa-config-tabs[hidden] {
```

### `styles/32-config-notifications.css` — 37 matching lines

```css
2: .buxa-warning-config .buxa-config-section-title { align-items: flex-start; gap: 12px; }
3: .buxa-warning-config .buxa-config-section-title small {
10: .buxa-warning-config-badge {
24: .buxa-warning-settings-row { padding-top: 14px; }
25: .buxa-warning-duration { max-width: 440px; display: grid; gap: 9px; }
26: .buxa-warning-duration > span:first-child {
31: .buxa-warning-duration-input { width: min(220px, 100%); display: flex; align-items: center; gap: 8px; }
32: .buxa-warning-duration-input input {
40: .buxa-warning-duration-input small { font-size: 11px; color: #9baac0; }
41: .buxa-warning-duration > small { color: #8090a4; font-size: 10px; line-height: 1.5; }
43: .buxa-warning-position-picker { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
44: .buxa-warning-position-option { min-width: 0; position: relative; display: block; cursor: pointer; }
45: .buxa-warning-position-option input { position: absolute; opacity: 0; width: 1px; height: 1px; }
46: .buxa-warning-position-content {
57: .buxa-warning-position-content strong { font-size: 11px; letter-spacing: .05em; }
58: .buxa-warning-position-option:hover .buxa-warning-position-content { border-color: #5e87a9; transform: translateY(-2px); }
59: .buxa-warning-position-option input:checked + .buxa-warning-position-content {
65: .buxa-warning-position-option input:focus-visible + .buxa-warning-position-content { outline: 2px solid #b9e5ff; outline-offset: 3px; }
84: .buxa-warning-position-option:nth-child(2) .buxa-position-illustration { justify-content: center; }
85: .buxa-warning-position-option:nth-child(3) .buxa-position-illustration { justify-content: flex-end; }
86: .buxa-warning-preview-actions { margin-top: 18px; padding-top: 13px; border-top: 1px solid #2a3647; display: flex; gap: 12px; align-items: center; justify-content: space-between; }
87: .buxa-warning-preview-actions p { margin: 0; color: #8496aa; font-size: 10px; line-height: 1.45; }
88: .buxa-warning-preview-actions p i { color: #6cb6e7; margin-right: 4px; }
89: .buxa-warning-preview-actions button { flex: none; width: auto; min-height: 34px; padding: 0 12px; border: 1px solid #466b8a; background: #162d42; color: #bfddf7; font-size: 10px; }
90: .buxa-warning-preview-actions button:hover { background: #20405b; }
95: .buxa-layout-config-app .buxa-config-shell-v2 { grid-template-rows: auto minmax(0, 1fr); }
96: .buxa-layout-config-app .buxa-config-sidebar { display: block; padding: 8px; border-right: 0; border-bottom: 1px solid #263244; }
97: .buxa-layout-config-app .buxa-config-brand { display: none; }
98: .buxa-layout-config-app .buxa-config-tree { display: flex; flex-wrap: wrap; gap: 4px; }
99: .buxa-layout-config-app .buxa-config-tree-label { display: none; }
100: .buxa-layout-config-app .buxa-config-tree button[data-config-section] { flex: 1 0 auto; width: auto; min-height: 30px; padding: 0 9px; font-size: 10px; }
101: .buxa-warning-preview-actions { align-items: stretch; flex-direction: column; }
104: .buxa-warning-position-picker { gap: 5px; }
105: .buxa-warning-position-content { padding: 10px 4px; }
106: .buxa-warning-position-content strong { font-size: 10px; }
109: .buxa-warning-position-content { transition: none; }
110: .buxa-warning-position-option:hover .buxa-warning-position-content { transform: none; }
```

### `styles/35-inventory-config.css` — 6 matching lines

```css
5: .buxa-equipment-layout-config-row {
17: .buxa-equipment-layout-config-row strong {
24: .buxa-equipment-layout-config-row button {
40: .buxa-equipment-layout-config-row button:hover {
46: .buxa-equipment-layout-config-row {
51: .buxa-equipment-layout-config-row button {
```

### `styles/37-addons.css` — 9 matching lines

```css
5: .buxa-addon-grid {
11: .buxa-addon-card {
24: .buxa-addon-card:hover {
28: .buxa-addon-card > input {
32: .buxa-addon-main {
40: .buxa-addon-main strong {
50: .buxa-addon-main small {
61: .buxa-addon-main small.is-active {
67: .buxa-addon-grid {
```

### `styles/38-svg-picker.css` — 12 matching lines

```css
137: .buxa-config-icon-control {
145: .buxa-config-icon-control > label {
155: .buxa-config-icon-control input[type="checkbox"] {
159: .buxa-config-icon-preview,
160: .buxa-config-icon-pick {
172: .buxa-config-icon-preview {
177: .buxa-config-icon-preview img {
185: .buxa-config-icon-preview.is-empty::before {
191: .buxa-config-icon-pick {
222: .buxa-config-resource > .buxa-config-icon-control,
223: .buxa-config-proficiency > .buxa-config-icon-control,
224: .buxa-config-advanced > .buxa-config-icon-control {
```

### `styles/39-item-config-v2.css` — 1 matching lines

```css
4: .buxa-item-config-app { --buxa-config-accent: #69bde9; }
```

### `styles/39-items.css` — 10 matching lines

```css
171: .buxa-item-config-app .buxa-item-config-block > label:not(.buxa-config-toggle) > span:first-child {
215: .buxa-rarity-config-list { display: grid; gap: 7px; }
216: .buxa-rarity-config-row { border: 1px solid #283344; background: #111722; }
217: .buxa-rarity-config-main {
226: .buxa-rarity-config-id { align-self: center; color: #526075; font-size: 8px; text-transform: uppercase; }
227: .buxa-rarity-config-main button { width: 28px !important; min-width: 28px !important; height: 28px !important; margin: 0 !important; color: #e66d78 !important; }
228: .buxa-rarity-config-flags { display: flex; flex-wrap: wrap; gap: 12px; padding: 0 8px 8px 28px; color: #8290a4; font-size: 8px; }
229: .buxa-rarity-config-flags label { display: flex; align-items: center; gap: 4px; }
304: .buxa-rarity-config-main { grid-template-columns: 12px minmax(0, 1fr) 64px 28px; }
305: .buxa-rarity-config-id { display: none; }
```

### `styles/50-sheet-compact.css` — 20 matching lines

```css
331: .buxa-rebirth-global-editor {
337: .buxa-rebirth-global-editor .buxa-rebirth-style-head,
338: .buxa-rebirth-global-editor .buxa-rebirth-style-row {
345: .buxa-rebirth-global-editor .buxa-rebirth-style-head {
355: .buxa-rebirth-global-editor .buxa-rebirth-style-row {
361: .buxa-rebirth-global-editor .buxa-rebirth-style-row:last-child {
365: .buxa-rebirth-global-editor .buxa-rebirth-style-level {
371: .buxa-rebirth-global-editor input[type="color"] {
376: .buxa-rebirth-style-preview {
388: .buxa-rebirth-style-preview b {
393: .buxa-rebirth-style-preview small {
399: .buxa-rebirth-global-editor .buxa-add-rebirth-style {
429: .buxa-rebirth-global-editor .buxa-rebirth-style-head,
430: .buxa-rebirth-global-editor .buxa-rebirth-style-row {
463: .buxa-config-rebirth-rule-list {
470: .buxa-config-rebirth-rule {
476: .buxa-config-rebirth-rule-head {
486: .buxa-config-rebirth-rule-head strong {
491: .buxa-config-rebirth-rule-head small {
500: .buxa-config-rebirth-rule-list {
```

## Migration contract

- One active owner: `styles/30-module-config-system.css` (loaded last).
- The existing settings data attributes and serializer are unchanged.
- Original native checkbox/slider/color/text/number controls remain the value source.
- Custom select trigger/listbox is presentation only; underlying select receives changes.
- No legacy config stylesheets are imported after migration.
