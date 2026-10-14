import React, { useContext, useEffect, useRef } from "react";
import {
  Animated,
  AccessibilityInfo,
  View,
  Text,
  TextInput,
  Pressable,
  Switch,
  Modal,
  Keyboard,
} from "react-native";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Square,
  CheckSquare,
  Trash2,
} from "lucide-react-native";
import { localDate } from "./lib/recurrence";
import { formatDate, formatTime } from "./lib/format";
export const PaletteContext = React.createContext(null);
export function RecurrenceLabel({ repeat, missed }) {
  const palette = useContext(PaletteContext);
  if ((!repeat || repeat === "none") && !missed) return null;
  const label =
    repeat && repeat !== "none"
      ? `${missed ? "Repeated Reminder · " : ""}${repeat[0].toUpperCase() + repeat.slice(1)}`
      : "One-time Reminder";
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: palette.soft,
        borderRadius: 7,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginTop: 6,
      }}
    >
      <Text
        style={{
          color: palette.brand,
          fontWeight: "700",
          fontSize: 11,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
export const SettingsToggle = React.memo(({ value, onValueChange, label }) => {
  const palette = useContext(PaletteContext);
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      accessibilityLabel={label}
      trackColor={{
        true: palette.brand,
        false: palette.border,
      }}
      thumbColor="#FFFFFF"
    />
  );
});
export function PermissionBanner({ message, onEnable, onDismiss, actionTitle = "Enable Notifications" }) {
  const palette = useContext(PaletteContext);
  return (
    <View
      style={{
        backgroundColor: palette.soft,
        padding: 14,
        borderBottomWidth: 1,
        borderColor: palette.border,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Text
          style={{
            flex: 1,
            color: palette.text,
          }}
        >
          {message}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss permission banner"
          hitSlop={10}
          onPress={onDismiss}
        >
          <Text
            style={{
              color: palette.muted,
              fontSize: 22,
            }}
          >
            ×
          </Text>
        </Pressable>
      </View>
      <View
        style={{
          marginTop: 10,
        }}
      >
        <Btn title={actionTitle} onPress={onEnable} />
      </View>
    </View>
  );
}
export const Card = ({ children, style }) => {
  const palette = useContext(PaletteContext);
  return (
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
};
export const Btn = ({
  title,
  onPress,
  secondary = false,
  icon = null,
  danger = false,
  disabled = false,
}) => {
  const palette = useContext(PaletteContext);
  const foreground = danger
    ? palette.danger
    : secondary
      ? palette.text
      : palette.onBrand;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        minHeight: 48,
        borderRadius: 14,
        paddingHorizontal: 16,
        flexDirection: "row",
        gap: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: danger
          ? palette.dangerSoft
          : secondary
            ? palette.soft
            : palette.brand,
        opacity: disabled ? 0.55 : pressed ? 0.75 : 1,
      })}
    >
      {React.isValidElement(icon)
        ? React.cloneElement(icon, {
            color: foreground,
          })
        : icon}
      {
        <Text
          style={{
            color: foreground,
            fontWeight: "700",
            fontSize: 14,
          }}
        >
          {title}
        </Text>
      }
    </Pressable>
  );
};
export const Label = ({ children }) => {
  const palette = useContext(PaletteContext);
  return (
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
};
export const Field = ({
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType = "default",
}) => {
  const palette = useContext(PaletteContext);
  return (
    <>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.muted}
        multiline={multiline}
        returnKeyType={multiline ? "done" : undefined}
        submitBehavior={multiline ? "blurAndSubmit" : undefined}
        onSubmitEditing={multiline ? () => Keyboard.dismiss() : undefined}
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
      {multiline && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Insert new line"
          onPress={() => onChangeText(`${value || ""}\n`)}
          style={{
            alignSelf: "flex-end",
            paddingVertical: 8,
            paddingHorizontal: 4,
          }}
        >
          <Text style={{ color: palette.brand, fontSize: 12 }}>New line</Text>
        </Pressable>
      )}
    </>
  );
};
export const Chip = ({ label, active, onPress }) => {
  const palette = useContext(PaletteContext);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{
        selected: !!active,
      }}
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
          color: active ? palette.onBrand : palette.muted,
          fontWeight: "700",
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
};
export const ReminderRow = React.memo(
  ({ item, onOpen, onLongPress, selected, selectionMode }) => {
    const palette = useContext(PaletteContext);
    return (
      <Pressable
        onPress={() => onOpen(item)}
        onLongPress={() => onLongPress?.(item)}
        accessibilityState={{
          selected: !!selected,
        }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: 14,
          marginBottom: 10,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: selected ? palette.brand : palette.border,
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
          {selectionMode ? (
            selected ? (
              <CheckSquare color={palette.brand} size={21} />
            ) : (
              <Square color={palette.brand} size={21} />
            )
          ) : selected ? (
            <CheckCircle2 color={palette.brand} size={21} />
          ) : (
            <CalendarDays color={palette.brand} size={21} />
          )}
        </View>
        <View
          style={{
            flex: 1,
          }}
        >
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
            style={{
              color: palette.muted,
              fontSize: 12,
              marginTop: 4,
            }}
          >
            {item.date === localDate() ? "Today" : formatDate(item.date)} ·{" "}
            {formatTime(item.time)}
          </Text>
          <RecurrenceLabel repeat={item.repeat} missed={item.missed} />
          {item.description ? (
            <Text
              numberOfLines={1}
              style={{
                color: palette.muted,
                fontSize: 12,
                marginTop: 4,
              }}
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
  },
);

export function SelectionToolbar({
  context = "Long-press a reminder to select and manage it.",
  active = true,
  count,
  total,
  onSelectAll,
  onDelete,
  onCancel,
}) {
  const palette = useContext(PaletteContext);
  const tilt = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      tilt.setValue(reduced ? 1 : 0);
      Animated.timing(tilt, { toValue: 1, duration: reduced ? 0 : 180, useNativeDriver: true }).start();
    });
    return () => { cancelled = true; tilt.stopAnimation(); };
  }, [active, tilt]);
  return (
    <View
      style={{ minHeight: 64, marginBottom: 8, justifyContent: "center" }}
      
    >
      <Animated.View
        style={{
          minHeight: 64,
          paddingHorizontal: 12,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: palette.border,
          backgroundColor: palette.card,
          transform: [{ perspective: 600 }, { rotateX: tilt.interpolate({ inputRange: [0, 1], outputRange: ["8deg", "0deg"] }) }],
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        {active ? <>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: count > 0 && count === total }}
          onPress={onSelectAll}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={{ color: palette.brand, fontWeight: "700" }}>
            {count === total && total > 0 ? "Deselect all" : "Select all"} ({count})
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={!count}
          accessibilityState={{ disabled: !count }}
          onPress={onDelete}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text
            style={{
              color: count ? palette.danger : palette.muted,
              fontWeight: "700",
            }}
          >
            Delete
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onCancel}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={{ color: palette.text, fontWeight: "700" }}>Cancel</Text>
        </Pressable>
        </> : <Text style={{ flex: 1, color: palette.muted, fontSize: 12, lineHeight: 18 }}>{context}</Text>}
      </Animated.View>
    </View>
  );
}
export function AppDialog({ dialog, onClose }) {
  const palette = useContext(PaletteContext);
  const buttons = dialog?.buttons || [{ text: "OK" }];
  return (
    <Modal
      visible={!!dialog}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "#0008",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Card
          style={{
            width: "100%",
            maxWidth: 460,
            alignSelf: "center",
            padding: 24,
            shadowColor: "#000",
            shadowOpacity: 0.15,
            shadowRadius: 24,
            elevation: 8,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{ color: palette.text, fontSize: 20, fontWeight: "800" }}
          >
            {dialog?.title}
          </Text>
          {!!dialog?.message && (
            <Text
              style={{
                color: palette.muted,
                fontSize: 15,
                lineHeight: 23,
                marginTop: 12,
              }}
            >
              {dialog.message}
            </Text>
          )}
          <View style={{ gap: 10, marginTop: 24 }}>
            {buttons.map((button, i) => (
              <Btn
                key={i}
                title={button.text}
                secondary={button.style === "cancel"}
                danger={button.style === "destructive"}
                onPress={async () => {
                  onClose();
                  try {
                    await button.onPress?.();
                  } catch (e) {
                    console.warn(e);
                  }
                }}
              />
            ))}
          </View>
        </Card>
      </View>
    </Modal>
  );
}
