import { Platform, NativeModules } from "react-native";
import * as Notifications from "expo-notifications";
import { nextOccurrence } from "./recurrence";
import { notificationImageAttachments } from "./images";

export const REMINDER_CATEGORY = "REMINDER_ACTIONS";
export const COMPLETE_ACTION = "REMINDER_COMPLETE";

export function setForegroundNotificationSound(soundEnabled) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: soundEnabled,
      shouldSetBadge: false,
    }),
  });
}

export async function configureNotifications(soundEnabled = true) {
  setForegroundNotificationSound(soundEnabled);

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("reminders", {
      name: "Reminders",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 150, 250],
      sound: soundEnabled ? "reminder.wav" : null,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
    });
  }

  await Notifications.setNotificationCategoryAsync(REMINDER_CATEGORY, [
    {
      identifier: COMPLETE_ACTION,
      buttonTitle: "Mark complete",
      options: { opensAppToForeground: false, isDestructive: false },
    },
    {
      identifier: "REMINDER_OPEN",
      buttonTitle: "Open reminder",
      options: { opensAppToForeground: true },
    },
  ]);

  const current = await Notifications.getPermissionsAsync();
  if (!current.granted) {
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  }
  return true;
}

export async function scheduleReminder(reminder, soundEnabled = true) {
  if (Platform.OS === "android") {
    if (!NativeModules.ReminderNative)
      throw new Error(
        "Rebuild Offline Reminder for Android to enable the updated scheduler and sounds.",
      );
    return null;
  }
  if (reminder.completed) return null;
  const next = nextOccurrence(reminder);
  if (!next) return null;
  const date = new Date(`${next}T${reminder.time}:00`);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) return null;
  const attachments = Platform.OS === "ios" ? await notificationImageAttachments(reminder.imageUri) : [];
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: reminder.title,
      body: reminder.description || "It is time for your reminder.",
      ...(attachments.length ? { attachments } : {}),
      data: { reminderId: reminder.id },
      categoryIdentifier: REMINDER_CATEGORY,
      sound: soundEnabled ? "reminder.wav" : false,
      ...(Platform.OS === "android" ? { channelId: "reminders" } : {}),
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
  });
  return identifier;
}

export async function cancelReminderNotification(identifier) {
  if (!identifier) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (e) {
    /* already delivered or removed */
  }
}
