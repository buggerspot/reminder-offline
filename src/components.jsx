import React, { useContext } from "react";
import { View, Text, TextInput, Pressable, Switch } from "react-native";
import { CalendarDays, CheckCircle2, ChevronRight } from "lucide-react-native";
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
export function PermissionBanner({ message, onEnable, onDismiss }) {
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
        <Btn title="Enable Notifications" onPress={onEnable} />
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
  ({ item, onOpen, onLongPress, selected }) => {
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
          {selected ? (
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
            {formatDate(item.date)} · {formatTime(item.time)}
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
