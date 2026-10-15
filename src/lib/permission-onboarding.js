export const PERMISSION_ONBOARDING_KEY = "@offline-reminder/permission-onboarding-v1";

export function nextPermissionStep({ stage, platform, api, notificationsGranted, exact, hasNativeAlarms }) {
  if (stage === "done" || !["android", "ios"].includes(platform)) return "done";
  if (stage !== "alarms" && !notificationsGranted) return "notifications";
  if (platform === "android" && Number(api) >= 31 && hasNativeAlarms && exact === false) return "alarms";
  return "done";
}
