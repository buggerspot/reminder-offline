const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const moduleFrom = file => import(`data:text/javascript;base64,${Buffer.from(fs.readFileSync(file, 'utf8')).toString('base64')}`);

test('preview follows native completion, pauses/resumes, and rejects stale events', async () => {
  const { createSoundPreview } = await moduleFrom('src/lib/sound-preview.js');
  const calls = [];
  const preview = createSoundPreview(Object.fromEntries(['start', 'pause', 'resume', 'stop'].map(name => [name, (...args) => { calls.push([name, ...args]); }])));
  await preview.toggle({ id: 'short', name: 'Same name' });
  const first = preview.getSnapshot().session;
  preview.receive({ session: first, state: 'playing' });
  await preview.toggle({ id: 'short' });
  assert.equal(preview.getSnapshot().status, 'paused');
  await preview.toggle({ id: 'short' });
  assert.equal(preview.getSnapshot().status, 'playing');
  assert.deepEqual(calls.slice(1).map(call => call[0]), ['pause', 'resume']);
  preview.receive({ session: first, state: 'ended' });
  assert.equal(preview.getSnapshot().status, 'stopped');
  await preview.toggle({ id: 'long', name: 'Same name' });
  const second = preview.getSnapshot().session;
  preview.receive({ session: first, state: 'ended' });
  preview.receive({ session: first, state: 'error', message: 'old error' });
  assert.equal(preview.getSnapshot().session, second);
  preview.receive({ session: second, state: 'playing' });
  assert.equal(preview.getSnapshot().status, 'playing');
  preview.receive({ session: second, state: 'ended' });
  assert.equal(preview.getSnapshot().soundKey, null);
});

test('stop cancels pending preparation and ignores its eventual failure', async () => {
  const { createSoundPreview } = await moduleFrom('src/lib/sound-preview.js');
  let reject, isCurrent;
  const preview = createSoundPreview({ start: (sound, session, current) => { isCurrent = current; return new Promise((resolve, fail) => { reject = fail; }); }, stop() {} });
  const pending = preview.toggle({ id: 'imported' });
  assert.equal(isCurrent(), true);
  preview.stop();
  assert.equal(isCurrent(), false);
  reject(new Error('late file error'));
  await pending;
  assert.equal(preview.getSnapshot().status, 'stopped');
  assert.equal(preview.getSnapshot().error, null);
});

test('current playback errors clear the active indicator and allow retry', async () => {
  const { createSoundPreview } = await moduleFrom('src/lib/sound-preview.js');
  const preview = createSoundPreview({ start() { throw new Error('Unreadable audio'); }, stop() {} });
  await preview.toggle({ id: 'broken' });
  assert.equal(preview.getSnapshot().session, null);
  assert.equal(preview.getSnapshot().error, 'Unreadable audio');
  preview.stop();
  assert.equal(preview.getSnapshot().error, null);
});

test('pause during file preparation is retained when native loading arrives', async () => {
  const { createSoundPreview } = await moduleFrom('src/lib/sound-preview.js');
  let ready;
  const pauses = [];
  const preview = createSoundPreview({ start: () => new Promise(resolve => { ready = resolve; }), pause: session => pauses.push(session), stop() {} });
  const pending = preview.toggle({ id: 'file' });
  const session = preview.getSnapshot().session;
  await preview.toggle({ id: 'file' });
  preview.receive({ session, state: 'loading' });
  ready();
  await pending;
  assert.equal(preview.getSnapshot().status, 'paused');
  assert.deepEqual(pauses, [session, session]);
});

test('indexed search matches title and description without mixing categories or copying records', async () => {
  const { indexReminderCategories, searchReminderCategory } = await moduleFrom('src/lib/search.js');
  const active = { title: 'Buy Milk', description: 'Corner Store' };
  const done = { title: 'Buy Milk', completed: true };
  const index = indexReminderCategories({ Upcoming: [active], Completed: [done] });
  assert.deepEqual(searchReminderCategory(index, 'Upcoming', ' STORE '), [active]);
  assert.equal(searchReminderCategory(index, 'Upcoming', 'milk')[0], active);
  assert.equal(searchReminderCategory(index, 'Completed', '')[0], done);
  assert.deepEqual(searchReminderCategory(index, 'Upcoming', 'absent'), []);
});

test('isolated editor and dialog stores publish immediately and preserve dialog order', async () => {
  const { createEditorPresentation, createDialogQueue } = await moduleFrom('src/lib/presentation.js');
  const editor = createEditorPresentation();
  const form = { title: 'Draft' };
  editor.open(form);
  assert.equal(editor.getSnapshot().form, form);
  editor.close();
  assert.equal(editor.getSnapshot(), null);
  const dialogs = createDialogQueue();
  dialogs.alert('First', 'one');
  dialogs.alert('Second', 'two');
  assert.equal(dialogs.getSnapshot().title, 'First');
  dialogs.close();
  assert.equal(dialogs.getSnapshot().title, 'Second');
  dialogs.close();
  assert.equal(dialogs.getSnapshot(), null);
});
