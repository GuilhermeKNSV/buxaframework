import test from "node:test";
import assert from "node:assert/strict";
import { estimateResourceHudWidth, resourceHudZoomMultiplier } from "../scripts/core/resource-hud-zoom.js";

const zoom = (z, width=160, viewportWidth=1440) => resourceHudZoomMultiplier(z, { baseWidth: width, viewportWidth });

test("distant tokens receive a modest, capped zoom correction", () => {
  assert.equal(zoom(1), 1);
  assert.ok(zoom(0.5) > 1.3 && zoom(0.5) < 1.7);
  assert.ok(zoom(0.25) > zoom(0.5));
  assert.ok(zoom(0.1) <= 2.35);
  assert.ok(zoom(0.001) <= 2.35);
  assert.ok(zoom(2) < 1);
});

test("screen-size cap prevents large HUDs from taking over the canvas", () => {
  for (const viewportWidth of [420, 900, 1920]) {
    for (const factor of [0.25, 0.5, 1, 2, 4]) {
      const intrinsicWidth=630;
      const screenWidth=intrinsicWidth * factor * zoom(factor, intrinsicWidth, viewportWidth);
      assert.ok(screenWidth <= Math.min(380, viewportWidth * 0.31) + 0.00001,
        `viewport ${viewportWidth}, zoom ${factor}, width ${screenWidth}`);
    }
  }
});

test("invalid, unavailable and stale zoom information safely falls back", () => {
  assert.equal(resourceHudZoomMultiplier(undefined), 1);
  assert.equal(resourceHudZoomMultiplier(0), 1);
  assert.equal(resourceHudZoomMultiplier(NaN), 1);
  assert.ok(resourceHudZoomMultiplier(0.25, { baseWidth: 160 }) > 1);
  assert.equal(resourceHudZoomMultiplier(Infinity), 1);
});

test("HUD screen-width estimate accounts for three visual styles and custom scale", () => {
  const token={w:100,h:130};
  const entries=[
    {settings:{style:"sao",scale:1,thickness:11}},
    {settings:{style:"classic",scale:2.5,thickness:28}},
    {settings:{style:"vertical",scale:1,thickness:20}}
  ];
  assert.ok(estimateResourceHudWidth(token,entries) >= 90 * 2.5);
  assert.equal(estimateResourceHudWidth(token,[]),1);
});
