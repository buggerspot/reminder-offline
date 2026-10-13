import "./global.css";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
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
  Sun,
  Trash2,
  Volume2,
  X,
} from "lucide-react-native";
import * as Notifications from "expo-notifications";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import {
  configureNotifications,
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
import { exportCSV, exportJSON, importReminders } from "./src/lib/exportImport";

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
  darkBg: "#0C1717",
  darkCard: "#142424",
  darkBorder: "#263B39",
  white: "#F3FAF8",
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
const formatDate = (date) => {
  if (!date) return "";
  const d = new Date(`${date}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};
const formatTime = (time) => {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
};
const nextDate = (date, repeat) => {
  const d = new Date(`${date}T12:00:00`);
  if (repeat === "daily") d.setDate(d.getDate() + 1);
  else if (repeat === "weekly") d.setDate(d.getDate() + 7);
  else if (repeat === "monthly") d.setMonth(d.getMonth() + 1);
  else if (repeat === "yearly") d.setFullYear(d.getFullYear() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function App() {
  const [reminders, setReminders] = useState([]);
  const [settings, setSettings] = useState({
    theme: "system",
    soundEnabled: true,
    keepReminderAfterDismiss: true,
    confirmBeforeClear: true,
    haptics: true,
    defaultRepeat: "none",
  });
  const [loaded, setLoaded] = useState(false);
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
            muted: "#9CB2AE",
            border: C.darkBorder,
            soft: "#1C3331",
            brand: "#2DD4BF",
          }
        : {
            bg: C.bg,
            card: C.card,
            text: C.ink,
            muted: C.muted,
            border: C.border,
            soft: "#EAF7F3",
            brand: C.brand,
          },
    [isDark],
  );

  const refreshReminders = useCallback(async () => {
    const r = await loadReminders();
    setReminders(r);
  }, []);
  useEffect(() => {
    (async () => {
      const [r, s] = await Promise.all([loadReminders(), loadSettings()]);
      setReminders(r);
      setSettings(s);
      await configureNotifications(s.soundEnabled);
      setLoaded(true);
    })().catch((e) => {
      console.warn(e);
      setLoaded(true);
    });
  }, []);

  const markComplete = useCallback(
    async (id) => {
      const current = reminders.find((x) => x.id === id);
      if (!current || current.completed) {
        setDetail(null);
        return;
      }
      await cancelReminderNotification(current.notificationId);
      let updated;
      if (current.repeat && current.repeat !== "none") {
        const followingDate = nextDate(current.date, current.repeat);
        if (!current.repeatUntil || followingDate <= current.repeatUntil) {
          const occurrence = {
            ...current,
            id: makeId(),
            date: followingDate,
            completed: false,
            notificationId: null,
            createdAt: new Date().toISOString(),
          };
          occurrence.notificationId = await scheduleReminder(
            occurrence,
            settings.soundEnabled,
          );
          updated = [
            ...reminders.map((x) =>
              x.id === id
                ? {
                    ...x,
                    completed: true,
                    completedAt: new Date().toISOString(),
                  }
                : x,
            ),
            occurrence,
          ];
        }
      }
      if (!updated)
        updated = reminders.map((x) =>
          x.id === id
            ? { ...x, completed: true, completedAt: new Date().toISOString() }
            : x,
        );
      setReminders(updated);
      await saveReminders(updated);
      setDetail(null);
    },
    [reminders, settings.soundEnabled],
  );

  useEffect(() => {
    const handle = (response) => {
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
  }, [markComplete, reminders]);

  const updateSettings = async (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await saveSettings(next);
    if ("soundEnabled" in patch)
      await configureNotifications(next.soundEnabled);
  };
  const openNew = () => {
    setEditing(null);
    setForm({
      title: "",
      description: "",
      date: todayISO(),
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
      date: r.date,
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date) || form.date < todayISO())
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
    if (target.getTime() <= Date.now())
      return Alert.alert(
        "Choose a future time",
        "This reminder time has already passed.",
      );
    if (form.repeatUntil && form.repeatUntil < form.date)
      return Alert.alert(
        "Check repeat end date",
        "Repeat end date must be on or after the first reminder date.",
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
        repeatUntil: form.repeatUntil,
        completed: false,
        createdAt: editing?.createdAt || new Date().toISOString(),
        notificationId: null,
      };
      item.notificationId = await scheduleReminder(item, settings.soundEnabled);
      const next = editing
        ? reminders.map((r) => (r.id === editing.id ? item : r))
        : [...reminders, item];
      setReminders(next);
      await saveReminders(next);
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
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await cancelReminderNotification(r.notificationId);
            const next = reminders.filter((x) => x.id !== r.id);
            setReminders(next);
            await saveReminders(next);
            setDetail(null);
          },
        },
      ],
    );

  const visible = useMemo(() => {
    const nowDate = todayISO();
    let rows = reminders.filter((r) => {
      if (filter === "Completed") return r.completed;
      if (filter === "Past") return !r.completed && r.date < nowDate;
      if (filter === "Birthdays")
        return /birthday|anniversary/i.test(r.title) || r.repeat === "yearly";
      return !r.completed && r.date >= nowDate;
    });
    if (search.trim())
      rows = rows.filter((r) =>
        `${r.title} ${r.description}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      );
    return rows.sort((a, b) =>
      `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`),
    );
  }, [reminders, filter, search]);

  const onImport = async () => {
    try {
      const imported = await importReminders();
      if (!imported) return;
      const valid = imported
        .filter(
          (r) =>
            r &&
            typeof r.title === "string" &&
            r.title.trim() &&
            /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
            /^([01]\d|2[0-3]):[0-5]\d$/.test(r.time),
        )
        .map((r) => ({
          ...r,
          id: makeId(),
          notificationId: null,
          completed: Boolean(r.completed),
          repeat: r.repeat || "none",
          createdAt: r.createdAt || new Date().toISOString(),
        }));
      const combined = [...reminders, ...valid];
      for (const r of combined)
        if (
          !r.completed &&
          `${r.date}T${r.time}:00` > new Date().toISOString().slice(0, 19)
        )
          r.notificationId = await scheduleReminder(r, settings.soundEnabled);
      setReminders(combined);
      await saveReminders(combined);
      Alert.alert("Import complete", `${valid.length} reminders imported.`);
    } catch (e) {
      Alert.alert(
        "Import failed",
        e.message || "Please select a valid JSON backup or CSV export.",
      );
    }
  };
  const exportWith = async (type) => {
    try {
      if (type === "json") await exportJSON(reminders);
      else await exportCSV(reminders);
    } catch (e) {
      Alert.alert("Export failed", e.message || "Could not export reminders.");
    }
  };

  const Card = ({ children, style }) => (
    <View
      style={[
        {
          backgroundColor: palette.card,
          borderColor: palette.border,
          borderWidth: 1,
          borderRadius: 20,
          padding: 16,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
  const Btn = ({
    title,
    onPress,
    secondary = false,
    icon = null,
    danger = false,
    disabled = false,
  }) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        minHeight: 48,
        borderRadius: 14,
        paddingHorizontal: 16,
        flexDirection: "row",
        gap: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: danger
          ? "#FCE8E8"
          : secondary
            ? palette.soft
            : palette.brand,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {icon}
      {
        <Text
          style={{
            color: danger ? "#B91C1C" : secondary ? palette.text : "#FFFFFF",
            fontWeight: "700",
            fontSize: 14,
          }}
        >
          {title}
        </Text>
      }
    </Pressable>
  );
  const Label = ({ children }) => (
    <Text
      style={{
        color: palette.muted,
        fontSize: 12,
        fontWeight: "700",
        marginBottom: 7,
        marginTop: 13,
        letterSpacing: 0.4,
      }}
    >
      {children}
    </Text>
  );
  const Field = ({
    value,
    onChangeText,
    placeholder,
    multiline = false,
    keyboardType = "default",
  }) => (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={palette.muted}
      multiline={multiline}
      keyboardType={keyboardType}
      style={{
        color: palette.text,
        backgroundColor: palette.bg,
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: 13,
        paddingHorizontal: 13,
        paddingVertical: 12,
        minHeight: 48,
        textAlignVertical: multiline ? "top" : "center",
      }}
    />
  );
  const Chip = ({ label, active, onPress }) => (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 15,
        paddingVertical: 9,
        borderRadius: 30,
        backgroundColor: active ? palette.brand : palette.card,
        borderColor: active ? palette.brand : palette.border,
        borderWidth: 1,
        marginRight: 8,
      }}
    >
      <Text
        style={{
          color: active ? "white" : palette.muted,
          fontWeight: "700",
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );

  const ReminderRow = ({ item }) => (
    <Pressable
      onPress={() => setDetail(item)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: 14,
        marginBottom: 10,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.card,
      }}
    >
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 15,
          backgroundColor: palette.soft,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <CalendarDays color={palette.brand} size={21} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{
            color: palette.text,
            fontSize: 15,
            fontWeight: "700",
            textDecorationLine: item.completed ? "line-through" : "none",
          }}
        >
          {item.title}
        </Text>
        <Text
          numberOfLines={1}
          style={{ color: palette.muted, fontSize: 12, marginTop: 4 }}
        >
          {formatDate(item.date)} · {formatTime(item.time)}
          {item.repeat && item.repeat !== "none" ? ` · ${item.repeat}` : ""}
        </Text>
        {item.description ? (
          <Text
            numberOfLines={1}
            style={{ color: palette.muted, fontSize: 12, marginTop: 4 }}
          >
            {item.description}
          </Text>
        ) : null}
      </View>
      {item.completed ? (
        <CheckCircle2 color={palette.brand} size={22} />
      ) : (
        <ChevronRight color={palette.muted} size={20} />
      )}
    </Pressable>
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
        <Text style={{ marginTop: 12, color: palette.text }}>
          Getting your reminders ready…
        </Text>
      </SafeAreaView>
    );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: palette.bg }}
      edges={["top", "left", "right"]}
    >
      <ExpoStatusBar style={isDark ? "light" : "dark"} />
      <View style={{ flex: 1 }}>
        {tab === "Home" && (
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 110 }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 22,
              }}
            >
              <View>
                <Text style={{ color: palette.muted, fontSize: 13 }}>
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
                backgroundColor: palette.brand,
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
                <View style={{ flex: 1 }}>
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
                <Text style={{ color: C.brand, fontWeight: "800" }}>
                  Create reminder
                </Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 23 }}>
              {[
                {
                  n: reminders.filter((r) => !r.completed).length,
                  l: "Active",
                  color: "#D1FAE5",
                },
                {
                  n: reminders.filter(
                    (r) => !r.completed && r.date === todayISO(),
                  ).length,
                  l: "Today",
                  color: "#FEF3C7",
                },
                {
                  n: reminders.filter((r) => r.completed).length,
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
                    padding: 13,
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 5,
                      backgroundColor: s.color,
                      marginBottom: 10,
                    }}
                  />
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
                    style={{ color: palette.muted, fontSize: 11, marginTop: 3 }}
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
                style={{ color: palette.text, fontSize: 19, fontWeight: "800" }}
              >
                Your reminders
              </Text>
              <Pressable onPress={() => setTab("Calendar")}>
                <Text style={{ color: palette.brand, fontWeight: "700" }}>
                  View calendar
                </Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", marginBottom: 14 }}>
              {["Upcoming", "Completed", "Birthdays"].map((x) => (
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
                style={{ flex: 1, padding: 12, color: palette.text }}
              />
              {search ? (
                <Pressable onPress={() => setSearch("")}>
                  <X size={16} color={palette.muted} />
                </Pressable>
              ) : null}
            </View>
            {visible.length ? (
              visible
                .slice(0, 30)
                .map((item) => <ReminderRow key={item.id} item={item} />)
            ) : (
              <Card>
                <View style={{ alignItems: "center", paddingVertical: 20 }}>
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
                  <View style={{ marginTop: 16, width: "100%" }}>
                    <Btn
                      title="Add your first reminder"
                      onPress={openNew}
                      icon={<Plus color="white" size={18} />}
                    />
                  </View>
                </View>
              </Card>
            )}
            <Text
              style={{
                color: palette.muted,
                fontSize: 11,
                textAlign: "center",
                marginTop: 16,
              }}
            >
              Private by design · Stored on this device
            </Text>
          </ScrollView>
        )}

        {tab === "Calendar" && (
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 110 }}
          >
            <Text
              style={{ color: palette.text, fontSize: 28, fontWeight: "800" }}
            >
              Your calendar
            </Text>
            <Text
              style={{ color: palette.muted, marginTop: 5, marginBottom: 20 }}
            >
              A simple view of what is coming up.
            </Text>
            <Card>
              <Text
                style={{
                  color: palette.text,
                  fontSize: 18,
                  fontWeight: "800",
                  marginBottom: 14,
                }}
              >
                {new Date().toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {Array.from(
                  {
                    length: new Date(
                      new Date().getFullYear(),
                      new Date().getMonth() + 1,
                      0,
                    ).getDate(),
                  },
                  (_, i) => i + 1,
                ).map((day) => {
                  const d = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const has = reminders.some(
                    (r) => r.date === d && !r.completed,
                  );
                  return (
                    <View
                      key={day}
                      style={{
                        width: "14.28%",
                        alignItems: "center",
                        paddingVertical: 9,
                      }}
                    >
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor:
                            d === todayISO() ? palette.brand : "transparent",
                        }}
                      >
                        <Text
                          style={{
                            color: d === todayISO() ? "white" : palette.text,
                            fontWeight: d === todayISO() ? "800" : "500",
                          }}
                        >
                          {day}
                        </Text>
                      </View>
                      {has ? (
                        <View
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: 3,
                            backgroundColor: palette.brand,
                            marginTop: 2,
                          }}
                        />
                      ) : (
                        <View style={{ height: 7 }} />
                      )}
                    </View>
                  );
                })}
              </View>
            </Card>
            <Text
              style={{
                color: palette.text,
                fontSize: 19,
                fontWeight: "800",
                marginTop: 24,
                marginBottom: 12,
              }}
            >
              Upcoming events
            </Text>
            {reminders
              .filter((r) => !r.completed)
              .sort((a, b) =>
                `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`),
              )
              .map((item) => (
                <ReminderRow key={item.id} item={item} />
              ))}
            {reminders.filter((r) => !r.completed).length === 0 && (
              <Text style={{ color: palette.muted }}>
                Your calendar is clear. Enjoy the space.
              </Text>
            )}
          </ScrollView>
        )}

        {tab === "Settings" && (
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 110 }}
          >
            <Text
              style={{ color: palette.text, fontSize: 28, fontWeight: "800" }}
            >
              Settings
            </Text>
            <Text
              style={{ color: palette.muted, marginTop: 5, marginBottom: 22 }}
            >
              Make Reminder Pro work your way.
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
            <Card style={{ padding: 0, overflow: "hidden", marginBottom: 22 }}>
              <SettingRow
                palette={palette}
                icon={<Sun color={palette.brand} />}
                title="Appearance"
                subtitle="Choose light, dark or follow device"
                right={
                  <Text style={{ color: palette.brand, fontWeight: "800" }}>
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
                      onPress: () => updateSettings({ theme: "light" }),
                    },
                    {
                      text: "Dark",
                      onPress: () => updateSettings({ theme: "dark" }),
                    },
                    {
                      text: "Follow device",
                      onPress: () => updateSettings({ theme: "system" }),
                    },
                    { text: "Cancel", style: "cancel" },
                  ])
                }
              />
              <SettingRow
                palette={palette}
                icon={<Volume2 color={palette.brand} />}
                title="Reminder sound"
                subtitle="Use the built-in notification sound"
                right={
                  <Switch
                    value={settings.soundEnabled}
                    onValueChange={(v) => updateSettings({ soundEnabled: v })}
                    trackColor={{ true: palette.brand }}
                  />
                }
              />
              <SettingRow
                palette={palette}
                icon={<Bell color={palette.brand} />}
                title="Keep reminder in app"
                subtitle="Swiping a notification never deletes its reminder"
                right={
                  <Switch
                    value={settings.keepReminderAfterDismiss}
                    onValueChange={(v) =>
                      updateSettings({ keepReminderAfterDismiss: v })
                    }
                    trackColor={{ true: palette.brand }}
                  />
                }
              />
              <SettingRow
                palette={palette}
                icon={<CircleHelp color={palette.brand} />}
                title="Confirm before clearing"
                subtitle="Ask before marking a reminder complete in-app"
                right={
                  <Switch
                    value={settings.confirmBeforeClear}
                    onValueChange={(v) =>
                      updateSettings({ confirmBeforeClear: v })
                    }
                    trackColor={{ true: palette.brand }}
                  />
                }
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
              BACKUP & RESTORE
            </Text>
            <Card style={{ padding: 0, overflow: "hidden", marginBottom: 22 }}>
              <SettingRow
                palette={palette}
                icon={<Download color={palette.brand} />}
                title="Export JSON backup"
                subtitle="Best for restoring reminders and repeat settings"
                onPress={() => exportWith("json")}
                right={<ChevronRight color={palette.muted} />}
              />
              <SettingRow
                palette={palette}
                icon={<Download color={palette.brand} />}
                title="Export CSV"
                subtitle="Open in spreadsheet apps"
                onPress={() => exportWith("csv")}
                right={<ChevronRight color={palette.muted} />}
              />
              <SettingRow
                palette={palette}
                icon={<FileUp color={palette.brand} />}
                title="Import backup or CSV"
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
                <View style={{ flex: 1 }}>
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
              <Text style={{ color: palette.muted, fontSize: 12 }}>
                Reminder Pro · Version 1.0.0 · Offline-first
              </Text>
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
            { name: "Home", icon: Home },
            { name: "Calendar", icon: CalendarDays },
            { name: "Settings", icon: SettingsIcon },
          ].map((x) => {
            const I = x.icon;
            const active = tab === x.name;
            return (
              <Pressable
                key={x.name}
                onPress={() => setTab(x.name)}
                style={{ alignItems: "center", gap: 4, minWidth: 70 }}
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
        <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
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
                <View style={{ width: 42 }} />
              </View>
              <Text style={{ color: palette.muted, marginBottom: 18 }}>
                A title, a time, and you are all set.
              </Text>
              <Label>REMINDER TITLE *</Label>
              <Field
                value={form.title}
                onChangeText={(v) => setForm((p) => ({ ...p, title: v }))}
                placeholder="e.g. Mom's birthday"
              />
              <Label>DESCRIPTION (OPTIONAL)</Label>
              <Field
                value={form.description}
                onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
                placeholder="Add a note or a little context…"
                multiline
              />
              <Label>DATE · YYYY-MM-DD</Label>
              <Field
                value={form.date}
                onChangeText={(v) => setForm((p) => ({ ...p, date: v }))}
                placeholder="2026-12-24"
                keyboardType="numbers-and-punctuation"
              />
              <Text
                style={{ color: palette.muted, fontSize: 11, marginTop: 5 }}
              >
                Use today or a future date.
              </Text>
              <Label>TIME · 24-HOUR HH:MM</Label>
              <Field
                value={form.time}
                onChangeText={(v) => setForm((p) => ({ ...p, time: v }))}
                placeholder="09:30"
                keyboardType="numbers-and-punctuation"
              />
              <Label>REPEAT</Label>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {[
                  { v: "none", l: "Never" },
                  { v: "daily", l: "Daily" },
                  { v: "weekly", l: "Weekly" },
                  { v: "monthly", l: "Monthly" },
                  { v: "yearly", l: "Yearly" },
                ].map((o) => (
                  <Chip
                    key={o.v}
                    label={o.l}
                    active={form.repeat === o.v}
                    onPress={() => setForm((p) => ({ ...p, repeat: o.v }))}
                  />
                ))}
              </View>
              {form.repeat !== "none" && (
                <>
                  <Label>REPEAT UNTIL (OPTIONAL) · YYYY-MM-DD</Label>
                  <Field
                    value={form.repeatUntil}
                    onChangeText={(v) =>
                      setForm((p) => ({ ...p, repeatUntil: v }))
                    }
                    placeholder="Leave empty to repeat indefinitely"
                  />
                </>
              )}
              <View style={{ marginTop: 26 }}>
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
          <Pressable onPress={() => setDetail(null)} style={{ flex: 1 }} />
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
              <View style={{ flex: 1, marginRight: 12 }}>
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
              <Text style={{ color: palette.muted, marginBottom: 16 }}>
                Repeats {detail.repeat}
                {detail.repeatUntil ? ` until ${detail.repeatUntil}` : ""}
              </Text>
            ) : null}
            {!detail?.completed && (
              <View style={{ marginBottom: 10 }}>
                <Btn
                  title="Mark as complete"
                  onPress={() =>
                    settings.confirmBeforeClear
                      ? Alert.alert(
                          "Mark complete?",
                          "This will complete the reminder in the app.",
                          [
                            { text: "Keep it", style: "cancel" },
                            {
                              text: "Complete",
                              onPress: () => markComplete(detail.id),
                            },
                          ],
                        )
                      : markComplete(detail.id)
                  }
                  icon={<CheckCircle2 color="white" size={18} />}
                />
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Btn title="Edit" secondary onPress={() => openEdit(detail)} />
              </View>
              <View style={{ flex: 1 }}>
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
      <View style={{ flex: 1 }}>
        <Text style={{ color: palette.text, fontWeight: "700", fontSize: 14 }}>
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
