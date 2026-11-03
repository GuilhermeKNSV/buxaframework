import test from "node:test";
import assert from "node:assert/strict";
import { planResourceHudLayout } from "../scripts/core/resource-hud-layout.js";

const e = (style,position,thickness=11,scale=1) => ({settings:{style,position,thickness,scale}});

test("different overhead bar styles share one stack with no collisions",()=>{
  const planned=planResourceHudLayout([e("sao","top",28,2),e("classic","top",4,.5),e("sao","top",11)]);
  assert.deepEqual(planned.map(p=>p.offset),[0,73,98]);
  assert.equal(planned[1].offset>=56+17,true);
});

test("side HUD positions that resolve to the same side share accumulated width",()=>{
  const planned=planResourceHudLayout([e("vertical","left",28,1),e("vertical","top",4,1),e("vertical","right",11),e("vertical","bottom",12)]);
  assert.deepEqual(planned.map(p=>p.offset),[0,48,0,31]);
});

test("top/bottom horizontal groups remain independent and share only their own offsets",()=>{
  const planned=planResourceHudLayout([e("sao","top"),e("classic","top"),e("classic","bottom"),e("sao","bottom"),e("sao","top")]);
  assert.deepEqual(planned.map(p=>p.offset),[0,28,0,28,56]);
});
