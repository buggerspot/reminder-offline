# Google Play foreground service declaration

App: Reminder Offline (`com.buggerspot.reminderoffline`)

## Assessment

Retain `android.permission.FOREGROUND_SERVICE` and `android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK`. The app has a defensible background audio playback use case: `ReminderPlaybackService` plays the selected sound for a reminder the user created, with a visible reminder notification and stop actions. Final acceptance is subject to Google Play review.

The existing configuration already declares `mediaPlayback` in the Expo config plugin and generated Android manifest. No application code, permissions, or features were changed for this assessment.

## Answers to enter in Play Console

Open **Monitor and improve > App content > Foreground service permissions** for this app. Console wording may vary.

**Permission/type:** `FOREGROUND_SERVICE_MEDIA_PLAYBACK` / Media playback.

**Use case:** Select audio/background media playback if offered. If the available choices do not describe reminder sounds, select Other and describe: “Playback of a user-selected reminder sound at the date and time scheduled by the user.” Do not describe the app as a music or streaming service.

**Describe the functionality that uses this permission:**

> Reminder Offline lets users create reminders and select their date, time, recurrence, and sound. When a reminder becomes due, the app displays its notification and uses a media playback foreground service to play the selected built-in or imported audio while the app is in the background or the screen is locked. The service runs only during reminder audio playback. Playback is non-looping and stops when the audio finishes, after a maximum of 30 seconds of playback, or when the user chooses Clear or Mark complete in the notification. The service stops once no reminder audio remains active. Reminder scheduling uses AlarmManager and does not keep a foreground service running between reminders.

**How does the user initiate this work?**

> The user creates and saves a reminder with a selected date, time, and sound. That scheduled reminder triggers audio playback when it becomes due, including when the user has left the app. Silent reminders do not start the audio playback service.

**User impact if the task is deferred:**

> Delaying playback would delay the audible alert for the reminder the user scheduled. The user could miss the intended time for their task even if the visual notification is delivered.

**User impact if the task is interrupted:**

> Interrupting playback would cut off the selected reminder sound and could cause the user to miss the audible alert while the screen is locked or the app is in the background. The app keeps the reminder notification available, but it does not restart interrupted audio automatically.

**How can the user stop it?**

> The reminder notification provides Clear and Mark complete actions, either of which stops that reminder's sound. Playback also ends automatically when the sound finishes or reaches 30 seconds. If other reminders are playing at the same time, the service stops when all active reminder sounds have ended or been stopped.

## Required demonstration video

Record the actual release app on an Android device, with audible output captured:

1. Enable notifications and exact alarm access; ensure Do Not Disturb is off and notification audio is audible.
2. Create a reminder due shortly and select a sound long enough to demonstrate stopping it.
3. Save it, leave the app, and lock the screen or keep the app in the background.
4. Show the due reminder notification and capture its sound playing.
5. Expand the notification and tap Clear to demonstrate that audio stops.
6. Repeat with another reminder and demonstrate Mark complete stopping playback. Optionally demonstrate natural completion or the 30-second playback cap.

Upload the recording to a URL accessible to Google Play reviewers and paste that real URL into the declaration. A video has not been recorded or uploaded as part of this repository assessment. The declaration cannot be submitted completely until that URL is provided and the form is saved in the authenticated Play Console account.

## Source verification

- `app.json`: both foreground service permissions.
- `plugins/withReminderNative.cjs`: non-exported `ReminderPlaybackService` with `mediaPlayback` type.
- `native/android/ReminderNative.kt`: `fire` starts playback for audible due reminders; the service posts the foreground notification, plays once, caps playback at 30 seconds, and releases itself when no players remain. `clear` and `complete` stop the corresponding sound.
- `android/app/src/main/AndroidManifest.xml`: generated permissions and service type agree with the source configuration.

This is a source review, not a new device playback test or verification of a particular uploaded AAB.

## Official references

- [Google Play declaration requirements](https://support.google.com/googleplay/android-developer/answer/13392821?hl=en)
- [Android foreground service types: media playback](https://developer.android.com/develop/background-work/services/fgs/service-types#media)

Reviewed October 16, 2026.
