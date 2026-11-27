import assert from "node:assert/strict";
import { test } from "node:test";
import { viewerFrame } from "../src/lib/viewer-frame";

test("rotation accepts the new visible height even when iOS changes scale", () => {
  assert.deepEqual(viewerFrame(844, 390, { width: 760, height: 280, offsetLeft: 0, offsetTop: 0, scale: 0.95 }), {width:760,height:280});
});
test("stale oversized visualViewport reports cannot expand the native CSS container", () => {
  assert.deepEqual(viewerFrame(736, 260, { width: 844, height: 390, offsetLeft: 47, offsetTop: 0, scale: 1 }), {width:736,height:260});
  assert.deepEqual(viewerFrame(390, 650, { width: 844, height: 390, offsetLeft: 0, offsetTop: 0, scale: 1 }), {width:390,height:390});
});
test("missing and transient invalid visual dimensions use the native container", () => {
  assert.deepEqual(viewerFrame(390, 650), {width:390,height:650});
  assert.deepEqual(viewerFrame(844, 320, {width:0,height:NaN,offsetLeft:-3,offsetTop:Infinity,scale:1}), {width:844,height:320});
});
