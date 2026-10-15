const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('src/lib/presentation.js', 'utf8');
const logic = import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('tab taps issue the native command before rendering subscribers and discard stale page events', async () => {
  const { createTabNavigation } = await logic;
  const nav = createTabNavigation(['Home', 'Calendar', 'Settings']);
  const events = [];
  nav.bind(index => events.push(`native:${index}`));
  nav.subscribe(() => events.push(`render:${nav.getSnapshot()}`));
  nav.navigate('Calendar');
  assert.deepEqual(events, ['native:1', 'render:Calendar']);
  nav.navigate('Settings');
  nav.selected(1); // Late callback from the previous tap.
  assert.equal(nav.getSnapshot(), 'Settings');
  nav.selected(2);
  nav.navigate('Settings');
  nav.navigate('unknown');
  assert.deepEqual(events, ['native:1', 'render:Calendar', 'native:2', 'render:Settings']);
  nav.beginSwipe();
  nav.selected(1);
  assert.equal(nav.getSnapshot(), 'Calendar');
  assert.equal(events.at(-1), 'render:Calendar');
  assert.equal(events.filter(event => event.startsWith('native:')).length, 2);
});

test('repeated reminder taps cannot stack or restart a presentation', async () => {
  const { createReminderPresentation } = await logic;
  const details = createReminderPresentation();
  const item = { id: 'one', date: '2026-10-15' };
  let renders = 0;
  details.subscribe(() => renders++);
  assert.equal(details.open(item), true);
  assert.equal(details.open(item), false);
  assert.equal(details.open({ id: 'two' }), false);
  details.shown();
  assert.equal(details.open(item), false);
  assert.equal(renders, 1);
  assert.equal(details.beginClose(), true);
  assert.equal(details.beginClose(), false);
  assert.equal(details.open({ id: 'two' }), false);
  details.finishClose();
  assert.equal(details.getSnapshot(), null);
  assert.equal(details.open({ id: 'two' }), true);
});

test('layout and native onShow start exactly one entrance in either order', async () => {
  const { createSheetOpening } = await logic;
  const opening = createSheetOpening();
  assert.equal(opening.measured(), false);
  assert.equal(opening.shown(), true);
  assert.equal(opening.shown(), false);
  assert.equal(opening.measured(), false);
  opening.reset();
  assert.equal(opening.shown(), false);
  assert.equal(opening.shown(), false);
  assert.equal(opening.measured(), true);
  assert.equal(opening.measured(), false);
  assert.equal(opening.shown(), false);
});

test('programmatic reminder updates preserve the presentation and cleanup can clear it', async () => {
  const { createReminderPresentation } = await logic;
  const details = createReminderPresentation();
  details.set({ id: 'series', date: '2026-10-16' });
  details.shown();
  details.set(item => ({ ...item, description: 'Updated' }));
  assert.equal(details.getSnapshot().date, '2026-10-16');
  assert.equal(details.getSnapshot().description, 'Updated');
  assert.equal(details.open({ id: 'series' }), false);
  details.set(null);
  assert.equal(details.open({ id: 'next' }), true);
});

test('Home category selection is tap-only, isolated, and ignores duplicate or invalid taps', async () => {
  const { createCategorySelection, createTabNavigation } = await logic;
  const categories = createCategorySelection(['Upcoming', 'Completed', 'Missed']);
  const navigation = createTabNavigation(['Home', 'Calendar', 'Settings']);
  const updates = [];
  let navigationUpdates = 0;
  categories.subscribe(() => updates.push(categories.getSnapshot()));
  navigation.subscribe(() => navigationUpdates++);
  categories.select('Completed');
  categories.select('Completed');
  categories.select('unknown');
  categories.select('Missed');
  categories.select('Upcoming');
  assert.deepEqual(updates, ['Completed', 'Missed', 'Upcoming']);
  assert.equal(navigationUpdates, 0);
  assert.equal(navigation.getSnapshot(), 'Home');
  assert.equal(categories.beginSwipe, undefined);
});

test('sheet layout reuse invalidates for visible edits, width, text scale, and safe-area changes', async () => {
  const { reminderLayoutKey } = await logic;
  const item = { id: 'one', title: 'Appointment', description: 'Bring notes', date: '2026-10-15', time: '12:00', repeat: 'none', completed: false };
  const key = reminderLayoutKey(item, 390, 1, 16);
  assert.equal(reminderLayoutKey({ ...item, notificationId: 'rescheduled', updatedAt: 'later' }, 390, 1, 16), key);
  for (const patch of [{ title: 'Longer title' }, { description: 'A longer description\nwith multiple lines' }, { date: '2026-10-16' }, { time: '14:00' }, { completed: true }, { imageUri: 'file:///new-image.png' }, { repeat: 'daily' }, { repeatUntil: '2026-11-01' }]) {
    assert.notEqual(reminderLayoutKey({ ...item, ...patch }, 390, 1, 16), key);
  }
  assert.notEqual(reminderLayoutKey(item, 844, 1, 16), key);
  assert.notEqual(reminderLayoutKey(item, 390, 1.5, 16), key);
  assert.notEqual(reminderLayoutKey(item, 390, 1, 0), key);
  assert.equal(reminderLayoutKey(null, 390, 1), null);
});
