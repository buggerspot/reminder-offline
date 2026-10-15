export const PERMISSION_ONBOARDING_KEY = "@offline-reminder/permission-onboarding-v1";

export function nextPermissionStep({ stage, platform, api, notificationsGranted, exact, hasNativeAlarms }) {
  if (stage === "done" || !["android", "ios"].includes(platform)) return "done";
  if (stage !== "alarms" && !notificationsGranted) return "notifications";
  if (platform === "android" && Number(api) >= 31 && hasNativeAlarms && exact === false) return "alarms";
  return "done";
}

// Persist each attempted step before invoking native UI so denial, process death,
// or returning from Settings cannot create an automatic request loop.
export async function runPermissionOnboarding({ platform, api, storage, notifications, alarms }) {
  if (!["android", "ios"].includes(platform)) return;
  const stage = await storage.getItem(PERMISSION_ONBOARDING_KEY);
  let current = await notifications.getPermissionsAsync();
  if (stage !== "done" && stage !== "alarms") {
    await storage.setItem(PERMISSION_ONBOARDING_KEY, "alarms");
    if (!current.granted && current.canAskAgain !== false && (platform === "ios" || Number(api) >= 33)) {
      current = await notifications.requestPermissionsAsync(platform === "ios"
        ? { ios: { allowAlert: true, allowSound: true, allowBadge: false } }
        : undefined);
    }
  }
  if (stage !== "done") {
    const status = platform === "android" && Number(api) >= 31 ? await alarms?.status?.() : null;
    await storage.setItem(PERMISSION_ONBOARDING_KEY, "done");
    if (status?.exact === false) await alarms.openSettings("alarms");
  }
  return current.granted;
}
