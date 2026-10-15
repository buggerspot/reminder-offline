const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('src/lib/interactions.js', 'utf8');
const logic = import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('boundary feedback requires outward vertical intent and an actual boundary', async () => {
  const { boundaryPull } = await logic;
  const m = { dx: 0, dy: 30, offset: 0, viewport: 600, content: 1200 };
  assert.equal(boundaryPull(m), 'top');
  assert.equal(boundaryPull({ ...m, dy: 4 }), null);
  assert.equal(boundaryPull({ ...m, dx: 60 }), null);
  assert.equal(boundaryPull({ ...m, offset: 200 }), null);
  assert.equal(boundaryPull({ ...m, dy: -30 }), null);
  assert.equal(boundaryPull({ ...m, offset: 600, dy: -30 }), 'bottom');
  assert.equal(boundaryPull({ ...m, offset: 600, dy: 30 }), null);
  assert.equal(boundaryPull({ ...m, viewport: 0 }), null);
  assert.equal(boundaryPull({ ...m, content: 100, dy: -30 }), 'bottom');
});

test('sheet snaps safely after small drags and supports deliberate expansion and dismissal', async () => {
  const { sheetDestination } = await logic;
  assert.equal(sheetDestination(5, 0, false), 'collapsed');
  assert.equal(sheetDestination(-80, -100, false), 'expand');
  assert.equal(sheetDestination(-10, -800, false), 'expand');
  assert.equal(sheetDestination(120, 0, false), 'close');
  assert.equal(sheetDestination(10, 1000, true), 'collapse');
  assert.equal(sheetDestination(20, 100, true), 'expanded');
  assert.equal(sheetDestination(-100, -1000, true), 'expanded');
});

test('page indices clamp overscroll and remain correct after orientation changes', async () => {
  const { pageIndex } = await logic;
  assert.equal(pageIndex(390, 390), 1);
  assert.equal(pageIndex(780, 390), 2);
  assert.equal(pageIndex(844, 844), 1);
  assert.equal(pageIndex(-200, 390), 0);
  assert.equal(pageIndex(2000, 390), 2);
  assert.equal(pageIndex(390, 0), 0);
});
