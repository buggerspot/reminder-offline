import AsyncStorage from "@react-native-async-storage/async-storage";

const REMINDERS_KEY = "@reminder-pro/reminders-v1";
const SETTINGS_KEY = "@reminder-pro/settings-v1";
const INDEX_KEY = "@offline-reminder/reminder-index-v2";
const RECORD_PREFIX = "@offline-reminder/reminder-v2/";
let cached = new Map();
let references = new Map();
let hasIndex = false;
let writeQueue = Promise.resolve();
let settingsWriteQueue = Promise.resolve();

export const DEFAULT_SETTINGS = {
  theme: "light",
  soundEnabled: true,
  defaultSoundId: "happy_bells",
  keepReminderAfterDismiss: true,
  confirmBeforeClear: false,
  haptics: true,
  defaultRepeat: "none",
};

export async function loadReminders() {
  try {
    const index = await AsyncStorage.getItem(INDEX_KEY);
    if (index) {
      hasIndex = true;
      const ids = JSON.parse(index);
      const values = await AsyncStorage.multiGet(
        ids.map((id) => RECORD_PREFIX + id),
      );
      cached = new Map(
        values
          .filter(([, value]) => value != null)
          .map(([key, value]) => [key.slice(RECORD_PREFIX.length), value]),
      );
      const reminders = [...cached.values()].map((value) => JSON.parse(value));
      references = new Map(reminders.map((r) => [r.id, r]));
      return reminders;
    }
    const value = await AsyncStorage.getItem(REMINDERS_KEY);
    return value ? JSON.parse(value) : [];
  } catch (error) {
    console.warn("Could not read reminders", error);
    throw error;
  }
}
export async function saveReminders(reminders) {
  const snapshot = reminders.slice();
  const operation = writeQueue
    .catch(() => {})
    .then(async () => {
      const next = new Map(
        snapshot.map((r) => [
          r.id,
          references.get(r.id) === r ? cached.get(r.id) : JSON.stringify(r),
        ]),
      );
      const changed = [...next]
        .filter(([id, value]) => cached.get(id) !== value)
        .map(([id, value]) => [RECORD_PREFIX + id, value]);
      const removed = [...cached.keys()]
        .filter((id) => !next.has(id))
        .map((id) => RECORD_PREFIX + id);
      if (changed.length) await AsyncStorage.multiSet(changed);
      // Publish index only after its records exist. Stale removed records are harmless.
      if (next.size !== cached.size || removed.length || !hasIndex)
        await AsyncStorage.setItem(INDEX_KEY, JSON.stringify([...next.keys()]));
      if (!hasIndex) {
        await AsyncStorage.removeItem(REMINDERS_KEY);
        hasIndex = true;
      }
      if (removed.length) await AsyncStorage.multiRemove(removed);
      cached = next;
      references = new Map(snapshot.map((r) => [r.id, r]));
    });
  writeQueue = operation;
  return operation;
}
export async function loadSettings() {
  try {
    const value = await AsyncStorage.getItem(SETTINGS_KEY);
    const saved = value ? JSON.parse(value) : {};
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      defaultSoundId: saved.defaultSoundId == null || ["gentle", "bright"].includes(saved.defaultSoundId)
        ? DEFAULT_SETTINGS.defaultSoundId : saved.defaultSoundId,
      theme: saved.theme === "dark" ? "dark" : "light",
      soundEnabled: true,
      keepReminderAfterDismiss: true,
      confirmBeforeClear: false,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
export async function saveSettings(settings) {
  const raw = JSON.stringify(settings);
  settingsWriteQueue = settingsWriteQueue
    .catch(() => {})
    .then(() => AsyncStorage.setItem(SETTINGS_KEY, raw));
  return settingsWriteQueue;
}
