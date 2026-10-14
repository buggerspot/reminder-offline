export const COMPLETED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export function recentCompletion(value, now = Date.now()) {
  const timestamp = Date.parse(value);
  return !Number.isFinite(timestamp) || timestamp >= now - COMPLETED_RETENTION_MS;
}

// Recurring completedDates are scheduling exclusions: retaining them prevents
// old completed occurrences from becoming missed reminders again.
export function cleanupCompleted(reminders, now = Date.now()) {
  let changed = false;
  const next = reminders.filter((r) => {
    const keep = !r.completed || recentCompletion(r.completedAt, now);
    if (!keep) changed = true;
    return keep;
  }).map((r) => {
    if (r.completed && !Number.isFinite(Date.parse(r.completedAt))) {
      changed = true;
      return { ...r, completedAt: new Date(now).toISOString() };
    }
    return r;
  });
  return changed ? next : reminders;
}
