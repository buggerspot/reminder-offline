// Remove selected records while retaining recurring history in other tabs.
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
