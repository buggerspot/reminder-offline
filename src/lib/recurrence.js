export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dateValidation = new Map();
export function validDate(value) {
  if (dateValidation.has(value)) return dateValidation.get(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const d = new Date(`${value}T12:00:00`);
  const valid = !Number.isNaN(+d) && localDate(d) === value;
  if (dateValidation.size >= 512) dateValidation.clear();
  dateValidation.set(value, valid);
  return valid;
}
export function occursOn(r, date, includeCompleted = false) {
  if (
    !validDate(date) ||
    (!includeCompleted && r.completed) ||
    date < r.date ||
    (r.repeatUntil && date > r.repeatUntil)
  )
    return false;
  // Legacy backups contain completed recurrence records as individual history entries.
  if (r.completed) return includeCompleted && date === r.date;
  if (!includeCompleted && (r.completedDates || []).includes(date))
    return false;
  switch (r.repeat) {
    case "daily":
      return true;
    case "weekly":
      return (
        r.weekdays?.length
          ? r.weekdays
          : [new Date(`${r.date}T12:00:00`).getDay()]
      ).includes(new Date(`${date}T12:00:00`).getDay());
    case "monthly":
      return Number(date.slice(-2)) === Number(r.monthDay || r.date.slice(-2));
    case "yearly":
      return date.slice(5) === r.date.slice(5);
    default:
      return date === r.date;
  }
}
export function nextOccurrence(r, after = new Date()) {
  if (r.completed) return null;
  const d = new Date(`${localDate(after)}T12:00:00`);
  if (localDate(d) < r.date) d.setTime(+new Date(`${r.date}T12:00:00`));
  if (r.repeat === "monthly" || r.repeat === "yearly") {
    const day =
      r.repeat === "monthly"
        ? Number(r.monthDay || r.date.slice(-2))
        : Number(r.date.slice(-2));
    let year = d.getFullYear(),
      month =
        r.repeat === "yearly" ? Number(r.date.slice(5, 7)) - 1 : d.getMonth();
    for (let i = 0; i < 100; i++) {
      const candidate = new Date(year, month, day, 12);
      const date = localDate(candidate);
      if (r.repeatUntil && date > r.repeatUntil) return null;
      if (
        candidate.getMonth() === month &&
        candidate.getDate() === day &&
        occursOn(r, date) &&
        +new Date(`${date}T${r.time}:00`) > +after
      )
        return date;
      if (r.repeat === "yearly") year++;
      else {
        month++;
        if (month === 12) {
          month = 0;
          year++;
        }
      }
    }
    return null;
  }
  // Eight years covers leap years; nonexistent monthly dates are skipped.
  for (let i = 0; i < 2923; i++, d.setDate(d.getDate() + 1)) {
    const date = localDate(d);
    if (r.repeatUntil && date > r.repeatUntil) break;
    if (occursOn(r, date) && +new Date(`${date}T${r.time}:00`) > +after)
      return date;
    if ((!r.repeat || r.repeat === "none") && date > r.date) break;
  }
  return null;
}
export function displayOccurrence(r, now = new Date()) {
  if (!r.repeat || r.repeat === "none" || r.completed) return r;
  const today = localDate(now);
  const date = occursOn(r, today) ? today : nextOccurrence(r, now);
  return date ? { ...r, seriesDate: r.date, date } : null;
}
export function isMissed(r, now = new Date()) {
  if (r.completed) return false;
  if (!r.repeat || r.repeat === "none")
    return +new Date(`${r.date}T${r.time}:00`) < +now;
  const today = localDate(now);
  return occursOn(r, today) && +new Date(`${today}T${r.time}:00`) < +now;
}
