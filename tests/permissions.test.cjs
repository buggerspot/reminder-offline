const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('src/lib/permission-onboarding.js', 'utf8');
const logic = import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('onboarding requests only relevant permissions and skips completed or granted steps', async () => {
  const { nextPermissionStep } = await logic;
  const android = { stage: null, platform: 'android', api: 36, notificationsGranted: false, exact: false, hasNativeAlarms: true };
  assert.equal(nextPermissionStep(android), 'notifications');
  assert.equal(nextPermissionStep({ ...android, notificationsGranted: true }), 'alarms');
  assert.equal(nextPermissionStep({ ...android, stage: 'alarms' }), 'alarms');
  assert.equal(nextPermissionStep({ ...android, stage: 'done' }), 'done');
  assert.equal(nextPermissionStep({ ...android, notificationsGranted: true, exact: true }), 'done');
  assert.equal(nextPermissionStep({ ...android, notificationsGranted: true, api: 30 }), 'done');
  assert.equal(nextPermissionStep({ ...android, notificationsGranted: true, hasNativeAlarms: false }), 'done');
  assert.equal(nextPermissionStep({ ...android, platform: 'ios' }), 'notifications');
  assert.equal(nextPermissionStep({ ...android, platform: 'ios', stage: 'alarms' }), 'done');
  assert.equal(nextPermissionStep({ ...android, platform: 'ios', notificationsGranted: true }), 'done');
  assert.equal(nextPermissionStep({ ...android, platform: 'web' }), 'done');
});

test('notification setup configures existing channels and actions without prompting before explanation', async () => {
  let requests = 0;
  let channels = 0;
  let actions = [];
  globalThis.__permissionNotifications = {
    setNotificationHandler() {},
    AndroidImportance: { MAX: 5 },
    AndroidNotificationVisibility: { PUBLIC: 1 },
    async setNotificationChannelAsync() { channels++; },
    async setNotificationCategoryAsync(_id, buttons) { actions = buttons; },
    async getPermissionsAsync() { return { granted: false, canAskAgain: true }; },
    async requestPermissionsAsync() { requests++; return { granted: true }; },
  };
  try {
    const setup = fs.readFileSync('src/lib/notifications.js', 'utf8')
      .replace('import { Platform, NativeModules } from "react-native";', 'const Platform = { OS: "android" }; const NativeModules = {};')
      .replace('import * as Notifications from "expo-notifications";', 'const Notifications = globalThis.__permissionNotifications;')
      .replace('import { nextOccurrence } from "./recurrence";', 'const nextOccurrence = () => null;')
      .replace('import { notificationImageAttachments } from "./images";', 'const notificationImageAttachments = async () => [];');
    const { configureNotifications } = await import(`data:text/javascript;base64,${Buffer.from(setup).toString('base64')}`);
    assert.equal(await configureNotifications(true), false);
    assert.equal(requests, 0);
    assert.equal(channels, 1);
    assert.deepEqual(actions.map(a => a.identifier), ['REMINDER_COMPLETE', 'REMINDER_OPEN']);
  } finally { delete globalThis.__permissionNotifications; }
});
