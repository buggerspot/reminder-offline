# Offline Reminder

Offline Android reminder app using Expo SDK 57, React Native, AsyncStorage, and native Android alarms. Existing mint/teal styling and light layout are preserved; dark backgrounds are pure black.

## Run

Use Node LTS, Bun, Android SDK 36, and JDK 21. Android Studio's installed JDK 25 caused CMake configuration failures here, so builds were verified with JDK 21.

```powershell
bun install
bun run test
bun run typecheck
bunx expo prebuild --platform android --no-install
bun run android
```

The postinstall script applies a guarded, idempotent Expo compatibility fix: `RawPropsParser(bool)` becomes `RawPropsParser()`. The parser itself remains supported by React Native 0.86. This patch should be removed when Expo incorporates it upstream. Run `node scripts/fix-expo-props.cjs` manually if installation scripts are disabled.

`plugins/withReminderNative.cjs` recreates the native scheduler, audio provider, pickers, registration, permissions and instrumentation tests during prebuild. Keep `native/` and `plugins/` in source control. Changes do not require renaming the package identifier or storage keys, which preserves installed app data. Expo Go cannot run this Android native module; rebuild the app.

## Implementation

- Inputs and shared controls are defined outside `App` in `src/components.jsx`. They retain component identity while typing, fixing keyboard dismissal at its root.
- Home and Calendar use FlatList with bounded rendering batches and no scrolling loading indicator. Deferred search, memoized derived data/cards and unchanged-record storage caching avoid unnecessary work.
- The unused NativeWind CSS watcher is removed from Metro. All screens already use native style objects; their styles are unchanged. This also avoids repeated development bundle requests stalling in the CSS pipeline.
- Storage migrates the legacy reminder array on the next save. Individual records are written only when changed, with a published ID index and serialized writes. Old records are removed after migration succeeds. Settings writes are serialized as well. Android's AsyncStorage database limit is raised from its 6 MB default to 128 MB for larger reminder libraries.
- Recurring series keep one ID and a list of completed occurrence dates. Shared date rules drive Calendar, Upcoming and Missed. Recurring misses are limited to today's applicable occurrence; overdue one-time reminders stay missed. The Completed tab displays the latest completed occurrence of each series.
- Creation offers date/time pickers on Android, selected weekdays, monthly day numbers, and optional recurrence end dates. Shorter months skip nonexistent days; leap-day yearly reminders skip non-leap years. Custom interval recurrence was not present in the original app and has not been added.
- Calendar has correctly aligned weekdays, month/year navigation, date markers, date-specific reminders, and creation from the selected date.
- Settings switches use stable native animated controls with immediate state updates. Banner dismissal lasts until the next foreground session, and notification permission is refreshed on foreground.
- Settings includes an offline Privacy Policy page immediately after the version. No public policy URL existed. Publish a hosted policy before store submission if required by the store.

## Android delivery and audio

ReminderEngine persists series in private SharedPreferences and uses **one** AlarmManager alarm for the earliest deadline. This avoids Android's limit on the number of alarms per app when there are thousands of reminders. All due reminders are processed off the UI thread. Next occurrences are scheduled by the receiver even when the app is closed and the user never completes an occurrence.

The scheduler uses RTC_WAKEUP with `setExactAndAllowWhileIdle` when Android permits it, and `setAndAllowWhileIdle` otherwise. Settings offers precise timing only when exact-alarm access is unavailable. Notification permission is the only runtime permission requested automatically. No battery exemption, broad storage access, or overlay access is requested. Exact-alarm access remains optional, but is needed for reliable background looping audio on Android 12+, because user-requested exact alarms are exempt from background foreground-service start restrictions.

Boot, app updates, wall-clock changes, time-zone changes and exact-alarm grants rebuild deadlines. Foreground reconciliation restores the global alarm, and old Expo reminder schedules are cancelled during migration. Native completion actions are persisted and acknowledged only after JS stores the resulting completion. Editing updates the schedule without dismissing an already delivered notification. Completion and deletion explicitly cancel the notification and stop its audio. A last-delivered date prevents the same series occurrence from being delivered twice, including after clock changes.

Schedules follow the device's local time zone. `java.time` resolves a DST gap forward to the next valid local time and chooses the earlier offset in an overlap. Android desugaring preserves support for the project's existing API 24 minimum.

Exact access does not guarantee exact delivery: device power management, Doze quotas, disabled or silent notification channels, DND, permission revocation and force stopping can still delay or prevent delivery. A force-stopped app must be reopened. Inexact fallback can be delayed substantially. See [Android alarm documentation](https://developer.android.com/develop/background-work/services/alarms).

Audio import uses the system document picker, not broad storage permissions. MP3, WAV, M4A, AAC, OGG and FLAC files up to 20 MB are copied into app-private storage and checked by Android's decoder. The common sound picker offers Reminder, Gentle chime, Bright bell, and imported audio in compact waveform rows. One selection applies to all reminders, including existing records. Preview is released on close/background and stops after 15 seconds. Each imported sound has its own notification channel and a narrowly scoped FileProvider URI. Removing the selected sound restores the common bundled default, then deletes the file and channel. Missing audio falls back to the bundled sound during delivery and shows an actionable error during preview. Android users can override channel sound settings.

Notifications use `setAutoCancel(false)`, an explicit Clear action and a dismissal receiver. Viewing or opening a notification keeps it visible. Each occurrence plays its sound once, ending when the file finishes or after 30 seconds. Persistent delivery and playback guards prevent duplicate starts across foreground sync and service restarts. The mediaPlayback service uses the actual reminder notification, with no separate playback notification; stopping audio detaches foreground ownership without removing the reminder. Completing, clearing or deleting the reminder stops audio and removes its notification. Disabled channels, notification denial and DND are respected at delivery. Android may reject background service starts under its platform restrictions, in which case the reminder remains visible without audio.

The current targeted regression suite is `npm test` (category counts, ordering, recurring completion history, and scoped deletion). Native instrumentation mode `playback` generates a 40-second WAV and checks duplicate delivery, foreground sync, duplicate service starts, the 30-second cutoff, notification persistence and explicit clear. It requires the isolated validation app and notification permission.
