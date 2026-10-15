const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const load = file => import(`data:text/javascript;base64,${Buffer.from(fs.readFileSync(file, 'utf8')).toString('base64')}`);

test('calendar excludes missed and completed occurrences on the selected date', async () => {
  const { calendarOccurrences } = await load('src/lib/recurrence.js');
  const base = { date: '2026-10-15', time: '10:00', repeat: 'none' };
  const rows = calendarOccurrences([
    { ...base, id: 'missed' },
    { ...base, id: 'active', time: '14:00' },
    { ...base, id: 'completed', completed: true },
    { ...base, id: 'other-day', date: '2026-10-16' },
    { ...base, id: 'series', date: '2026-10-01', repeat: 'daily', completedDates: ['2026-10-15'] },
    { ...base, id: 'ended', date: '2026-10-01', repeat: 'daily', repeatUntil: '2026-10-14' },
  ], '2026-10-15', +new Date('2026-10-15T12:00:00'));
  assert.deepEqual(rows.map(r => r.id), ['active']);
  assert.equal(rows[0].completed, false);
  assert.equal(rows[0].missed, false);
  assert.equal(rows[0].date, '2026-10-15');
  const recurring = { ...base, id: 'recurring', date: '2026-10-01', repeat: 'daily', completedDates: ['2026-10-15'] };
  assert.equal(calendarOccurrences([recurring], '2026-10-15', +new Date('2026-10-15T09:00:00')).length, 0);
  assert.equal(calendarOccurrences([recurring], '2026-10-16', +new Date('2026-10-15T12:00:00')).length, 1);
  assert.equal(calendarOccurrences([{ ...base }], '2026-10-15', +new Date('2026-10-15T10:00:00')).length, 1);
  assert.equal(calendarOccurrences([{ ...base }], '2026-10-15', +new Date('2026-10-15T10:00:01')).length, 0);

});

test('bulk completion completes displayed occurrences and preserves future recurrence and images', async () => {
  const { completeSelectedOccurrences } = await load('src/lib/selection.js');
  const { nextOccurrence } = await load('src/lib/recurrence.js');
  const series = { id: 'series', date: '2026-10-01', time: '10:00', repeat: 'daily', imageUri: 'file:///image.png', completedDates: ['2026-10-14'] };
  const one = { id: 'once', date: '2026-10-16', time: '11:00', repeat: 'none' };
  const untouched = { ...one, id: 'untouched' };
  const completedAt = '2026-10-15T12:00:00Z';
  const rows = [{ ...series, date: '2026-10-16' }, one];
  const result = completeSelectedOccurrences([series, one, untouched], rows, completedAt);
  assert.deepEqual(result[0].completedDates, ['2026-10-14', '2026-10-16']);
  assert.equal(result[0].completedDateTimes['2026-10-16'], completedAt);
  assert.equal(result[0].imageUri, series.imageUri);
  assert.equal(nextOccurrence(result[0], new Date('2026-10-15T12:00:00')), '2026-10-17');
  assert.equal(result[1].completed, true);
  assert.equal(result[1].completedAt, completedAt);
  assert.equal(result[2], untouched);
  assert.deepEqual(series.completedDates, ['2026-10-14']);
  assert.deepEqual(completeSelectedOccurrences(result, rows, completedAt)[0].completedDates, result[0].completedDates);
});
