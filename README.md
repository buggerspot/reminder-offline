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

## Native interactions

`src/interaction-components.jsx` contains the native tab pager, scroll-boundary feedback, shared full-screen image viewer, and draggable reminder sheet. The three main pages stay mounted to retain scroll position. Horizontal swipes move between Home, Calendar, and Settings; tapping a bottom tab jumps directly without animation. Upcoming, Completed, and Missed remain tap-only controls. Tab taps dispatch the native page command before notifying React subscribers; only the pager and tab bar observe navigation state, so switching without a selection does not render the app or rebuild its page trees. Lists remain virtualized. Scroll feedback observes outward touch movement without claiming the scroll gesture. Its unrounded 10-pixel SVG gradient fades from the existing green edge color to transparent inward; no new native dependency is required. Sheet dragging and snapping run through Gesture Handler and Reanimated on the UI thread; system reduced-motion settings are respected.

Tap any selected image in a row, the reminder details, or the editor to use the same viewer. Tap outside the image or the close button to dismiss it. The viewer uses a dark, blurred backdrop; reduced transparency uses an opaque backdrop. Android 12+ uses the efficient native blur path, with a dark fallback on older Android versions ([Expo blur behavior](https://docs.expo.dev/versions/latest/sdk/blur-view/)).

Drag the details sheet's top handle upward to expand the same details view to full screen. Drag downward to collapse; drag downward again from the collapsed position to dismiss. Reminder presentation state is isolated in `src/reminder-details.jsx`, with duplicate-open guards in `src/lib/presentation.js`. Native visibility and fresh content layout jointly start exactly one entrance animation; later layout callbacks never reset it off-screen. The reminder image is shown below the details and still opens the shared viewer. Editing remains available only through the existing Edit button. The handle exposes accessibility expand/collapse/close actions. Saving uses the existing reminder validation, storage, and notification scheduling.

The native pager, gesture, and blur modules require a rebuilt app after installing dependencies; reloading an older binary is insufficient. Use JDK 21 as described above, then run `bun run android` (and rebuild the iOS app on macOS). Notification images retain the Android expanded-picture style and iOS local attachments; see `NOTIFICATION_CUSTOMIZATION.md` for text and asset customization.

Regression checks also cover outward-scroll intent, sheet snap decisions, and page bounds. Before release, check rapid tab taps/swipes, preserved list positions, long-press selection on image rows, details expansion/collapse and explicit editor save/cancel, keyboard/safe-area behavior, image close/back/outside taps, rotation, reduced motion/transparency, and expanded notifications on physical iOS and Android devices.


## First-launch permissions

`src/permission-onboarding.jsx` explains each permission before offering the system request, using the existing card/button styling. `Not now` skips the step. Progress is stored separately from app settings under `@offline-reminder/permission-onboarding-v1`, so declining, leaving for Settings, or restarting does not repeat completed steps. Existing permission banners remain available for later changes; returning to the app refreshes permission and exact-alarm status.

- Android: notification authorization is requested only when needed. Android 12/API 31+ also offers optional precise timing when native `canScheduleExactAlarms()` reports missing access. The action opens the app-specific **Alarms & reminders** special-access screen via `ACTION_REQUEST_SCHEDULE_EXACT_ALARM`; this is not a second runtime permission dialog. Older Android versions and already-authorized devices skip this step. The existing inexact scheduling fallback remains in use when access is declined. See [Android alarm guidance](https://developer.android.com/develop/background-work/services/alarms).
- iOS: request notification alerts and sounds only. Local notification scheduling needs no separate alarm or Calendar/Reminders data permission. This app does not use AlarmKit or critical alerts, so it requests neither authorization. Previously denied notification access can be enabled through system Settings. See [Apple notification authorization](https://developer.apple.com/documentation/usernotifications/asking-permission-to-use-notifications).
