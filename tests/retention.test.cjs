const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const url = text => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
const retention = import(url(fs.readFileSync('src/lib/retention.js', 'utf8')));

test('cleanup uses elapsed time, keeps boundary and active records, and survives serialization', async () => {
  const { cleanupCompleted, COMPLETED_RETENTION_MS } = await retention;
  const now = Date.parse('2026-10-14T12:00:00Z');
  const records = [
    { id: 'expired', completed: true, completedAt: new Date(now - COMPLETED_RETENTION_MS - 1).toISOString() },
    { id: 'boundary', completed: true, completedAt: '2026-10-07T17:30:00+05:30' },
    { id: 'pending', completed: false, date: '2020-01-01' },
    { id: 'series', repeat: 'daily', completedDates: ['2020-01-01'] },
    { id: 'legacy', completed: true },
    { id: 'invalid', completed: true, completedAt: 'invalid' },
  ];
  const cleaned = cleanupCompleted(records, now);
  assert.deepEqual(cleaned.map(r => r.id), ['boundary', 'pending', 'series', 'legacy', 'invalid']);
  assert.equal(cleaned[2], records[3]);
  assert.equal(cleaned[3].completedAt, new Date(now).toISOString());
  const restarted = JSON.parse(JSON.stringify(cleaned));
  assert.equal(cleanupCompleted(restarted, now), restarted);
  assert.deepEqual(cleanupCompleted(restarted, now + COMPLETED_RETENTION_MS + 1).map(r => r.id), ['pending', 'series']);
});

test('native containers have no raw JSX text, including inline whitespace', () => {
  const parser = require('@babel/parser');
  for (const file of ['App.js', 'src/components.jsx', 'src/interaction-components.jsx', 'src/permission-onboarding.jsx']) {
    const ast = parser.parse(fs.readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
    function visit(node, parent) {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'JSXText' && !['Text', 'Label'].includes(parent?.openingElement?.name?.name)) {
        assert.ok(!node.value.trim() && /[\r\n]/.test(node.value), `${file}:${node.loc.start.line} raw text`);
      }
      for (const [key, value] of Object.entries(node)) {
        if (key === 'loc') continue;
        if (Array.isArray(value)) value.forEach(child => visit(child, node));
        else if (value && typeof value === 'object') visit(value, node);
      }
    }
    visit(ast);
  }
});

test('cleanup persists deletions through the real storage index on reload', async () => {
  const values = new Map();
  globalThis.__retentionStorage = {
    getItem: async key => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    removeItem: async key => { values.delete(key); },
    multiGet: async keys => keys.map(key => [key, values.get(key) ?? null]),
    multiSet: async entries => { entries.forEach(([key, value]) => values.set(key, value)); },
    multiRemove: async keys => { keys.forEach(key => values.delete(key)); },
  };
  try {
    const source = fs.readFileSync('src/lib/storage.js', 'utf8').replace(
      'import AsyncStorage from "@react-native-async-storage/async-storage";',
      'const AsyncStorage = globalThis.__retentionStorage;',
    );
    const storage = await import(url(source));
    const { cleanupCompleted } = await retention;
    const records = [
      { id: 'expired', completed: true, completedAt: '2026-10-01T12:00:00Z' },
      { id: 'active', completed: false },
    ];
    await storage.saveReminders(records);
    await storage.saveReminders(cleanupCompleted(await storage.loadReminders(), Date.parse('2026-10-14T12:00:00Z')));
    const restarted = await import(url(source + '\n// fresh storage instance'));
    assert.deepEqual((await restarted.loadReminders()).map(r => r.id), ['active']);
    assert.equal(values.has('@offline-reminder/reminder-v2/expired'), false);
  } finally {
    delete globalThis.__retentionStorage;
  }
});
