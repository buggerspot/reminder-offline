import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
  useDeferredValue,
} from "react";
import {
  Alert,
  Appearance,
  AppState,
  FlatList,
  Linking,
  NativeModules,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  FileUp,
  Heart,
  Home,
  Moon,
  Plus,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  Square,
  Sun,
  Trash2,
  Volume2,
  X,
} from "lucide-react-native";
import * as Notifications from "expo-notifications";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import {
  configureNotifications,
  setForegroundNotificationSound,
  scheduleReminder,
  cancelReminderNotification,
  COMPLETE_ACTION,
} from "./src/lib/notifications";
import {
  loadReminders,
  saveReminders,
  loadSettings,
  saveSettings,
} from "./src/lib/storage";
import { exportJSON, importReminders } from "./src/lib/exportImport";
import {
  occursOn,
  nextOccurrence,
  displayOccurrence,
  isMissed,
  validDate,
  localDate,
} from "./src/lib/recurrence";
import { formatDate, formatTime } from "./src/lib/format";
import {
  BUILT_IN_SOUNDS,
  loadSounds,
  importSound,
  removeSound,
  previewSound,
  stopPreview,
} from "./src/lib/sounds";
import {
  PaletteContext,
  Card,
  Btn,
  Label,
  Field,
  Chip,
  ReminderRow,
  SettingsToggle,
  PermissionBanner,
} from "./src/components";
const C = {
  brand: "#0F766E",
  brand2: "#14B8A6",
  ink: "#102A2A",
  muted: "#6B7F7D",
  bg: "#F4F8F7",
  card: "#FFFFFF",
  border: "#E1EBE8",
  mint: "#D1FAE5",
  orange: "#F59E0B",
  red: "#DC5757",
  darkBg: "#000000",
  darkCard: "#141414",
  darkBorder: "#303030",
  white: "#F5F5F5",
};
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const timeNow = () => {
  const d = new Date(Date.now() + 5 * 60000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
export default function App() {
  const [reminders, setReminders] = useState([]);
  const [settings, setSettings] = useState({
    theme: "system",
    soundEnabled: true,
    keepReminderAfterDismiss: true,
    confirmBeforeClear: false,
    haptics: true,
    defaultRepeat: "none",
  });
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const dataReady = useRef(false);
  const [tab, setTab] = useState("Home");
  const [filter, setFilter] = useState("Upcoming");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    date: todayISO(),
    time: timeNow(),
    repeat: "none",
    repeatUntil: "",
  });
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [clock, setClock] = useState(Date.now());
  const [permission, setPermission] = useState(true);
  const [alarmStatus, setAlarmStatus] = useState(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [previewing, setPreviewing] = useState(null);
  useEffect(() => {
    if (!previewing) return;
    const timer = setTimeout(() => {
      stopPreview();
      setPreviewing(null);
    }, 15000);
    return () => clearTimeout(timer);
  }, [previewing]);
  const [sounds, setSounds] = useState([]);
  const soundRef = useRef(sounds);
  soundRef.current = sounds;
  const [showSounds, setShowSounds] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const handledResponse = useRef(null);
  const reminderRef = useRef(reminders);
  reminderRef.current = reminders;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const migratedNotifications = useRef(false);
  const deferredSearch = useDeferredValue(search);
  const [busy, setBusy] = useState(false);
  const systemScheme = useColorScheme();
  const isDark =
    settings.theme === "dark" ||
    (settings.theme === "system" && systemScheme === "dark");
  const palette = useMemo(
    () =>
      isDark
        ? {
            bg: C.darkBg,
            card: C.darkCard,
            text: C.white,
            muted: "#A8A8A8",
            border: C.darkBorder,
            soft: "#202020",
            brand: "#2DD4BF",
            onBrand: "#071A18",
            danger: "#FCA5A5",
            dangerSoft: "#2B1515",
          }
        : {
            bg: C.bg,
            card: C.card,
            text: C.ink,
            muted: C.muted,
            border: C.border,
            soft: "#EAF7F3",
            brand: C.brand,
            onBrand: "#FFFFFF",
            danger: "#B91C1C",
            dangerSoft: "#FCE8E8",
          },
    [isDark],
  );
  useEffect(() => {
    Appearance.setColorScheme(
      settings.theme === "system" ? "unspecified" : settings.theme,
    );
  }, [settings.theme]);
  useEffect(() => {
    (async () => {
      dataReady.current = false;
      const [r, s] = await Promise.all([loadReminders(), loadSettings()]);
      if (!Array.isArray(r))
        throw new Error("Stored reminder data is invalid.");
      setReminders(r);
      dataReady.current = true;
      setSettings(s);
      setSounds(await loadSounds());
      setPermission(await configureNotifications(s.soundEnabled));
      setLoaded(true);
    })().catch((e) => {
      console.warn(e);
      if (!dataReady.current)
        setLoadError(e.message || "Local storage is unavailable.");
      setLoaded(true);
    });
  }, [loadAttempt]);
  useEffect(() => {
    let refreshInProgress = false;
    const refresh = async () => {
      if (!loaded || !dataReady.current || refreshInProgress) return;
      refreshInProgress = true;
      try {
        setClock(Date.now());
        setPermission((await Notifications.getPermissionsAsync()).granted);
        const completed =
          await NativeModules.ReminderNative?.takeCompletions?.();
        if (completed) {
          const actions = JSON.parse(completed);
          if (actions.length) {
            const next = reminderRef.current.map((r) => {
              const dates = actions
                .filter((a) => a.id === r.id)
                .map((a) => a.date);
              return dates.length
                ? r.repeat && r.repeat !== "none"
                  ? {
                      ...r,
                      completedDates: [
                        ...new Set([...(r.completedDates || []), ...dates]),
                      ],
                    }
                  : {
                      ...r,
                      completed: true,
                      completedAt: new Date().toISOString(),
                    }
                : r;
            });
            setReminders(next);
            await saveReminders(next);
            await NativeModules.ReminderNative.acknowledgeCompletions(
              completed,
            );
          }
        }
        const openId = await NativeModules.ReminderNative?.takeOpenReminder?.();
        if (openId) {
          const item = reminderRef.current.find((r) => r.id === openId);
          if (item) {
            setDetail(displayOccurrence(item) || item);
            setTab("Home");
          }
        }
        const status = await NativeModules.ReminderNative?.status?.();
        if (status) setAlarmStatus(status);
        if (NativeModules.ReminderNative)
          await NativeModules.ReminderNative.sync(
            JSON.stringify(
              reminderRef.current.map((r) => ({
                ...r,
                soundId: settingsRef.current.defaultSoundId || null,
                soundUri:
                  soundRef.current.find(
                    (s) => s.id === settingsRef.current.defaultSoundId,
                  )?.uri || null,
              })),
            ),
            true,
          );
      } finally {
        refreshInProgress = false;
      }
    };
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setBannerDismissed(false);
        refresh().catch(console.warn);
      } else stopPreview();
    });
    const interval = setInterval(() => setClock(Date.now()), 30000);
    const focus =
      Platform.OS === "android"
        ? AppState.addEventListener("focus", () =>
            refresh().catch(console.warn),
          )
        : null;
    refresh().catch(console.warn);
    return () => {
      subscription.remove();
      focus?.remove();
      clearInterval(interval);
      stopPreview();
    };
  }, [loaded]);
  useEffect(() => {
    if (!loaded || !dataReady.current) return;
    let active = true;
    const reconcile = async () => {
      if (Platform.OS === "android" && !NativeModules.ReminderNative) return;
      if (!migratedNotifications.current) {
        const scheduled =
          await Notifications.getAllScheduledNotificationsAsync();
        for (const request of scheduled) {
          if (request.content.data?.reminderId && Platform.OS === "android")
            await cancelReminderNotification(request.identifier);
        }
        migratedNotifications.current = true;
      }
      if (active && NativeModules.ReminderNative)
        await NativeModules.ReminderNative.sync(
          JSON.stringify(
            reminders.map((r) => ({
              ...r,
              soundId: settings.defaultSoundId || null,
              soundUri:
                sounds.find((s) => s.id === settings.defaultSoundId)?.uri ||
                null,
            })),
          ),
          true,
        );
    };
    reconcile().catch((e) => Alert.alert("Notification setup", e.message));
    return () => {
      active = false;
    };
  }, [loaded, reminders, settings.defaultSoundId, sounds]);
  const markComplete = useCallback(
    async (id) => {
      const current = reminders.find((x) => x.id === id);
      if (!current || current.completed) {
        setDetail(null);
        return;
      }
      let updated;
      if (current.repeat && current.repeat !== "none") {
        const occurrenceDate = detail?.id === id ? detail.date : todayISO();
        updated = reminders.map((r) =>
          r.id === id
            ? {
                ...r,
                completedDates: [
                  ...new Set([...(r.completedDates || []), occurrenceDate]),
                ],
              }
            : r,
        );
        if (Platform.OS !== "android") {
          await cancelReminderNotification(current.notificationId);
          const series = updated.find((r) => r.id === id);
          series.notificationId = await scheduleReminder(
            series,
            settings.soundEnabled,
          );
        }
      } else {
        await cancelReminderNotification(current.notificationId);
        updated = reminders.map((r) =>
          r.id === id
            ? {
                ...r,
                completed: true,
                completedAt: new Date().toISOString(),
              }
            : r,
        );
      }
      await saveReminders(updated);
      setReminders(updated);
      setDetail(null);
    },
    [reminders, settings.soundEnabled, detail],
  );
  useEffect(() => {
    const handle = (response) => {
      if (!loaded || !response) return;
      const responseKey =
        response.notification.request.identifier +
        ":" +
        response.actionIdentifier;
      if (handledResponse.current === responseKey) return;
      handledResponse.current = responseKey;
      const data = response?.notification?.request?.content?.data;
      const id = data?.reminderId;
      if (id && response.actionIdentifier === COMPLETE_ACTION) markComplete(id);
      else if (id) {
        const r = reminders.find((x) => x.id === id);
        if (r) {
          setDetail(r);
          setTab("Home");
        }
      }
    };
    const subscription =
      Notifications.addNotificationResponseReceivedListener(handle);
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) handle(response);
      })
      .catch(() => {});
    return () => subscription.remove();
  }, [markComplete, reminders, loaded]);
  const updateSettings = async (patch) => {
    const previous = settingsRef.current;
    const next = {
      ...settingsRef.current,
      ...patch,
    };
    settingsRef.current = next;
    setSettings(next);
    if ("soundEnabled" in patch)
      setForegroundNotificationSound(next.soundEnabled);
    try {
      await saveSettings(next);
    } catch (e) {
      if (settingsRef.current === next) {
        settingsRef.current = previous;
        setSettings(previous);
        setForegroundNotificationSound(previous.soundEnabled);
      }
      Alert.alert(
        "Could not save settings",
        e.message || "Check available device storage and try again.",
      );
    }
  };
  const openNew = (date = todayISO()) => {
    if (typeof date !== "string") date = todayISO();
    setEditing(null);
    setForm({
      title: "",
      description: "",
      date,
      weekdays: [new Date(`${date}T12:00:00`).getDay()],
      monthDay: new Date(`${date}T12:00:00`).getDate(),
      soundId: settings.defaultSoundId || null,
      time: timeNow(),
      repeat: settings.defaultRepeat || "none",
      repeatUntil: "",
    });
    setShowForm(true);
  };
  const openEdit = (r) => {
    setEditing(r);
    setForm({
      title: r.title,
      description: r.description || "",
      date: r.seriesDate || r.date,
      weekdays: r.weekdays || [
        new Date(`${r.seriesDate || r.date}T12:00:00`).getDay(),
      ],
      monthDay:
        r.monthDay || new Date(`${r.seriesDate || r.date}T12:00:00`).getDate(),
      soundId: r.soundId || null,
      time: r.time,
      repeat: r.repeat || "none",
      repeatUntil: r.repeatUntil || "",
    });
    setDetail(null);
    setShowForm(true);
  };
  const submitReminder = async () => {
    const title = form.title.trim();
    if (!title)
      return Alert.alert(
        "Add a title",
        "Give your reminder a short, clear title.",
      );
    if (
      !validDate(form.date) ||
      (form.repeat === "none" && form.date < todayISO())
    )
      return Alert.alert(
        "Check the date",
        "Choose today or a future date in YYYY-MM-DD format.",
      );
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.time))
      return Alert.alert(
        "Check the time",
        "Enter time in 24-hour HH:MM format.",
      );
    const target = new Date(`${form.date}T${form.time}:00`);
    if (Number.isNaN(target.getTime()))
      return Alert.alert(
        "Check the date",
        "Enter a real calendar date in YYYY-MM-DD format.",
      );
    if (form.repeat === "none" && target.getTime() <= Date.now())
      return Alert.alert(
        "Choose a future time",
        "This reminder time has already passed.",
      );
    if (form.repeat === "weekly" && !form.weekdays?.length)
      return Alert.alert("Choose weekdays", "Select at least one weekday.");
    if (
      form.repeat === "monthly" &&
      (!Number.isInteger(Number(form.monthDay)) ||
        Number(form.monthDay) < 1 ||
        Number(form.monthDay) > 31)
    )
      return Alert.alert(
        "Choose a day",
        "Enter a day from 1 to 31. Shorter months skip this occurrence.",
      );
    if (
      form.repeatUntil &&
      (!validDate(form.repeatUntil) || form.repeatUntil < form.date)
    )
      return Alert.alert(
        "Check repeat end date",
        "Repeat end date must be on or after the first reminder date.",
      );
    if (
      form.repeat !== "none" &&
      !nextOccurrence({
        ...form,
        monthDay: Number(form.monthDay),
      })
    )
      return Alert.alert(
        "No future occurrences",
        "Choose a repeat end date and schedule with a future occurrence.",
      );
    setBusy(true);
    try {
      if (editing?.notificationId)
        await cancelReminderNotification(editing.notificationId);
      const item = {
        id: editing?.id || makeId(),
        title,
        description: form.description.trim(),
        date: form.date,
        time: form.time,
        repeat: form.repeat,
        weekdays: form.weekdays,
        monthDay: Number(form.monthDay),
        soundId: settings.defaultSoundId || null,
        soundUri:
          sounds.find((s) => s.id === settings.defaultSoundId)?.uri || null,
        completedDates: editing?.completedDates || [],
        repeatUntil: form.repeatUntil,
        completed: false,
        createdAt: editing?.createdAt || new Date().toISOString(),
        notificationId: null,
      };
      item.notificationId = await scheduleReminder(item, settings.soundEnabled);
      const next = editing
        ? reminders.map((r) => (r.id === editing.id ? item : r))
        : [...reminders, item];
      await saveReminders(next);
      setReminders(next);
      setShowForm(false);
    } catch (e) {
      Alert.alert("Could not schedule reminder", String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };
  const deleteReminder = (r) =>
    Alert.alert(
      "Delete reminder?",
      `“${r.title}” will be removed from this device.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await cancelReminderNotification(r.notificationId);
            const next = reminders.filter((x) => x.id !== r.id);
            await saveReminders(next);
            setReminders(next);
            setDetail(null);
          },
        },
      ],
    );
  const toggleSelection = (id) =>
    setSelectedIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  const deleteMany = (ids) =>
    Alert.alert(
      "Delete reminders?",
      `${ids.length} reminder${ids.length === 1 ? "" : "s"} will be permanently deleted from this device. This cannot be undone.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: `Delete ${ids.length}`,
          style: "destructive",
          onPress: async () => {
            try {
              const deletedIds = new Set(ids);
              const next = reminders.filter((r) => !deletedIds.has(r.id));
              for (const r of reminders.filter((r) => deletedIds.has(r.id)))
                await cancelReminderNotification(r.notificationId);
              await saveReminders(next);
              setReminders(next);
              setSelectedIds([]);
            } catch (e) {
              Alert.alert("Delete failed", e.message);
            }
          },
        },
      ],
    );
  const visible = useMemo(() => {
    const now = new Date(clock);
    const query = deferredSearch.trim().toLowerCase();
    return reminders
      .filter((r) => {
        if (
          query &&
          !(r.title + " " + (r.description || "")).toLowerCase().includes(query)
        )
          return false;
        if (filter === "Completed")
          return r.completed || (r.completedDates || []).length > 0;
        if (filter === "Missed") return isMissed(r, now);
        return !r.completed && !isMissed(r, now);
      })
      .map((r) =>
        filter === "Completed" && !r.completed
          ? {
              ...r,
              seriesDate: r.date,
              date: r.completedDates[r.completedDates.length - 1],
              completed: true,
            }
          : displayOccurrence(r, now),
      )
      .filter(Boolean)
      .map((r) =>
        filter === "Missed"
          ? {
              ...r,
              missed: true,
            }
          : r,
      )
      .sort((a, b) =>
        (a.date + " " + a.time).localeCompare(b.date + " " + b.time),
      );
  }, [reminders, filter, deferredSearch, clock]);
  const calendarRows = useMemo(
    () =>
      reminders
        .filter((r) => occursOn(r, selectedDate, true))
        .map((r) => ({
          ...r,
          seriesDate: r.date,
          date: selectedDate,
          completed:
            r.completed || (r.completedDates || []).includes(selectedDate),
        }))
        .sort((a, b) => a.time.localeCompare(b.time)),
    [reminders, selectedDate],
  );
  const stats = useMemo(
    () => ({
      active: reminders.filter((r) => !r.completed).length,
      today: reminders.filter((r) => occursOn(r, localDate(new Date(clock))))
        .length,
      completed: reminders.filter(
        (r) => r.completed || r.completedDates?.length,
      ).length,
    }),
    [reminders, clock],
  );
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear(),
      month = calendarMonth.getMonth();
    const offset = new Date(year, month, 1).getDay();
    return Array.from(
      {
        length: offset + new Date(year, month + 1, 0).getDate(),
      },
      (_, i) =>
        i < offset ? null : localDate(new Date(year, month, i - offset + 1)),
    );
  }, [calendarMonth]);
  const calendarMarks = useMemo(
    () =>
      new Set(
        calendarDays.filter(
          (date) => date && reminders.some((r) => occursOn(r, date)),
        ),
      ),
    [calendarDays, reminders],
  );
  const moveMonth = (amount) =>
    setCalendarMonth(
      (d) => new Date(d.getFullYear(), d.getMonth() + amount, 1),
    );
  const openReminder = useCallback((item) => setDetail(item), []);
  const onImport = async () => {
    try {
      const imported = await importReminders();
      if (!imported) return;
      const keys = new Set(reminders.map((r) => r.id));
      const fingerprints = new Set(
        reminders.map((r) =>
          JSON.stringify([
            r.title,
            r.description,
            r.date,
            r.time,
            r.repeat,
            r.weekdays,
            r.monthDay,
            r.repeatUntil,
          ]),
        ),
      );
      const valid = imported
        .filter((r) => {
          const fingerprint = JSON.stringify([
            r.title,
            r.description,
            r.date,
            r.time,
            r.repeat,
            r.weekdays,
            r.monthDay,
            r.repeatUntil,
          ]);
          if (keys.has(r.id) || fingerprints.has(fingerprint)) return false;
          keys.add(r.id);
          fingerprints.add(fingerprint);
          return true;
        })
        .map((r) => ({
          ...r,
          id: r.id || makeId(),
          notificationId: null,
          soundId: sounds.some((s) => s.id === r.soundId) ? r.soundId : null,
          soundUri: sounds.find((s) => s.id === r.soundId)?.uri || null,
        }));
      const combined = [...reminders, ...valid];
      if (Platform.OS !== "android")
        for (const r of valid)
          r.notificationId = await scheduleReminder(r, settings.soundEnabled);
      await saveReminders(combined);
      setReminders(combined);
      Alert.alert("Import complete", `${valid.length} reminders imported.`);
    } catch (e) {
      Alert.alert(
        "Import failed",
        e.message || "Please select a valid JSON backup.",
      );
    }
  };
  const exportWith = async (type) => {
    try {
      const result = await exportJSON(reminders, type);
      if (!result) return;
      Alert.alert(
        "Backup exported",
        "Your JSON backup is ready. Imported sound files stay on this device; import them again on a new phone.",
      );
    } catch (e) {
      Alert.alert("Export failed", e.message || "Could not export reminders.");
    }
  };
  if (loadError)
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: palette.bg,
          padding: 24,
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            color: palette.text,
            fontSize: 20,
            fontWeight: "700",
          }}
        >
          Could not read your reminders
        </Text>
        <Text
          style={{
            color: palette.muted,
            lineHeight: 22,
            marginVertical: 16,
          }}
        >
          {loadError} Your stored reminders and alarms have not been cleared.
          Check available device storage and try again.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setLoadError(null);
            setLoaded(false);
            setLoadAttempt((n) => n + 1);
          }}
          style={{
            backgroundColor: palette.brand,
            padding: 16,
            borderRadius: 14,
          }}
        >
          <Text
            style={{
              color: palette.onBrand,
              textAlign: "center",
              fontWeight: "700",
            }}
          >
            Try again
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  if (!loaded)
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: palette.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Sparkles size={32} color={C.brand} />
        <Text
          style={{
            marginTop: 12,
            color: palette.text,
          }}
        >
          Getting your reminders ready…
        </Text>
      </SafeAreaView>
    );
  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: palette.bg,
      }}
      edges={["top", "left", "right"]}
    >
      <PaletteContext.Provider value={palette}>
        <ExpoStatusBar style={isDark ? "light" : "dark"} />
        {!permission && !bannerDismissed && (
          <PermissionBanner
            message="Enable notifications to receive your reminders on time."
            onDismiss={() => setBannerDismissed(true)}
            onEnable={async () => {
              try {
                if (NativeModules.ReminderNative)
                  await NativeModules.ReminderNative.openSettings(
                    "notifications",
                  );
                else await Linking.openSettings();
              } catch {
                Alert.alert(
                  "Notification settings",
                  "Open this app in system Settings and enable notifications.",
                );
              }
            }}
          />
        )}
        {(tab === "Home" || tab === "Calendar") && reminders.length > 0 && (
          <View
            style={{
              flexDirection: "row",
              gap: 10,
              paddingHorizontal: 20,
              paddingVertical: 8,
            }}
          >
            <View
              style={{
                flex: 1,
              }}
            >
              <Btn
                secondary
                title={
                  selectedIds.length
                    ? `Delete selected (${selectedIds.length})`
                    : "Delete all"
                }
                onPress={() =>
                  deleteMany(
                    selectedIds.length
                      ? selectedIds
                      : reminders.map((r) => r.id),
                  )
                }
              />
            </View>
            {!!selectedIds.length && (
              <Btn
                secondary
                title="Cancel"
                onPress={() => setSelectedIds([])}
              />
            )}
          </View>
        )}
        <View
          style={{
            flex: 1,
          }}
        >
          {tab === "Home" && (
            <FlatList
              data={visible}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <ReminderRow
                  item={item}
                  selected={selectedIds.includes(item.id)}
                  onLongPress={() => toggleSelection(item.id)}
                  onOpen={(r) =>
                    selectedIds.length ? toggleSelection(r.id) : openReminder(r)
                  }
                />
              )}
              initialNumToRender={12}
              maxToRenderPerBatch={12}
              windowSize={7}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                padding: 20,
                paddingBottom: 110,
              }}
              ListHeaderComponent={
                <View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 22,
                    }}
                  >
                    <View>
                      <Text
                        style={{
                          color: palette.muted,
                          fontSize: 13,
                        }}
                      >
                        YOUR PERSONAL ASSISTANT
                      </Text>
                      <Text
                        style={{
                          color: palette.text,
                          fontSize: 28,
                          fontWeight: "800",
                          marginTop: 3,
                        }}
                      >
                        Make time matter.
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => setTab("Settings")}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 15,
                        backgroundColor: palette.card,
                        borderColor: palette.border,
                        borderWidth: 1,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <SettingsIcon color={palette.text} />
                    </Pressable>
                  </View>
                  <View
                    style={{
                      backgroundColor: C.brand,
                      borderRadius: 24,
                      padding: 20,
                      marginBottom: 22,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <View
                        style={{
                          flex: 1,
                        }}
                      >
                        <Text
                          style={{
                            color: "#CCFBF1",
                            fontSize: 12,
                            fontWeight: "700",
                          }}
                        >
                          A LITTLE MORE PEACE OF MIND
                        </Text>
                        <Text
                          style={{
                            color: "#FFFFFF",
                            fontSize: 23,
                            fontWeight: "800",
                            marginTop: 8,
                          }}
                        >
                          Remember what matters.
                        </Text>
                        <Text
                          style={{
                            color: "#D1FAE5",
                            fontSize: 13,
                            marginTop: 7,
                            lineHeight: 19,
                          }}
                        >
                          Big moments, tiny tasks — let us keep track.
                        </Text>
                      </View>
                      <Bell color="#D1FAE5" size={50} />
                    </View>
                    <Pressable
                      onPress={openNew}
                      style={{
                        backgroundColor: "#FFFFFF",
                        borderRadius: 13,
                        paddingVertical: 12,
                        paddingHorizontal: 14,
                        alignSelf: "flex-start",
                        marginTop: 18,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Plus color={C.brand} size={18} />
                      <Text
                        style={{
                          color: C.brand,
                          fontWeight: "800",
                        }}
                      >
                        Create reminder
                      </Text>
                    </Pressable>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 10,
                      marginBottom: 23,
                    }}
                  >
                    {[
                      {
                        n: stats.active,
                        l: "Active",
                        color: "#D1FAE5",
                      },
                      {
                        n: stats.today,
                        l: "Today",
                        color: "#FEF3C7",
                      },
                      {
                        n: stats.completed,
                        l: "Completed",
                        color: "#DBEAFE",
                      },
                    ].map((s) => (
                      <View
                        key={s.l}
                        style={{
                          flex: 1,
                          backgroundColor: palette.card,
                          borderColor: palette.border,
                          borderWidth: 1,
                          borderRadius: 17,
                          padding: 15,
                        }}
                      >
                        <Text
                          style={{
                            color: palette.text,
                            fontSize: 23,
                            fontWeight: "800",
                          }}
                        >
                          {s.n}
                        </Text>
                        <Text
                          style={{
                            color: palette.muted,
                            fontSize: 11,
                            marginTop: 3,
                          }}
                        >
                          {s.l}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 13,
                    }}
                  >
                    <Text
                      style={{
                        color: palette.text,
                        fontSize: 19,
                        fontWeight: "800",
                      }}
                    >
                      Your reminders
                    </Text>
                    <Pressable onPress={() => setTab("Calendar")}>
                      <Text
                        style={{
                          color: palette.brand,
                          fontWeight: "700",
                        }}
                      >
                        View calendar
                      </Text>
                    </Pressable>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      marginBottom: 14,
                    }}
                  >
                    {["Upcoming", "Completed", "Missed"].map((x) => (
                      <Chip
                        key={x}
                        label={x}
                        active={filter === x}
                        onPress={() => setFilter(x)}
                      />
                    ))}
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: palette.card,
                      borderWidth: 1,
                      borderColor: palette.border,
                      borderRadius: 14,
                      paddingHorizontal: 12,
                      marginBottom: 14,
                    }}
                  >
                    <Search color={palette.muted} size={18} />
                    <TextInput
                      value={search}
                      onChangeText={setSearch}
                      placeholder="Search reminders"
                      placeholderTextColor={palette.muted}
                      style={{
                        flex: 1,
                        padding: 12,
                        color: palette.text,
                      }}
                    />
                    {search ? (
                      <Pressable onPress={() => setSearch("")}>
                        <X size={16} color={palette.muted} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              }
              ListEmptyComponent={
                <Card>
                  <View
                    style={{
                      alignItems: "center",
                      paddingVertical: 20,
                    }}
                  >
                    <CalendarDays color={palette.brand} size={34} />
                    <Text
                      style={{
                        color: palette.text,
                        fontWeight: "800",
                        fontSize: 16,
                        marginTop: 12,
                      }}
                    >
                      A little room to breathe
                    </Text>
                    <Text
                      style={{
                        color: palette.muted,
                        textAlign: "center",
                        marginTop: 6,
                        lineHeight: 20,
                      }}
                    >
                      No reminders here yet. Add one now and let your mind focus
                      on what matters.
                    </Text>
                    <View
                      style={{
                        marginTop: 16,
                        width: "100%",
                      }}
                    >
                      <Btn
                        title="Add your first reminder"
                        onPress={openNew}
                        icon={<Plus color="white" size={18} />}
                      />
                    </View>
                  </View>
                </Card>
              }
            />
          )}

          {tab === "Calendar" && (
            <FlatList
              data={calendarRows}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <ReminderRow
                  item={item}
                  selected={selectedIds.includes(item.id)}
                  onLongPress={() => toggleSelection(item.id)}
                  onOpen={(r) =>
                    selectedIds.length ? toggleSelection(r.id) : openReminder(r)
                  }
                />
              )}
              initialNumToRender={12}
              maxToRenderPerBatch={12}
              windowSize={7}
              contentContainerStyle={{
                padding: 20,
                paddingBottom: 110,
              }}
              ListHeaderComponent={
                <View>
                  <Text
                    style={{
                      color: palette.text,
                      fontSize: 28,
                      fontWeight: "800",
                      marginBottom: 20,
                    }}
                  >
                    Your calendar
                  </Text>
                  <Card>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Pressable
                        accessibilityLabel="Previous month"
                        onPress={() => moveMonth(-1)}
                        hitSlop={12}
                      >
                        <ChevronLeft color={palette.brand} />
                      </Pressable>
                      <Text
                        style={{
                          color: palette.text,
                          fontSize: 18,
                          fontWeight: "800",
                        }}
                      >
                        {calendarMonth.toLocaleDateString(undefined, {
                          month: "long",
                          year: "numeric",
                        })}
                      </Text>
                      <Pressable
                        accessibilityLabel="Next month"
                        onPress={() => moveMonth(1)}
                        hitSlop={12}
                      >
                        <ChevronRight color={palette.brand} />
                      </Pressable>
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 8,
                        justifyContent: "space-between",
                        marginVertical: 14,
                      }}
                    >
                      <Chip
                        label="Previous year"
                        onPress={() => moveMonth(-12)}
                      />
                      <Chip
                        label="Today"
                        onPress={() => {
                          setCalendarMonth(new Date());
                          setSelectedDate(todayISO());
                        }}
                      />
                      <Chip label="Next year" onPress={() => moveMonth(12)} />
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                      }}
                    >
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                        (day) => (
                          <Text
                            key={day}
                            style={{
                              width: "14.28%",
                              textAlign: "center",
                              color: palette.muted,
                              fontSize: 11,
                            }}
                          >
                            {day}
                          </Text>
                        ),
                      )}
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                      }}
                    >
                      {calendarDays.map((date, i) => (
                        <Pressable
                          key={date || i}
                          disabled={!date}
                          accessibilityRole="button"
                          accessibilityLabel={date || undefined}
                          accessibilityState={{
                            selected: date === selectedDate,
                          }}
                          onPress={() => setSelectedDate(date)}
                          style={{
                            width: "14.28%",
                            alignItems: "center",
                            paddingVertical: 8,
                          }}
                        >
                          <View
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 17,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor:
                                date === selectedDate
                                  ? palette.brand
                                  : "transparent",
                            }}
                          >
                            <Text
                              style={{
                                color:
                                  date === selectedDate
                                    ? palette.onBrand
                                    : palette.text,
                              }}
                            >
                              {date ? Number(date.slice(-2)) : ""}
                            </Text>
                          </View>
                          <View
                            style={{
                              height: 5,
                              width: 5,
                              borderRadius: 3,
                              backgroundColor: calendarMarks.has(date)
                                ? palette.brand
                                : "transparent",
                              marginTop: 3,
                            }}
                          />
                        </Pressable>
                      ))}
                    </View>
                  </Card>
                  <Text
                    style={{
                      color: palette.text,
                      fontSize: 19,
                      fontWeight: "800",
                      marginVertical: 16,
                    }}
                  >
                    {formatDate(selectedDate)}
                  </Text>
                  <View
                    style={{
                      marginBottom: 16,
                    }}
                  >
                    <Btn
                      title="Create reminder on this date"
                      onPress={() => openNew(selectedDate)}
                    />
                  </View>
                </View>
              }
              ListEmptyComponent={
                <Text
                  style={{
                    color: palette.muted,
                  }}
                >
                  No reminders scheduled for this date.
                </Text>
              }
            />
          )}

          {tab === "Settings" && (
            <ScrollView
              contentContainerStyle={{
                padding: 20,
                paddingBottom: 110,
              }}
            >
              <Text
                style={{
                  color: palette.text,
                  fontSize: 28,
                  fontWeight: "800",
                }}
              >
                Settings
              </Text>
              <Text
                style={{
                  color: palette.muted,
                  marginTop: 5,
                  marginBottom: 22,
                }}
              >
                Make Offline Reminder work your way.
              </Text>
              <Text
                style={{
                  color: palette.muted,
                  fontSize: 12,
                  fontWeight: "800",
                  letterSpacing: 1,
                  marginBottom: 10,
                }}
              >
                PERSONAL EXPERIENCE
              </Text>
              <Card
                style={{
                  padding: 0,
                  overflow: "hidden",
                  marginBottom: 22,
                }}
              >
                <SettingRow
                  palette={palette}
                  icon={<Sun color={palette.brand} />}
                  title="Appearance"
                  subtitle="Choose light, dark or follow device"
                  right={
                    <Text
                      style={{
                        color: palette.brand,
                        fontWeight: "800",
                      }}
                    >
                      {settings.theme === "system"
                        ? "System"
                        : settings.theme === "dark"
                          ? "Dark"
                          : "Light"}
                    </Text>
                  }
                  onPress={() =>
                    Alert.alert("Appearance", "Choose a theme", [
                      {
                        text: "Light",
                        onPress: () =>
                          updateSettings({
                            theme: "light",
                          }),
                      },
                      {
                        text: "Dark",
                        onPress: () =>
                          updateSettings({
                            theme: "dark",
                          }),
                      },
                      {
                        text: "Follow device",
                        onPress: () =>
                          updateSettings({
                            theme: "system",
                          }),
                      },
                      {
                        text: "Cancel",
                        style: "cancel",
                      },
                    ])
                  }
                />
                <SettingRow
                  palette={palette}
                  icon={<Volume2 color={palette.brand} />}
                  title="Reminder Sound"
                  subtitle={
                    (
                      sounds.find((s) => s.id === settings.defaultSoundId) ||
                      BUILT_IN_SOUNDS.find(
                        (s) => s.id === (settings.defaultSoundId || null),
                      )
                    )?.name || "Reminder"
                  }
                  onPress={() => setShowSounds(true)}
                  right={<ChevronRight color={palette.muted} />}
                  last
                />
              </Card>
              <Card
                style={{
                  marginBottom: 22,
                }}
              >
                {alarmStatus && (
                  <Text
                    style={{
                      color: palette.text,
                      marginBottom: 12,
                    }}
                  >
                    Alarm timing:{" "}
                    {alarmStatus.exact
                      ? "Exact alarms allowed"
                      : "Approximate · access unavailable"}
                  </Text>
                )}
                {alarmStatus && !alarmStatus.exact && (
                  <Btn
                    secondary
                    title="Enable precise timing"
                    onPress={() =>
                      NativeModules.ReminderNative?.openSettings(
                        "alarms",
                      ).catch((e) => Alert.alert("Settings", e.message))
                    }
                  />
                )}
                <Text
                  style={{
                    color: palette.muted,
                    fontSize: 12,
                    marginTop: 12,
                    lineHeight: 18,
                  }}
                >
                  Allow alarms & reminders for precise delivery. Without access
                  Android uses approximate alarms and may prevent continuous
                  audio in the background. No battery exemption is needed. Force
                  stopping, silent channels and device settings can delay or
                  silence reminders.
                </Text>
              </Card>
              <Text
                style={{
                  color: palette.muted,
                  fontSize: 12,
                  fontWeight: "800",
                  letterSpacing: 1,
                  marginBottom: 10,
                }}
              >
                BACKUP & RESTORE
              </Text>
              <Card
                style={{
                  padding: 0,
                  overflow: "hidden",
                  marginBottom: 22,
                }}
              >
                <SettingRow
                  palette={palette}
                  icon={<Download color={palette.brand} />}
                  title="Export Backup"
                  subtitle="Best for restoring reminders and repeat settings"
                  onPress={() =>
                    Alert.alert(
                      "Export Backup",
                      "Choose where to save your backup.",
                      [
                        {
                          text: "Download to Device",
                          onPress: () => exportWith("download"),
                        },
                        {
                          text: "Share",
                          onPress: () => exportWith("share"),
                        },
                        {
                          text: "Cancel",
                          style: "cancel",
                        },
                      ],
                    )
                  }
                  right={<ChevronRight color={palette.muted} />}
                />
                <SettingRow
                  palette={palette}
                  icon={<FileUp color={palette.brand} />}
                  title="Import Backup"
                  subtitle="Restore reminders on this phone"
                  onPress={onImport}
                  right={<ChevronRight color={palette.muted} />}
                  last
                />
              </Card>
              <Text
                style={{
                  color: palette.muted,
                  fontSize: 12,
                  fontWeight: "800",
                  letterSpacing: 1,
                  marginBottom: 10,
                }}
              >
                ABOUT YOUR DATA
              </Text>
              <Card>
                <View
                  style={{
                    flexDirection: "row",
                    gap: 12,
                    alignItems: "flex-start",
                  }}
                >
                  <Heart color={palette.brand} size={23} />
                  <View
                    style={{
                      flex: 1,
                    }}
                  >
                    <Text
                      style={{
                        color: palette.text,
                        fontWeight: "800",
                        fontSize: 15,
                      }}
                    >
                      Your reminders belong to you.
                    </Text>
                    <Text
                      style={{
                        color: palette.muted,
                        lineHeight: 20,
                        marginTop: 7,
                        fontSize: 13,
                      }}
                    >
                      No login, no profile and no cloud account. Your reminders
                      are stored locally on this device. Export a backup before
                      changing phones or uninstalling the app. OS settings can
                      still silence or delay notifications.
                    </Text>
                  </View>
                </View>
                <View
                  style={{
                    height: 1,
                    backgroundColor: palette.border,
                    marginVertical: 16,
                  }}
                />
                <Text
                  style={{
                    color: palette.muted,
                    fontSize: 12,
                  }}
                >
                  Offline Reminder · Version 1.0.0
                </Text>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => setShowPrivacy(true)}
                  style={{
                    paddingVertical: 12,
                  }}
                >
                  <Text
                    style={{
                      color: palette.brand,
                      fontWeight: "700",
                    }}
                  >
                    Privacy Policy
                  </Text>
                </Pressable>
              </Card>
            </ScrollView>
          )}

          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: palette.card,
              borderTopWidth: 1,
              borderTopColor: palette.border,
              paddingTop: 10,
              paddingBottom: Platform.OS === "ios" ? 12 : 10,
              flexDirection: "row",
              justifyContent: "space-around",
            }}
          >
            {[
              {
                name: "Home",
                icon: Home,
              },
              {
                name: "Calendar",
                icon: CalendarDays,
              },
              {
                name: "Settings",
                icon: SettingsIcon,
              },
            ].map((x) => {
              const I = x.icon;
              const active = tab === x.name;
              return (
                <Pressable
                  key={x.name}
                  onPress={() => setTab(x.name)}
                  style={{
                    alignItems: "center",
                    gap: 4,
                    minWidth: 70,
                  }}
                >
                  <I size={21} color={active ? palette.brand : palette.muted} />
                  <Text
                    style={{
                      color: active ? palette.brand : palette.muted,
                      fontSize: 11,
                      fontWeight: active ? "800" : "600",
                    }}
                  >
                    {x.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Modal
          visible={showForm}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowForm(false)}
        >
          <SafeAreaView
            style={{
              flex: 1,
              backgroundColor: palette.bg,
            }}
          >
            <KeyboardAvoidingView
              style={{
                flex: 1,
              }}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{
                  padding: 20,
                  paddingBottom: 40,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 16,
                  }}
                >
                  <Pressable
                    onPress={() => setShowForm(false)}
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 14,
                      backgroundColor: palette.card,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X color={palette.text} />
                  </Pressable>
                  <Text
                    style={{
                      color: palette.text,
                      fontSize: 20,
                      fontWeight: "800",
                    }}
                  >
                    {editing ? "Edit reminder" : "New reminder"}
                  </Text>
                  <View
                    style={{
                      width: 42,
                    }}
                  />
                </View>
                <Text
                  style={{
                    color: palette.muted,
                    marginBottom: 18,
                  }}
                >
                  A title, a time, and you are all set.
                </Text>
                <Label>REMINDER TITLE *</Label>
                <Field
                  value={form.title}
                  onChangeText={(v) =>
                    setForm((p) => ({
                      ...p,
                      title: v,
                    }))
                  }
                  placeholder="e.g. Mom's birthday"
                />
                <Label>DESCRIPTION (OPTIONAL)</Label>
                <Field
                  value={form.description}
                  onChangeText={(v) =>
                    setForm((p) => ({
                      ...p,
                      description: v,
                    }))
                  }
                  placeholder="Add a note or a little context…"
                  multiline
                />
                {(form.repeat === "none" || form.repeat === "yearly") && (
                  <>
                    <Label>DATE · YYYY-MM-DD</Label>
                    <Field
                      value={form.date}
                      onChangeText={(v) =>
                        setForm((p) => ({
                          ...p,
                          date: v,
                        }))
                      }
                      placeholder="2026-12-24"
                      keyboardType="numbers-and-punctuation"
                    />
                    <Text
                      style={{
                        color: palette.muted,
                        fontSize: 11,
                        marginTop: 5,
                      }}
                    >
                      Use today or a future date.
                    </Text>
                    {NativeModules.ReminderNative && (
                      <Pressable
                        accessibilityRole="button"
                        style={{
                          paddingVertical: 12,
                        }}
                        onPress={async () => {
                          try {
                            const date =
                              await NativeModules.ReminderNative.chooseDate(
                                validDate(form.date) ? form.date : todayISO(),
                              );
                            if (date)
                              setForm((p) => ({
                                ...p,
                                date,
                              }));
                          } catch (e) {
                            Alert.alert("Choose date", e.message);
                          }
                        }}
                      >
                        <Text
                          style={{
                            color: palette.brand,
                            fontWeight: "700",
                          }}
                        >
                          Choose date
                        </Text>
                      </Pressable>
                    )}
                  </>
                )}
                {form.repeat === "weekly" && (
                  <>
                    <Label>WEEKDAYS</Label>
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                        (label, day) => (
                          <Chip
                            key={label}
                            label={label}
                            active={form.weekdays?.includes(day)}
                            onPress={() =>
                              setForm((p) => ({
                                ...p,
                                weekdays: p.weekdays?.includes(day)
                                  ? p.weekdays.filter((d) => d !== day)
                                  : [...(p.weekdays || []), day],
                              }))
                            }
                          />
                        ),
                      )}
                    </View>
                  </>
                )}
                {form.repeat === "monthly" && (
                  <>
                    <Label>DAY OF MONTH · 1–31</Label>
                    <Field
                      value={String(form.monthDay || "")}
                      onChangeText={(v) =>
                        setForm((p) => ({
                          ...p,
                          monthDay: v,
                        }))
                      }
                      keyboardType="number-pad"
                      placeholder="20"
                    />
                    <Text
                      style={{
                        color: palette.muted,
                        marginTop: 6,
                      }}
                    >
                      Months without this day are skipped.
                    </Text>
                  </>
                )}
                <Label>TIME · 24-HOUR HH:MM</Label>
                <Field
                  value={form.time}
                  onChangeText={(v) =>
                    setForm((p) => ({
                      ...p,
                      time: v,
                    }))
                  }
                  placeholder="09:30"
                  keyboardType="numbers-and-punctuation"
                />
                {NativeModules.ReminderNative && (
                  <Pressable
                    accessibilityRole="button"
                    style={{
                      paddingVertical: 12,
                    }}
                    onPress={async () => {
                      try {
                        const time =
                          await NativeModules.ReminderNative.chooseTime(
                            /^([01]\d|2[0-3]):[0-5]\d$/.test(form.time)
                              ? form.time
                              : timeNow(),
                          );
                        if (time)
                          setForm((p) => ({
                            ...p,
                            time,
                          }));
                      } catch (e) {
                        Alert.alert("Choose time", e.message);
                      }
                    }}
                  >
                    <Text
                      style={{
                        color: palette.brand,
                        fontWeight: "700",
                      }}
                    >
                      Choose time
                    </Text>
                  </Pressable>
                )}
                <Label>REPEAT</Label>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  {[
                    {
                      v: "none",
                      l: "Never",
                    },
                    {
                      v: "daily",
                      l: "Daily",
                    },
                    {
                      v: "weekly",
                      l: "Weekly",
                    },
                    {
                      v: "monthly",
                      l: "Monthly",
                    },
                    {
                      v: "yearly",
                      l: "Yearly",
                    },
                  ].map((o) => (
                    <Chip
                      key={o.v}
                      label={o.l}
                      active={form.repeat === o.v}
                      onPress={() =>
                        setForm((p) => ({
                          ...p,
                          repeat: o.v,
                          weekdays: p.weekdays || [
                            new Date(`${p.date}T12:00:00`).getDay(),
                          ],
                          monthDay:
                            p.monthDay ||
                            new Date(`${p.date}T12:00:00`).getDate(),
                        }))
                      }
                    />
                  ))}
                </View>
                {form.repeat !== "none" && (
                  <>
                    <Label>REPEAT UNTIL (OPTIONAL) · YYYY-MM-DD</Label>
                    <Field
                      value={form.repeatUntil}
                      onChangeText={(v) =>
                        setForm((p) => ({
                          ...p,
                          repeatUntil: v,
                        }))
                      }
                      placeholder="Leave empty to repeat indefinitely"
                    />
                  </>
                )}
                <View
                  style={{
                    marginTop: 26,
                  }}
                >
                  <Btn
                    title={
                      busy
                        ? "Saving…"
                        : editing
                          ? "Save changes"
                          : "Save reminder"
                    }
                    onPress={submitReminder}
                    disabled={busy}
                    icon={<Check color="white" size={18} />}
                  />
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>

        <Modal
          visible={showSounds}
          animationType="slide"
          onRequestClose={() => {
            stopPreview();
            setShowSounds(false);
            setPreviewing(null);
          }}
        >
          <SafeAreaView
            style={{
              flex: 1,
              backgroundColor: palette.bg,
              padding: 20,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <Text
                style={{
                  color: palette.text,
                  fontSize: 24,
                  fontWeight: "800",
                }}
              >
                Reminder sounds
              </Text>
              <Pressable
                accessibilityLabel="Close sounds"
                onPress={() => {
                  stopPreview();
                  setShowSounds(false);
                  setPreviewing(null);
                }}
              >
                <X color={palette.text} />
              </Pressable>
            </View>
            <Text
              style={{
                color: palette.muted,
                lineHeight: 20,
                marginBottom: 18,
              }}
            >
              Choose an audio file using the system picker. A private copy stays
              on this device. No broad storage permission is needed.
            </Text>
            <View
              style={{
                alignSelf: "flex-start",
                marginBottom: 12,
              }}
            >
              <Btn
                title="Import Sound"
                secondary
                onPress={async () => {
                  try {
                    const sound = await importSound();
                    if (sound) setSounds(await loadSounds());
                  } catch (e) {
                    Alert.alert(
                      "Audio file access",
                      e.message +
                        " Choose an accessible audio file, or check the file provider permissions in system Settings.",
                      [
                        {
                          text: "Cancel",
                          style: "cancel",
                        },
                        {
                          text: "Choose Audio File",
                          onPress: async () => {
                            try {
                              await importSound();
                              setSounds(await loadSounds());
                            } catch (e) {
                              Alert.alert("Import failed", e.message);
                            }
                          },
                        },
                        {
                          text: "Settings",
                          onPress: () => Linking.openSettings(),
                        },
                      ],
                    );
                  }
                }}
              />
            </View>
            <FlatList
              data={[...BUILT_IN_SOUNDS, ...sounds]}
              keyExtractor={(s) => s.id || "default"}
              renderItem={({ item, index }) => (
                <View>
                  {(index === 0 || index === BUILT_IN_SOUNDS.length) && (
                    <Label>
                      {index === 0 ? "BUILT-IN SOUNDS" : "IMPORTED SOUNDS"}
                    </Label>
                  )}
                  <Card
                    style={{
                      marginBottom: 8,
                      padding: 12,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <Pressable
                        accessibilityLabel={
                          previewing === item.name
                            ? "Stop preview"
                            : `Preview ${item.name}`
                        }
                        onPress={() => {
                          stopPreview();
                          if (previewing === item.name) {
                            setPreviewing(null);
                            return;
                          }
                          setPreviewing(item.name);
                          previewSound(item).catch((e) => {
                            setPreviewing(null);
                            Alert.alert("Cannot play sound", e.message);
                          });
                        }}
                        style={{
                          padding: 10,
                          borderRadius: 14,
                          backgroundColor: palette.soft,
                        }}
                      >
                        {previewing === item.name ? (
                          <Square color={palette.brand} size={22} />
                        ) : (
                          <Volume2 color={palette.brand} size={22} />
                        )}
                      </Pressable>
                      <Pressable
                        style={{
                          flex: 1,
                        }}
                        onPress={() => {
                          stopPreview();
                          setPreviewing(null);
                          updateSettings({
                            defaultSoundId: item.id,
                          }).catch((e) => Alert.alert("Settings", e.message));
                        }}
                      >
                        <Text
                          numberOfLines={1}
                          style={{
                            color: palette.text,
                            fontWeight: "700",
                          }}
                        >
                          {item.name}
                        </Text>
                        <View
                          accessibilityLabel="Decorative audio waveform"
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 3,
                            height: 22,
                            marginTop: 5,
                          }}
                        >
                          {[
                            5, 12, 8, 18, 10, 20, 7, 15, 9, 17, 6, 12, 8, 4,
                          ].map((h, i) => (
                            <View
                              key={i}
                              style={{
                                width: 3,
                                height: h,
                                borderRadius: 2,
                                backgroundColor:
                                  previewing === item.name
                                    ? palette.brand
                                    : palette.muted,
                                opacity: 0.6,
                              }}
                            />
                          ))}
                        </View>
                      </Pressable>
                      {(settings.defaultSoundId || null) === item.id && (
                        <CheckCircle2 color={palette.brand} size={22} />
                      )}
                      {!item.builtIn && (
                        <Pressable
                          accessibilityLabel={`Remove ${item.name}`}
                          onPress={() =>
                            Alert.alert(
                              "Remove sound?",
                              "1 imported sound will be deleted. If selected, all reminders will use Reminder.",
                              [
                                {
                                  text: "Cancel",
                                  style: "cancel",
                                },
                                {
                                  text: "Remove",
                                  style: "destructive",
                                  onPress: async () => {
                                    try {
                                      stopPreview();
                                      if (settings.defaultSoundId === item.id)
                                        await updateSettings({
                                          defaultSoundId: null,
                                        });
                                      await removeSound(item);
                                      setSounds(await loadSounds());
                                    } catch (e) {
                                      Alert.alert(
                                        "Cannot remove sound",
                                        e.message,
                                      );
                                    }
                                  },
                                },
                              ],
                            )
                          }
                        >
                          <Trash2 color={C.red} size={19} />
                        </Pressable>
                      )}
                    </View>
                  </Card>
                </View>
              )}
              ListFooterComponent={
                <Text
                  style={{
                    color: palette.muted,
                    marginTop: 8,
                  }}
                >
                  One common sound for every reminder. Tap a speaker for a
                  15-second preview; tap a name to select.
                </Text>
              }
            />
          </SafeAreaView>
        </Modal>
        <Modal
          visible={showPrivacy}
          animationType="slide"
          onRequestClose={() => setShowPrivacy(false)}
        >
          <SafeAreaView
            style={{
              flex: 1,
              backgroundColor: palette.bg,
            }}
          >
            <ScrollView
              contentContainerStyle={{
                padding: 20,
              }}
            >
              <Btn
                secondary
                title="Close"
                onPress={() => setShowPrivacy(false)}
              />
              <Text
                style={{
                  color: palette.text,
                  fontSize: 26,
                  fontWeight: "800",
                  marginVertical: 20,
                }}
              >
                Privacy Policy
              </Text>
              <Text
                style={{
                  color: palette.text,
                  lineHeight: 24,
                }}
              >
                Offline Reminder stores your reminders, preferences and imported
                audio files locally on your device. The app does not require an
                account and does not send this data to a backend, analytics or
                advertising service. Notifications are scheduled through your
                operating system. Audio files are accessed only when you choose
                them using the system file picker, and a private copy is saved
                in app storage. Exporting a backup shares the reminder data with
                the destination you select; imported audio is not included.
                Android device backup may include app data according to your
                system backup settings. You can delete reminders and imported
                sounds in the app, or clear all app data in system settings.
                Uninstalling the app removes its local private data. Keep your
                backups safe: they can contain personal information. This policy
                applies to version 1.0.0. Updated October 13, 2026.
              </Text>
            </ScrollView>
          </SafeAreaView>
        </Modal>
        <Modal
          visible={Boolean(detail)}
          transparent
          animationType="fade"
          onRequestClose={() => setDetail(null)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "#0008",
              justifyContent: "flex-end",
            }}
          >
            <Pressable
              onPress={() => setDetail(null)}
              style={{
                flex: 1,
              }}
            />
            <View
              style={{
                backgroundColor: palette.bg,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                padding: 22,
                paddingBottom: 34,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <View
                  style={{
                    flex: 1,
                    marginRight: 12,
                  }}
                >
                  <Text
                    style={{
                      color: palette.muted,
                      fontSize: 12,
                      fontWeight: "700",
                    }}
                  >
                    REMINDER DETAILS
                  </Text>
                  <Text
                    style={{
                      color: palette.text,
                      fontSize: 24,
                      fontWeight: "800",
                      marginTop: 7,
                    }}
                  >
                    {detail?.title}
                  </Text>
                </View>
                <Pressable onPress={() => setDetail(null)}>
                  <X color={palette.text} />
                </Pressable>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  gap: 10,
                  marginTop: 20,
                  marginBottom: 16,
                }}
              >
                <View
                  style={{
                    flex: 1,
                    backgroundColor: palette.card,
                    borderRadius: 15,
                    padding: 13,
                  }}
                >
                  <CalendarDays color={palette.brand} size={20} />
                  <Text
                    style={{
                      color: palette.text,
                      fontWeight: "700",
                      marginTop: 8,
                    }}
                  >
                    {detail ? formatDate(detail.date) : ""}
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: palette.card,
                    borderRadius: 15,
                    padding: 13,
                  }}
                >
                  <Clock3 color={palette.brand} size={20} />
                  <Text
                    style={{
                      color: palette.text,
                      fontWeight: "700",
                      marginTop: 8,
                    }}
                  >
                    {detail ? formatTime(detail.time) : ""}
                  </Text>
                </View>
              </View>
              {detail?.description ? (
                <Text
                  style={{
                    color: palette.muted,
                    lineHeight: 21,
                    marginBottom: 18,
                  }}
                >
                  {detail.description}
                </Text>
              ) : null}
              {detail?.repeat && detail.repeat !== "none" ? (
                <Text
                  style={{
                    color: palette.muted,
                    marginBottom: 16,
                  }}
                >
                  Repeats {detail.repeat}
                  {detail.repeatUntil ? ` until ${detail.repeatUntil}` : ""}
                </Text>
              ) : null}
              {!detail?.completed && (
                <View
                  style={{
                    marginBottom: 10,
                  }}
                >
                  <Btn
                    title="Mark as complete"
                    onPress={() => markComplete(detail.id)}
                    icon={<CheckCircle2 color="white" size={18} />}
                  />
                </View>
              )}
              <View
                style={{
                  flexDirection: "row",
                  gap: 10,
                }}
              >
                <View
                  style={{
                    flex: 1,
                  }}
                >
                  <Btn
                    title="Edit"
                    secondary
                    onPress={() => openEdit(detail)}
                  />
                </View>
                <View
                  style={{
                    flex: 1,
                  }}
                >
                  <Btn
                    title="Delete"
                    danger
                    onPress={() => deleteReminder(detail)}
                    icon={<Trash2 color="#B91C1C" size={17} />}
                  />
                </View>
              </View>
            </View>
          </View>
        </Modal>
      </PaletteContext.Provider>
    </SafeAreaView>
  );
}
function SettingRow({
  palette,
  icon,
  title,
  subtitle,
  right,
  onPress,
  last = false,
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 15,
        paddingVertical: 15,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: palette.border,
        gap: 12,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 13,
          backgroundColor: palette.soft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </View>
      <View
        style={{
          flex: 1,
        }}
      >
        <Text
          style={{
            color: palette.text,
            fontWeight: "700",
            fontSize: 14,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              color: palette.muted,
              fontSize: 11,
              marginTop: 4,
              lineHeight: 16,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right || <ChevronRight color={palette.muted} size={18} />}
    </Pressable>
  );
}
