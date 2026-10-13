import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

function csvCell(value) {
  const s = String(value ?? '');
  return `"${s.replace(/"/g, '""')}"`;
}
export async function exportJSON(reminders) {
  const payload = { app: 'Reminder Pro', schemaVersion: 1, exportedAt: new Date().toISOString(), reminders };
  const uri = `${FileSystem.cacheDirectory}reminder-pro-backup-${Date.now()}.json`;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(payload, null, 2));
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Export reminders' });
  return uri;
}
export async function exportCSV(reminders) {
  const headers = ['title','description','date','time','repeat','repeatUntil','completed','createdAt'];
  const rows = reminders.map(r => headers.map(h => csvCell(r[h])).join(','));
  const content = [headers.join(','), ...rows].join('\r\n');
  const uri = `${FileSystem.cacheDirectory}reminder-pro-${Date.now()}.csv`;
  await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Export reminders as CSV' });
  return uri;
}
export async function importReminders() {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/csv', 'text/comma-separated-values'], copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const raw = await FileSystem.readAsStringAsync(asset.uri);
  if (asset.name?.toLowerCase().endsWith('.csv') || raw.trim().startsWith('"title"') || raw.trim().startsWith('title,')) {
    const lines = raw.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) throw new Error('The CSV file has no reminder rows.');
    const parseRow = line => {
      const cells = []; let value = ''; let quoted = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"' && quoted && line[i + 1] === '"') { value += '"'; i++; }
        else if (c === '"') quoted = !quoted;
        else if (c === ',' && !quoted) { cells.push(value); value = ''; }
        else value += c;
      }
      cells.push(value); return cells;
    };
    const headers = parseRow(lines[0]);
    return lines.slice(1).map(line => {
      const cells = parseRow(line); const obj = {};
      headers.forEach((h, i) => { obj[h] = cells[i] ?? ''; });
      obj.completed = obj.completed === true || obj.completed === 'true';
      return obj;
    });
  }
  const parsed = JSON.parse(raw);
  const reminders = Array.isArray(parsed) ? parsed : parsed.reminders;
  if (!Array.isArray(reminders)) throw new Error('This file is not a Reminder Pro backup.');
  return reminders;
}
