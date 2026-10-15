# Notification text and filenames

Paths below are relative to the project root. Search for the quoted code when line numbers move.

## App name and notification messages

| Location | What to edit |
| --- | --- |
| `app.json:3` — `expo.name` | The app name displayed by the operating system: `Offline Reminder`. Android adds this header automatically. Do not add a second copy with `setSubText`. |
| `native/android/ReminderNative.kt:279` — `setContentTitle`, `setContentText` | Android reminder content: the user's reminder title and description, with `It is time for your reminder.` as the fallback when the description is empty. Change the quoted fallback to customize the default message, and update the matching expanded-image fallback in `setSummaryText` at line 275. Keep `r.getString("title")` to preserve user-created titles. |
| `native/android/ReminderNative.kt:146` — `val body` | Singular and plural messages for the missed-notification summary. Edit both branches. |
| `native/android/ReminderNative.kt:147` — `setContentTitle("Missed alerts")` | The descriptive heading for the missed summary. |
| `native/android/ReminderNative.kt:279` — `addAction` | Visible Android button labels: `Mark complete` and `Clear`. Change the labels only; preserve the intent/action identifiers. |
| `src/lib/notifications.js:71` — `content.title` and `content.body` | iOS reminder title, description, and the same fallback message. Keep the fallback consistent with Android. |
| `src/lib/notifications.js:37` and `:42` — `buttonTitle` | iOS notification action labels. Preserve their identifiers. |

To change an individual reminder message, use its existing **Edit** form: Title supplies the notification content heading, and Description supplies the message. The system header supplies `Offline Reminder` once; user-created content remains visible beneath it.

## Filenames and assets

| Location | Filename setting |
| --- | --- |
| `src/lib/exportImport.js:75` | Change `offline-reminder-backup-` in the `uri` template to rename exported JSON files. Keep `.json` and the timestamp to avoid collisions. |
| `src/lib/images.js:18` and `:20` | Private image directory and generated image filename. Keep the unique suffix and original image extension. Existing saved reminders retain their current paths. |
| `src/lib/sounds.js:28` and `:31` | Private imported-sound directory and filename. The displayed name uses `asset.name`; changing that label does not require renaming the stored file. |
| `assets/sounds/`, `app.json:40`, `src/lib/notifications.js` | Bundled audio filenames. If renaming a sound, update its asset path in `app.json`, every matching notification sound string, and matching resource references in `native/android/ReminderNative.kt` (search `reminder`, `gentle`, or `bright`). Android raw resource names use lowercase letters, digits, and underscores. |
| `app.json` — `icon` and splash-screen `image` | App icon asset paths. Update both references if renaming `assets/images/icon.png`. |
| `plugins/withReminderNative.cjs` | Maps native source/resource filenames into the generated Android project. If renaming a native file, update its source and destination paths here plus affected Kotlin class/resource references. |

Keep package identifiers, notification action identifiers, and storage keys unchanged when changing display text or asset filenames.

## Applying changes

- JavaScript text changes appear after reloading the app. Already scheduled iOS notifications keep their old content until rescheduled (edit/save the affected reminder).
- App-name, native notification text, native resource, and bundled sound changes require a native rebuild: run `npx expo prebuild --platform android`, then `npx expo run:android`. For iOS, regenerate/build the native app on macOS.
- Edit `native/android/ReminderNative.kt`, not only its generated copy under `android/`. The prebuild plugin copies this source into Android. Prebuild also regenerates the app label from `app.json`.
- Images are optional JPEG/PNG files, copied into private app storage. Android uses a bounded large-icon thumbnail and an expanded image; iOS receives a disposable local notification attachment copy so the original remains available to the app. Actual presentation depends on the OS. A missing row image falls back to the calendar icon, and a missing Android notification image retains the existing notification icon. Image/audio files are not included in JSON backups; choose images again after restoring onto another device.
