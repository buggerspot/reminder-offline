import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { NativeModules } from "react-native";
import { soundPreview } from "./sound-preview-native";
const KEY = "@offline-reminder/sounds-v1";
export const BUILT_IN_SOUNDS = [
  { id: null, name: "Reminder", builtIn: true },
  { id: "gentle", name: "Gentle chime", builtIn: true },
  { id: "bright", name: "Bright bell", builtIn: true },
];
export async function loadSounds() {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}
export async function importSound() {
  const result = await DocumentPicker.getDocumentAsync({
    type: "audio/*",
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const ext = asset.name?.split(".").pop()?.toLowerCase();
  if (!["mp3", "wav", "m4a", "aac", "ogg", "flac"].includes(ext))
    throw new Error("Choose MP3, WAV, M4A, AAC, OGG or FLAC audio.");
  if (asset.size > 20 * 1024 * 1024)
    throw new Error("Choose an audio file smaller than 20 MB.");
  const folder = `${FileSystem.documentDirectory}sounds/`;
  await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sound = { id, name: asset.name, uri: `${folder}${id}.${ext}` };
  try {
    await FileSystem.copyAsync({ from: asset.uri, to: sound.uri });
    if (NativeModules.ReminderNative)
      await NativeModules.ReminderNative.validateAudio(sound.uri);
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify([...(await loadSounds()), sound]),
    );
    return sound;
  } catch (e) {
    await FileSystem.deleteAsync(sound.uri, { idempotent: true }).catch(
      () => {},
    );
    throw new Error(
      `Could not import this audio file. ${e.message || "Check access or choose another format."}`,
    );
  } finally {
    await FileSystem.deleteAsync(asset.uri, { idempotent: true }).catch(
      () => {},
    );
  }
}
export async function removeSound(sound) {
  await FileSystem.deleteAsync(sound.uri, { idempotent: true });
  await NativeModules.ReminderNative?.removeSoundChannel(sound.id);
  await AsyncStorage.setItem(
    KEY,
    JSON.stringify((await loadSounds()).filter((s) => s.id !== sound.id)),
  );
}
export async function previewSound(sound) { return soundPreview.toggle(sound); }
export function stopPreview() { soundPreview.stop(); }
