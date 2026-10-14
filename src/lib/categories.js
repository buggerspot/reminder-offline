import { recentCompletion } from "./retention";
import { displayOccurrence, isMissed, occursOn, localDate, nextOccurrence } from "./recurrence";

// Counts and list rows share one projection, including recurring completion history.
export function reminderCategories(reminders, now = new Date()) {
  const rows = { Upcoming: [], Completed: [], Missed: [] };
  for (const reminder of reminders) {
    const dates = [...(reminder.completedDates || [])].filter((date) => recentCompletion(reminder.completedDateTimes?.[date] || `${date}T${reminder.time || "00:00"}:00`, +now)).sort();
    if ((reminder.completed && recentCompletion(reminder.completedAt, +now)) || dates.length) {
      rows.Completed.push(reminder.completed ? reminder : {
        ...reminder, seriesDate: reminder.date, date: dates[dates.length - 1], completed: true,
      });
    }
    if (reminder.completed) continue;
    let row = displayOccurrence(reminder, now);
    let missed = isMissed(reminder, now);
    // An ended recurring series can still have an uncompleted past occurrence.
    if (!row && !nextOccurrence(reminder, now)) {
      const day = new Date(`${localDate(now)}T12:00:00`);
      if (reminder.repeatUntil && reminder.repeatUntil < localDate(day)) day.setTime(+new Date(`${reminder.repeatUntil}T12:00:00`));
      for (let i = 0; i < 2923 && localDate(day) >= reminder.date; i++, day.setDate(day.getDate() - 1)) {
        const date = localDate(day);
        if (occursOn(reminder, date) && +new Date(`${date}T${reminder.time}:00`) <= +now) {
          row = { ...reminder, seriesDate: reminder.date, date };
          missed = true;
          break;
        }
      }
    }
    if (row) rows[missed ? "Missed" : "Upcoming"].push({ ...row, missed });
  }
  const ascending = (a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
  rows.Upcoming.sort(ascending);
  rows.Completed.sort((a, b) => ascending(b, a));
  rows.Missed.sort((a, b) => ascending(b, a));
  return rows;
}
