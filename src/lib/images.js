import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";

export async function importReminderImage() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["image/jpeg", "image/png"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  try {
    const extension = asset.name?.split(".").pop()?.toLowerCase();
    if (!["jpg", "jpeg", "png"].includes(extension))
      throw new Error("Choose a JPEG or PNG image.");
    if (asset.size > 10 * 1024 * 1024)
      throw new Error("Choose an image smaller than 10 MB.");
    const folder = `${FileSystem.documentDirectory}reminder-images/`;
    await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
    const uri = `${folder}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
    await FileSystem.copyAsync({ from: asset.uri, to: uri });
    return uri;
  } finally {
    await FileSystem.deleteAsync(asset.uri, { idempotent: true }).catch(() => {});
  }
}

// iOS may move an attachment into its notification store. Give each request a
// disposable copy so the original image remains available to rows and details.
export async function notificationImageAttachments(imageUri) {
  if (!imageUri) return [];
  let url;
  try {
    const extension = imageUri.split(".").pop()?.toLowerCase();
    if (!["jpg", "jpeg", "png"].includes(extension)) return [];
    if (!(await FileSystem.getInfoAsync(imageUri)).exists) return [];
    const folder = `${FileSystem.cacheDirectory}notification-images/`;
    await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
    url = `${folder}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
    await FileSystem.copyAsync({ from: imageUri, to: url });
    return [{ identifier: "reminder-image", url, hideThumbnail: false }];
  } catch (error) {
    if (url) await FileSystem.deleteAsync(url, { idempotent: true }).catch(() => {});
    console.warn("Notification image unavailable", error);
    return [];
  }
}
