// Remove selected records while retaining recurring history in other tabs.
export function completeSelectedOccurrences(reminders, rows, completedAt) {
  const selected = new Map(rows.map((r) => [r.id, r.date]));
  return reminders.map((r) => {
    const date = selected.get(r.id);
    if (!date || r.completed) return r;
    return r.repeat && r.repeat !== "none"
      ? { ...r, completedDates: [...new Set([...(r.completedDates || []), date])],
          completedDateTimes: { ...r.completedDateTimes, [date]: completedAt } }
      : { ...r, completed: true, completedAt };
  });
}

export function deleteSelected(reminders, deletedIds, scope) {
  return reminders.flatMap((r) => {
    if (!deletedIds.has(r.id)) return [r];
    if (scope !== "Calendar" && r.repeat && r.repeat !== "none" && !r.completed) {
      if (scope === "Completed") return [{ ...r, completedDates: [] }];
      return (r.completedDates || []).map((date) => ({
        ...r,
        id: r.id + ":history:" + date,
        date,
        repeat: "none",
        completed: true,
        completedDates: [],
        notificationId: null,
      }));
    }
    return [];
  });
}
