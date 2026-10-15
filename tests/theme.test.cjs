const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const app = fs.readFileSync('App.js', 'utf8');
const body = app.slice(app.indexOf('  const updateSettings = async (patch) => {'), app.indexOf('  const openNew ='));

function harness() {
  const settingsRef = { current: { theme: 'light', soundEnabled: true } };
  let displayed = settingsRef.current;
  const writes = [];
  const update = new Function('settingsRef', 'setSettings', 'saveSettings', 'setForegroundNotificationSound', 'Alert', `${body}; return updateSettings;`)(
    settingsRef, value => { displayed = value; }, value => new Promise((resolve, reject) => writes.push({ value, resolve, reject })), () => {}, { alert() {} },
  );
  return { update, writes, displayed: () => displayed };
}

test('rapid theme taps use the latest selection before any render or storage completion', async () => {
  const h = harness();
  const pending = [];
  for (let i = 0; i < 21; i++) {
    pending.push(h.update({ theme: current => current === 'dark' ? 'light' : 'dark' }));
    assert.equal(h.displayed().theme, i % 2 === 0 ? 'dark' : 'light');
  }
  h.writes.forEach(write => write.resolve());
  await Promise.all(pending);
  assert.equal(h.displayed().theme, 'dark');
  assert.equal(h.writes.at(-1).value.theme, 'dark');
});

test('failed earlier and latest writes cannot roll back the selected theme', async () => {
  const h = harness();
  const first = h.update({ theme: 'dark' });
  const last = h.update({ theme: 'light' });
  h.writes[0].reject(new Error('storage unavailable'));
  await first;
  assert.equal(h.displayed().theme, 'light');
  h.writes[1].reject(new Error('storage unavailable'));
  await last;
  assert.equal(h.displayed().theme, 'light');
});
