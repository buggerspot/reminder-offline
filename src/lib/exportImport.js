import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { Platform } from "react-native";
import { validDate } from "./recurrence";
export function validateBackup(parsed) {
  if (
    !parsed ||
    ![1, 2].includes(parsed.schemaVersion) ||
    !["Offline Reminder", "Reminder Pro"].includes(parsed.app) ||
    !Array.isArray(parsed.reminders)
  )
    throw new Error(
      "Unsupported backup. Choose an Offline Reminder JSON backup (version 1 or 2).",
    );
  if (parsed.reminders.length > 100000)
    throw new Error("This backup exceeds the supported import size.");
  const ids = new Set();
  return parsed.reminders.map((r, i) => {
    if (
      !r ||
      typeof r.title !== "string" ||
      !r.title.trim() ||
      !validDate(r.date) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time || "") ||
      !["none", "daily", "weekly", "monthly", "yearly"].includes(
        r.repeat || "none",
      ) ||
      (r.description != null && typeof r.description !== "string") ||
      (r.completed != null && typeof r.completed !== "boolean") ||
      (r.id != null && typeof r.id !== "string") ||
      (r.repeatUntil &&
        (!validDate(r.repeatUntil) || r.repeatUntil < r.date)) ||
      (r.weekdays != null &&
        (!Array.isArray(r.weekdays) ||
          !r.weekdays.length ||
          r.weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6))) ||
      (r.monthDay != null &&
        (!Number.isInteger(r.monthDay) || r.monthDay < 1 || r.monthDay > 31)) ||
      (r.completedDates != null &&
        (!Array.isArray(r.completedDates) ||
          r.completedDates.some((d) => !validDate(d))))
    )
      throw new Error(
        `Reminder ${i + 1} is invalid. No reminders were imported.`,
      );
    if (r.id && ids.has(r.id))
      throw new Error(
        "This backup contains duplicate IDs. No reminders were imported.",
      );
    ids.add(r.id);
    return {
      id: r.id,
      title: r.title.trim(),
      description: r.description || "",
      date: r.date,
      time: r.time,
      repeat: r.repeat || "none",
      repeatUntil: r.repeatUntil || "",
      weekdays: r.weekdays,
      monthDay: r.monthDay,
      completed: !!r.completed,
      completedDates: r.completedDates || [],
      completedAt: r.completedAt,
      createdAt: r.createdAt || new Date().toISOString(),
      soundId: typeof r.soundId === "string" ? r.soundId : null,
    };
  });
}
export async function exportJSON(reminders, destination = "share") {
  const payload = {
    app: "Offline Reminder",
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    reminders: reminders.map(({ notificationId, soundUri, ...r }) => r),
  };
  const uri = `${FileSystem.cacheDirectory}offline-reminder-backup-${Date.now()}.json`;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(payload, null, 2));
  if (destination === "download") {
    if (Platform.OS !== "android")
      throw new Error("Use Share and Save to Files on this device.");
    const access =
      await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!access.granted) return null;
    const saved = await FileSystem.StorageAccessFramework.createFileAsync(
      access.directoryUri,
      uri.split("/").pop(),
      "application/json",
    );
    await FileSystem.writeAsStringAsync(
      saved,
      JSON.stringify(payload, null, 2),
    );
    return saved;
  }
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("Sharing is unavailable on this device.");
  await Sharing.shareAsync(uri, {
    mimeType: "application/json",
    dialogTitle: "Export Backup",
  });
  return uri;
}
export async function importReminders() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "text/plain"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  try {
    if (asset.size > 50 * 1024 * 1024)
      throw new Error("Choose a backup smaller than 50 MB.");
    const raw = await FileSystem.readAsStringAsync(asset.uri);
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(
        "This file is not valid JSON. No reminders were imported.",
      );
    }
    return validateBackup(parsed);
  } finally {
    await FileSystem.deleteAsync(asset.uri, { idempotent: true }).catch(
      () => {},
    );
  }
}
