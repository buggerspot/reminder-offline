import AsyncStorage from '@react-native-async-storage/async-storage';

const REMINDERS_KEY = '@reminder-pro/reminders-v1';
const SETTINGS_KEY = '@reminder-pro/settings-v1';

export const DEFAULT_SETTINGS = {
  theme: 'system',
  soundEnabled: true,
  keepReminderAfterDismiss: true,
  confirmBeforeClear: true,
  haptics: true,
  defaultRepeat: 'none',
};

export async function loadReminders() {
  try {
    const value = await AsyncStorage.getItem(REMINDERS_KEY);
    return value ? JSON.parse(value) : [];
  } catch (error) {
    console.warn('Could not read reminders', error);
    return [];
  }
}
export async function saveReminders(reminders) {
  await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
}
export async function loadSettings() {
  try {
    const value = await AsyncStorage.getItem(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...(value ? JSON.parse(value) : {}) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
export async function saveSettings(settings) {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
