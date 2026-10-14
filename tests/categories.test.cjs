const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const url = text => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
const recurrence = url(fs.readFileSync('src/lib/recurrence.js', 'utf8'));
const retention = url(fs.readFileSync("src/lib/retention.js", "utf8"));
const categories = import(url(fs.readFileSync('src/lib/categories.js', 'utf8').replace('"./recurrence"', JSON.stringify(recurrence)).replace('"./retention"', JSON.stringify(retention))));
const now = new Date('2026-10-14T12:00:00');
const reminder = (id, date, time, extras = {}) => ({ id, title: id, date, time, repeat: 'none', completed: false, ...extras });
test('categories partition one-time reminders and sort by relevant date', async () => {
  const { reminderCategories } = await categories;
  const rows = reminderCategories([
    reminder('later', '2026-10-15', '08:00'), reminder('nearest', '2026-10-14', '13:00'),
    reminder('old', '2026-10-12', '10:00'), reminder('recent', '2026-10-14', '10:00'),
    reminder('done-old', '2026-10-10', '10:00', { completed: true }),
    reminder('done-new', '2026-10-13', '10:00', { completed: true }),
  ], now);
  assert.deepEqual(rows.Upcoming.map(r => r.id), ['nearest', 'later']);
  assert.deepEqual(rows.Missed.map(r => r.id), ['recent', 'old']);
  assert.deepEqual(rows.Completed.map(r => r.id), ['done-new', 'done-old']);
});
test('recurrence preserves completed history and separates today missed from upcoming', async () => {
  const { reminderCategories } = await categories;
  const rows = reminderCategories([
    reminder('daily-missed', '2026-10-01', '10:00', { repeat: 'daily' }),
    reminder('daily-future', '2026-10-01', '14:00', { repeat: 'daily', completedDates: ['2026-10-13', '2026-10-11'] }),
    reminder('today-complete', '2026-10-01', '10:00', { repeat: 'daily', completedDates: ['2026-10-14'] }),
    reminder('ended', '2026-10-01', '10:00', { repeat: 'daily', repeatUntil: '2026-10-12' }),
  ], now);
  assert.deepEqual(rows.Missed.map(r => [r.id, r.date]), [['daily-missed', '2026-10-14'], ['ended', '2026-10-12']]);
  assert.deepEqual(rows.Upcoming.map(r => [r.id, r.date]), [['daily-future', '2026-10-14'], ['today-complete', '2026-10-15']]);
  assert.equal(rows.Completed.find(r => r.id === 'daily-future').date, '2026-10-13');
});
test('bulk deletion preserves history outside the selected category', async () => {
  const { deleteSelected } = await import(url(fs.readFileSync('src/lib/selection.js', 'utf8')));
  const series = reminder('series', '2026-10-01', '10:00', {repeat: 'daily', completedDates: ['2026-10-13']});
  const other = reminder('other', '2026-10-15', '10:00');
  const completed = deleteSelected([series, other], new Set(['series']), 'Completed');
  assert.equal(completed[0].completedDates.length, 0);
  assert.deepEqual(completed[1], other);
  const upcoming = deleteSelected([series, other], new Set(['series']), 'Upcoming');
  assert.equal(upcoming[0].completed, true);
  assert.equal(upcoming[0].date, '2026-10-13');
  assert.deepEqual(upcoming[1], other);
});

test('expired recurring completions disappear without reactivating completed occurrences', async () => {
  const { reminderCategories } = await categories;
  const series = reminder('series', '2026-10-01', '10:00', {
    repeat: 'daily', completedDates: ['2026-10-01', '2026-10-14'],
    completedDateTimes: { '2026-10-01': '2026-10-01T10:00:00', '2026-10-14': '2026-10-14T11:00:00' },
  });
  const rows = reminderCategories([series], now);
  assert.equal(rows.Completed[0].date, '2026-10-14');
  assert.equal(rows.Missed.length, 0);
  const later = reminderCategories([series], new Date('2026-10-22T09:00:00'));
  assert.equal(later.Completed.length, 0);
  assert.equal(later.Upcoming[0].id, 'series');
  assert.deepEqual(series.completedDates, ['2026-10-01', '2026-10-14']);
});
