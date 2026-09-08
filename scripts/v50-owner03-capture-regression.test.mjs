import assert from 'node:assert/strict';
import test from 'node:test';

import { BLACK_BAND, classifyBlackBandEvidence } from './v50-owner03-capture-utils.mjs';

test('classifies painted runtime band as runtime defect', () => {
  assert.equal(classifyBlackBandEvidence({ runtimeHasBand: true }), BLACK_BAND.runtime);
});

test('classifies reference artifact or early capture as harness defect', () => {
  assert.equal(classifyBlackBandEvidence({
    runtimeHasBand: false,
    prototypeHasBand: true,
  }), BLACK_BAND.capture);
  assert.equal(classifyBlackBandEvidence({
    runtimeHasBand: false,
    capturedBeforeReady: true,
  }), BLACK_BAND.capture);
});

test('does not invent a defect when both surfaces are clean and ready', () => {
  assert.equal(classifyBlackBandEvidence({ runtimeHasBand: false }), BLACK_BAND.none);
});
