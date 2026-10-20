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
import { PaletteContext } from "./palette";
import { ZoomableImage } from "./interaction-components";
export { PaletteContext } from "./palette";
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
export function PermissionBanner({
  message,
  onEnable,
  onDismiss,
  actionTitle = "Enable Notifications",
}) {
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
  inputProps = {},
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
        {...inputProps}
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
  ({
    item,
    onOpen,
    onLongPress,
    selected,
    selectionMode,
    showStatus = false,
  }) => {
    const [imageFailed, setImageFailed] = React.useState(false);
    useEffect(() => setImageFailed(false), [item.imageUri]);
    const palette = useContext(PaletteContext);
    return (
      <Pressable
        onPress={() => onOpen(item)}
        onLongPress={() => onLongPress?.(item)}
        accessibilityState={{
          selected: !!selected,
        }}
        style={({ pressed }) => ({
          opacity: pressed ? 0.78 : 1,
          flexDirection: "row",
          alignItems: "center",
          padding: 14,
          marginBottom: 10,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: selected ? palette.brand : palette.border,
          backgroundColor: palette.card,
        })}
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
          ) : item.imageUri && !imageFailed ? (
            <ZoomableImage
              uri={item.imageUri}
              onLongPress={() => onLongPress?.(item)}
              onError={() => setImageFailed(true)}
              style={{ width: 46, height: 46, borderRadius: 15 }}
            />
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
              color: showStatus && item.missed ? palette.danger : palette.text,
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
                color:
                  showStatus && item.missed ? palette.danger : palette.muted,
                textDecorationLine:
                  showStatus && item.completed ? "line-through" : "none",
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

// Both layers occupy the same space, so selection never moves the reminder list.
export function SelectionArea({ active, actions, children }) {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;
  const reducedMotion = useRef(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) reducedMotion.current = value;
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (value) => {
        reducedMotion.current = value;
      },
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    progress.stopAnimation();
    Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration: reducedMotion.current ? 0 : 160,
      useNativeDriver: true,
    }).start();
    return () => progress.stopAnimation();
  }, [active, progress]);
  const layer = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 };
  return (
    <View style={{ height: 48, marginBottom: 6, marginTop: 6 }}>
      <Animated.View
        pointerEvents={active ? "none" : "auto"}
        accessibilityElementsHidden={active}
        importantForAccessibility={active ? "no-hide-descendants" : "auto"}
        style={[
          layer,
          {
            opacity: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0],
            }),
          },
        ]}
      >
        {children}
      </Animated.View>
      <Animated.View
        pointerEvents={active ? "auto" : "none"}
        accessibilityElementsHidden={!active}
        importantForAccessibility={active ? "auto" : "no-hide-descendants"}
        style={[layer, { opacity: progress }]}
      >
        {actions}
      </Animated.View>
    </View>
  );
}

export function SelectionToolbar({
  count,
  total,
  onSelectAll,
  onDelete,
  onCancel,
  onComplete,
}) {
  const palette = useContext(PaletteContext);
  const actionStyle = {
    flex: 1,
    minWidth: 0,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  };
  const textStyle = {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "700",
    textAlign: "center",
  };
  return (
    <View
      style={{
        height: 48,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.card,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 4,
      }}
    >
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: count > 0 && count === total }}
        onPress={onSelectAll}
        style={actionStyle}
      >
        <Text style={[textStyle, { color: palette.brand }]}>
          {count === total && total > 0 ? "Deselect all" : "Select all"} (
          {count})
        </Text>
      </Pressable>
      {onComplete && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Complete selected reminders"
          disabled={!count}
          onPress={onComplete}
          style={actionStyle}
        >
          <Text
            style={[
              textStyle,
              { color: count ? palette.brand : palette.muted },
            ]}
          >
            Complete
          </Text>
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Delete selected reminders"
        disabled={!count}
        onPress={onDelete}
        style={actionStyle}
      >
        <Trash2 size={21} color={count ? palette.danger : palette.muted} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onCancel}
        style={actionStyle}
      >
        <Text style={[textStyle, { color: palette.text }]}>Cancel</Text>
      </Pressable>
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
      animationType="none"
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

export function SelectedDateText({ date, label, palette, style }) {
  const tilt = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled || reduced || !date) return;
      tilt.setValue(0);
      Animated.sequence([
        Animated.timing(tilt, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(tilt, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    });
    return () => {
      cancelled = true;
      tilt.stopAnimation();
    };
  }, [date, tilt]);
  return (
    <Animated.Text
      style={[
        {
          color: palette.text,
          fontSize: 19,
          fontWeight: "800",
          marginVertical: 16,
          transform: [
            {
              rotate: tilt.interpolate({
                inputRange: [0, 1],
                outputRange: ["0deg", "-2deg"],
              }),
            },
          ],
        },
        style,
      ]}
    >
      {label}
    </Animated.Text>
  );
}
