import { NativeEventEmitter, NativeModules } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { createSoundPreview } from "./sound-preview";

const native = NativeModules.ReminderNative;
function requirePreview() {
  if (!native?.startPreview || !native?.startPreviewBuiltIn || !native?.pausePreview || !native?.resumePreview)
    throw new Error("Rebuild Offline Reminder for Android to enable updated sound previews.");
}
export const soundPreview = createSoundPreview({
  async start(sound, session, isCurrent) {
    requirePreview();
    if (!sound.builtIn && !(await FileSystem.getInfoAsync(sound.uri)).exists)
      throw new Error("The imported file is missing. Remove it and import it again.");
    if (!isCurrent()) return;
    return sound.builtIn ? native.startPreviewBuiltIn(sound.id || "reminder", session) : native.startPreview(sound.uri, session);
  },
  pause(session) { requirePreview(); return native.pausePreview(session); },
  resume(session) { requirePreview(); return native.resumePreview(session); },
  stop() { native?.stopPreview(); },
});

export function observeSoundPreview() {
  if (!native?.startPreview) return () => {};
  const subscription = new NativeEventEmitter(native).addListener("ReminderPreviewState", event => soundPreview.receive(event));
  return () => subscription.remove();
}
