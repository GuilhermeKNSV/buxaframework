import test from "node:test";
import assert from "node:assert/strict";
import { identifyFlatIconBackground, removeFlatIconBackground } from "../scripts/apps/item-artwork.js";

function rgba(size, background, foreground) {
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y*size+x)*4;
    const color = x>size*.25 && x<size*.75 && y>size*.25 && y<size*.75 ? foreground : background;
    pixels.set(color,i);
  }
  return pixels;
}
test("opaque monochrome PNG-style icons lose only their flat backgrounds", () => {
  const pixels = rgba(64,[37,48,48,255],[242,247,243,255]);
  assert.deepEqual(identifyFlatIconBackground(pixels,64,64),[37,48,48]);
  assert.equal(removeFlatIconBackground(pixels,64,64),true);
  assert.equal(pixels[3],0);
  const middle=(32*64+32)*4;
  assert.equal(pixels[middle+3],255);
});
test("already transparent PNG remains unchanged", () => {
  const pixels = rgba(64,[33,45,49,0],[247,246,240,255]);
  assert.equal(removeFlatIconBackground(pixels,64,64),false);
  assert.equal(pixels[3],0);
});
test("full-color backgrounds are left unchanged", () => {
  const pixels = rgba(64,[39,80,165,255],[231,161,42,255]);
  assert.equal(removeFlatIconBackground(pixels,64,64),false);
  assert.equal(pixels[3],255);
});
test("light illustrated images remain untouched", () => {
  const pixels = rgba(64,[215,202,183,255],[245,245,244,255]);
  assert.equal(removeFlatIconBackground(pixels,64,64),false);
});
test("invalid and tiny images do not throw or get edited",()=>{
  assert.equal(identifyFlatIconBackground(new Uint8ClampedArray(4),1,1),null);
});
