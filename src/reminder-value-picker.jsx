import React, { useContext, useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, UIManager, View, requireNativeComponent } from "react-native";
import { ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Btn, Chip, Field, Label, PaletteContext } from "./components";
import { localDate, validDate } from "./lib/recurrence";

export const REPEAT_OPTIONS = [
  { value: "none", label: "Never" }, { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];
const NativePicker = Platform.OS === "android" && UIManager.getViewManagerConfig("ReminderVisualPicker")
  ? requireNativeComponent("ReminderVisualPicker") : null;

export function PickerField({ label, onPress, ...props }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${label}`} onPress={onPress}>
    <View pointerEvents="none"><Field {...props} inputProps={{ editable: false, accessible: false }} /></View>
  </Pressable>;
}

function Choices({ values, value, onChange, label }) {
  return <View accessibilityLabel={label} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
    {values.map(option => <Chip key={option.value} label={option.label} active={String(value) === option.value} onPress={() => onChange(option.value)} />)}
  </View>;
}

function CalendarPicker({ value, onChange, fallback }) {
  const palette = useContext(PaletteContext);
  const initial = validDate(value) ? new Date(`${value}T12:00:00`) : validDate(fallback) ? new Date(`${fallback}T12:00:00`) : new Date();
  const [month, setMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const start = month.getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const move = amount => setMonth(current => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  return <View>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => move(-1)} style={{ padding: 12 }}><ChevronLeft color={palette.brand} /></Pressable>
      <Text accessibilityLiveRegion="polite" style={{ color: palette.text, fontSize: 18, fontWeight: "800", flex: 1, textAlign: "center" }}>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => move(1)} style={{ padding: 12 }}><ChevronRight color={palette.brand} /></Pressable>
    </View>
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
      <Chip label="Previous year" onPress={() => move(-12)} /><Chip label="Today" onPress={() => { const today = new Date(); setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); onChange(localDate(today)); }} /><Chip label="Next year" onPress={() => move(12)} />
    </View>
    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <Text key={`weekday-${index}`} style={{ width: "14.2857%", textAlign: "center", color: palette.muted, paddingVertical: 8 }}>{day}</Text>)}
      {Array.from({ length: start + days }, (_, index) => {
        const day = index - start + 1;
        if (day < 1) return <View key={index} style={{ width: "14.2857%" }} />;
        const date = localDate(new Date(month.getFullYear(), month.getMonth(), day));
        const selected = date === value;
        return <Pressable key={index} accessibilityRole="button" accessibilityLabel={date} accessibilityState={{ selected }} onPress={() => onChange(date)} style={{ width: "14.2857%", minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: selected ? palette.brand : "transparent" }}>
          <Text style={{ color: selected ? palette.onBrand : palette.text, fontWeight: selected ? "800" : "500" }}>{day}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}

function TimeChoices({ value, onChange, fallback = "09:30" }) {
  const [hour = "09", minute = "30"] = /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value.split(":") : fallback.split(":");
  const options = count => Array.from({ length: count }, (_, index) => ({ value: String(index).padStart(2, "0"), label: String(index).padStart(2, "0") }));
  return <View>
    <Label>HOUR · 24-HOUR</Label><Choices label="Hours" values={options(24)} value={hour} onChange={next => onChange(`${next}:${minute}`)} />
    <Label>MINUTE</Label><Choices label="Minutes" values={options(60)} value={minute} onChange={next => onChange(`${hour}:${next}`)} />
  </View>;
}

export function ReminderValuePicker({ field, value, onChange, onClose, visualOnly = false }) {
  const palette = useContext(PaletteContext);
  const [custom, setCustom] = useState(false);
  const [repeatText, setRepeatText] = useState(REPEAT_OPTIONS.find(option => option.value === value)?.label || "");
  const [error, setError] = useState("");
  const input = useRef(null);
  const close = () => { Keyboard.dismiss(); onClose(); };
  const done = () => {
    if (field.kind === "repeat" && custom) {
      const option = REPEAT_OPTIONS.find(item => [item.label.toLowerCase(), item.value].includes(repeatText.trim().toLowerCase()));
      if (!option) { setError("Enter Never, Daily, Weekly, Monthly, or Yearly."); return; }
      onChange(option.value);
    } else if (!custom && field.kind === "date") {
      onChange(date);
    } else if (!custom && field.kind === "time") {
      onChange(time);
    }
    close();
  };
  const date = validDate(value) ? value : field.fallback || localDate();
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : field.fallback || "09:30";
  return <View accessibilityViewIsModal importantForAccessibility="yes" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)" }}>
    <SafeAreaView style={{ flex: 1 }}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={{ flex: 1, padding: 20, alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: 420, maxHeight: "100%", backgroundColor: palette.bg, borderWidth: 1, borderColor: palette.border, borderRadius: 20, padding: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <Text style={{ flex: 1, color: palette.text, fontSize: 16, fontWeight: "800" }}>{field.label}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close picker" onPress={close} style={{ padding: 10 }}><X color={palette.text} size={22} /></Pressable>
          </View>
          {!visualOnly && <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
            <Chip label={field.kind === "date" ? "Calendar" : field.kind === "time" ? "Clock" : "Options"} active={!custom} onPress={() => { Keyboard.dismiss(); setCustom(false); }} />
            <Chip label="Custom" active={custom} onPress={() => {
              if (custom) { input.current?.focus(); return; }
              setRepeatText(REPEAT_OPTIONS.find(option => option.value === value)?.label || "");
              setError("");
              setCustom(true);
            }} />
          </View>}
          <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 4 }}>
            {custom ? <>
              <Field value={field.kind === "repeat" ? repeatText : value} onChangeText={next => { setError(""); field.kind === "repeat" ? setRepeatText(next) : onChange(next); }} placeholder={field.placeholder} keyboardType={field.keyboardType} inputProps={{ ref: input, autoFocus: true, showSoftInputOnFocus: true, accessibilityLabel: field.label, returnKeyType: "done", onSubmitEditing: done }} />
              {error ? <Text accessibilityLiveRegion="polite" style={{ color: palette.danger, marginTop: 8 }}>{error}</Text> : null}
            </> : field.kind === "repeat" ? <Choices values={REPEAT_OPTIONS} value={value} onChange={onChange} label="Repeat options" />
              : field.kind === "monthDay" ? <Choices values={Array.from({ length: 31 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }))} value={value} onChange={onChange} label="Day of month" />
                : NativePicker ? <NativePicker kind={field.kind} value={field.kind === "date" ? date : time} dark={palette.bg === "#000000"} onChange={event => onChange(event.nativeEvent.value)} style={{ height: 420, width: "100%" }} />
                  : field.kind === "date" ? <CalendarPicker value={value} fallback={field.fallback} onChange={onChange} /> : <TimeChoices value={value} fallback={field.fallback} onChange={onChange} />}
          </ScrollView>
          {field.optional && <Pressable accessibilityRole="button" onPress={() => { onChange(""); close(); }} style={{ paddingVertical: 12 }}><Text style={{ color: palette.brand, fontWeight: "700" }}>No end date</Text></Pressable>}
          <View style={{ marginTop: 12 }}><Btn title="Done" onPress={done} /></View>
        </View>
      </View>
    </KeyboardAvoidingView>
    </SafeAreaView>
  </View>;
}
