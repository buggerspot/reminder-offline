export function indexReminderCategories(categories) {
  return Object.fromEntries(Object.entries(categories).map(([name, rows]) => [name,
    rows.map(item => ({ item, text: `${item.title} ${item.description || ""}`.toLowerCase() })),
  ]));
}

export function searchReminderCategory(index, category, query) {
  const text = query.trim().toLowerCase();
  return (index[category] || []).filter(row => !text || row.text.includes(text)).map(row => row.item);
}
