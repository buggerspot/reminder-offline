import React, { createContext, forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { AccessibilityInfo, Animated as RNAnimated, BackHandler, FlatList, Image, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import PagerView from "react-native-pager-view";
import { BlurTargetView, BlurView } from "expo-blur";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { cancelAnimation, ReduceMotion, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { X } from "lucide-react-native";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { PaletteContext } from "./palette";
import { createSheetOpening } from "./lib/presentation";
import { boundaryPull, pageIndex, sheetDestination, TAB_NAMES } from "./lib/interactions";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduced(value); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => { active = false; subscription.remove(); };
  }, []);
  return reduced;
}

// Native pages remain mounted; switching tabs never reconstructs a long list.
export function TabPager({ navigation, children }) {
  const pager = useRef(null);
  const tab = useSyncExternalStore(navigation.subscribe, navigation.getSnapshot, navigation.getSnapshot);
  const initialPage = useRef(TAB_NAMES.indexOf(tab)).current;
  const { width } = useWindowDimensions();
  useLayoutEffect(() => navigation.bind(index => {
    Keyboard.dismiss();
    if (Platform.OS === "web") pager.current?.scrollTo({ x: index * width, animated: false });
    else pager.current?.setPageWithoutAnimation(index);
  }), [navigation, width]);
  useLayoutEffect(() => {
    if (Platform.OS === "web") pager.current?.scrollTo({ x: TAB_NAMES.indexOf(navigation.getSnapshot()) * width, animated: false });
  }, [navigation, width]);
  const pages = React.Children.toArray(children).map((child, i) => (
    <View key={TAB_NAMES[i]} collapsable={false} accessibilityElementsHidden={tab !== TAB_NAMES[i]} importantForAccessibility={tab === TAB_NAMES[i] ? "auto" : "no-hide-descendants"} style={{ flex: 1, width: Platform.OS === "web" ? width : undefined, height: "100%" }}>
      {child}
    </View>
  ));
  if (Platform.OS === "web") return <ScrollView ref={pager} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScrollBeginDrag={navigation.beginSwipe} onMomentumScrollEnd={e => navigation.selected(pageIndex(e.nativeEvent.contentOffset.x, width))} style={{ flex: 1 }}>{pages}</ScrollView>;
  return <PagerView ref={pager} style={{ flex: 1 }} initialPage={initialPage} offscreenPageLimit={2} onPageSelected={e => navigation.selected(e.nativeEvent.position)} onPageScrollStateChanged={e => { if (e.nativeEvent.pageScrollState === "dragging") navigation.beginSwipe(); }} keyboardDismissMode="on-drag">{pages}</PagerView>;
}

function BoundaryGradient({ color, bottom = false }) {
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  return <Svg width="100%" height="10" preserveAspectRatio="none" viewBox="0 0 100 10">
    <Defs>
      <LinearGradient id={id} x1="0" y1={bottom ? "100%" : "0%"} x2="0" y2={bottom ? "0%" : "100%"}>
        <Stop offset="0" stopColor={color} stopOpacity="1" />
        <Stop offset="0.35" stopColor={color} stopOpacity="0.45" />
        <Stop offset="1" stopColor={color} stopOpacity="0" />
      </LinearGradient>
    </Defs>
    <Rect width="100" height="10" fill={`url(#${id})`} />
  </Svg>;
}

function createBoundaryScroll(Component) {
  return forwardRef(function BoundaryScroll({ onScroll, onLayout, onContentSizeChange, boundaryInset = 0, style, ...props }, ref) {
    const palette = useContext(PaletteContext);
    const metrics = useRef({ offset: 0, content: 0, viewport: 0 });
    const touch = useRef(null);
    const shown = useRef(null);
    const top = useRef(new RNAnimated.Value(0)).current;
    const bottom = useRef(new RNAnimated.Value(0)).current;
    const reduced = useReducedMotion();
    const fade = useCallback(() => {
      touch.current = null;
      shown.current = null;
      for (const opacity of [top, bottom]) RNAnimated.timing(opacity, { toValue: 0, duration: reduced ? 0 : 220, useNativeDriver: true }).start();
    }, [top, bottom, reduced]);
    useEffect(() => () => { top.stopAnimation(); bottom.stopAnimation(); }, [top, bottom]);
    return <View style={[{ flex: 1 }, style]} onTouchStart={e => {
      const m = metrics.current;
      touch.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, edgeY: e.nativeEvent.pageY, edge: m.offset <= 1 ? "top" : m.offset + m.viewport >= m.content - 1 ? "bottom" : null };
    }} onTouchMove={e => {
      if (!touch.current) return;
      const m = metrics.current;
      const dy = e.nativeEvent.pageY - touch.current.y;
      const boundary = m.offset <= 1 && dy > 0 ? "top" : m.offset + m.viewport >= m.content - 1 && dy < 0 ? "bottom" : null;
      if (boundary !== touch.current.edge) { touch.current.edge = boundary; touch.current.edgeY = e.nativeEvent.pageY; }
      const edge = boundaryPull({ ...m, dx: e.nativeEvent.pageX - touch.current.x, dy: e.nativeEvent.pageY - touch.current.edgeY });
      if (!edge || edge === shown.current) return;
      shown.current = edge;
      RNAnimated.timing(edge === "top" ? top : bottom, { toValue: 0.14, duration: reduced ? 0 : 100, useNativeDriver: true }).start();
    }} onTouchEnd={fade} onTouchCancel={fade}>
      <Component {...props} ref={ref} style={{ flex: 1 }} scrollEventThrottle={16} onScroll={e => {
        metrics.current.offset = e.nativeEvent.contentOffset.y;
        metrics.current.viewport = e.nativeEvent.layoutMeasurement.height;
        metrics.current.content = e.nativeEvent.contentSize.height;
        onScroll?.(e);
      }} onLayout={e => { metrics.current.viewport = e.nativeEvent.layout.height; onLayout?.(e); }} onContentSizeChange={(w, h) => { metrics.current.content = h; onContentSizeChange?.(w, h); }} />
      <RNAnimated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: "absolute", top: 0, left: 0, right: 0, height: 10, opacity: top }}><BoundaryGradient color={palette.brand} /></RNAnimated.View>
      <RNAnimated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: "absolute", bottom: boundaryInset, left: 0, right: 0, height: 10, opacity: bottom }}><BoundaryGradient color={palette.brand} bottom /></RNAnimated.View>
    </View>;
  });
}
export const PremiumFlatList = createBoundaryScroll(FlatList);
export const PremiumScrollView = createBoundaryScroll(ScrollView);

const ImageViewerContext = createContext(() => {});

// A scope lives inside each native presentation so the same viewer works above
// the main screen, the editor, and the details sheet on both iOS and Android.
export const ImageViewerScope = forwardRef(function ImageViewerScope({ children }, ref) {
  const palette = useContext(PaletteContext);
  const target = useRef(null);
  const [image, setImage] = useState(null);
  const [size, setSize] = useState(null);
  const [failed, setFailed] = useState(false);
  const request = useRef(0);
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const opacity = useRef(new RNAnimated.Value(0)).current;
  const close = useCallback(() => {
    request.current++;
    RNAnimated.timing(opacity, { toValue: 0, duration: reduced ? 0 : 140, useNativeDriver: true }).start(({ finished }) => { if (finished) setImage(null); });
  }, [opacity, reduced]);
  useImperativeHandle(ref, () => ({ closeIfOpen: () => { if (!image) return false; close(); return true; } }), [image, close]);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceTransparencyEnabled?.().then(value => { if (active) setReduceTransparency(value); });
    const subscription = AccessibilityInfo.addEventListener("reduceTransparencyChanged", setReduceTransparency);
    return () => { active = false; request.current++; subscription.remove(); opacity.stopAnimation(); };
  }, [opacity]);
  useEffect(() => {
    if (!image) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { close(); return true; });
    return () => subscription.remove();
  }, [image, close]);
  const open = useCallback(uri => {
    const current = ++request.current;
    setImage(uri); setSize(null); setFailed(false);
    Image.getSize(uri, (w, h) => { if (request.current === current) setSize({ width: w, height: h }); }, () => { if (request.current === current) setFailed(true); });
    RNAnimated.timing(opacity, { toValue: 1, duration: reduced ? 0 : 160, useNativeDriver: true }).start();
  }, [opacity, reduced]);
  const scale = size ? Math.min((width - 32) / size.width, (height - 120) / size.height) : 1;
  return <ImageViewerContext.Provider value={open}>
    <BlurTargetView ref={target} style={{ flex: 1 }} accessibilityElementsHidden={!!image} importantForAccessibility={image ? "no-hide-descendants" : "auto"}>{children}</BlurTargetView>
    {!!image && <RNAnimated.View accessibilityViewIsModal style={[StyleSheet.absoluteFill, { opacity, backgroundColor: reduceTransparency ? "#080B0B" : "transparent" }]}>
      {!reduceTransparency && <BlurView pointerEvents="none" blurTarget={target} blurMethod="dimezisBlurViewSdk31Plus" intensity={55} tint="dark" style={StyleSheet.absoluteFill} />}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.88)" }]} />
      <Pressable accessibilityRole="button" accessibilityLabel="Close image viewer" onPress={close} style={StyleSheet.absoluteFill} />
      <View pointerEvents="box-none" style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 16 }}>
        {failed ? <Text style={{ color: "white" }}>Image unavailable</Text> : size ? <Pressable onPress={() => {}} accessibilityLabel="Full reminder image">
          <Image source={{ uri: image }} resizeMode="contain" onError={() => setFailed(true)} style={{ width: size.width * scale, height: size.height * scale, borderRadius: 14 }} />
        </Pressable> : <Text style={{ color: "white" }}>Loading image…</Text>}
      </View>
      <SafeAreaView pointerEvents="box-none" style={{ position: "absolute", top: 0, right: 0 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close image viewer" onPress={close} style={({ pressed }) => ({ margin: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: palette.card, opacity: pressed ? 0.7 : 1, justifyContent: "center", alignItems: "center" })}><X color={palette.text} size={24} /></Pressable>
      </SafeAreaView>
    </RNAnimated.View>}
  </ImageViewerContext.Provider>;
});

export function ZoomableImage({ uri, style, onError, onLongPress }) {
  const open = useContext(ImageViewerContext);
  return <Pressable accessibilityRole="button" accessibilityLabel="View reminder image" onLongPress={onLongPress} onPress={e => { e.stopPropagation(); open(uri); }} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
    <Image source={{ uri }} onError={onError} style={style} />
  </Pressable>;
}

const spring = { damping: 28, stiffness: 260, mass: 0.85, overshootClamping: true, reduceMotion: ReduceMotion.System };

export const ReminderSheet = forwardRef(function ReminderSheet({ item, presentation, onClose, onDismiss, onExpand, onCollapse, expanded, children }, ref) {
  const palette = useContext(PaletteContext);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const summary = useRef({ id: null, height: 0 });
  const [collapsed, setCollapsed] = useState(height * 0.28);
  const lifecycle = useRef("closed");
  const opening = useRef(createSheetOpening());
  const y = useSharedValue(height);
  const start = useSharedValue(0);
  const closing = useSharedValue(false);
  const viewer = useRef(null);
  const geometry = useRef({ height, top: insets.top, expanded });
  const collapsedPosition = () => Math.max(insets.top + 40, height - Math.min(summary.current.height + 28, height * 0.75));
  const startOpening = () => {
    if (lifecycle.current !== "opening") return;
    lifecycle.current = "open";
    presentation?.shown();
    const target = collapsedPosition();
    setCollapsed(target);
    y.value = withSpring(expanded ? insets.top : target, spring);
  };
  const finishClose = useCallback(() => { onClose(); }, [onClose]);
  const close = useCallback(() => {
    if (viewer.current?.closeIfOpen()) return;
    if (lifecycle.current === "closing" || lifecycle.current === "closed") return;
    if (presentation && !presentation.beginClose()) return;
    lifecycle.current = "closing";
    closing.value = true;
    Keyboard.dismiss();
    y.value = withTiming(height, { duration: 190, reduceMotion: ReduceMotion.System }, done => { if (done) runOnJS(finishClose)(); });
  }, [height, y, closing, finishClose, presentation]);
  useImperativeHandle(ref, () => ({ close }), [close]);
  const visible = !!item;
  useLayoutEffect(() => {
    opening.current.reset();
    lifecycle.current = visible ? "opening" : "closed";
    closing.value = false;
    cancelAnimation(y);
    y.value = height;
    return () => cancelAnimation(y);
  }, [visible]);
  useLayoutEffect(() => {
    const previous = geometry.current;
    geometry.current = { height, top: insets.top, expanded };
    if (lifecycle.current !== "open") return;
    if (previous.height !== height || previous.top !== insets.top || previous.expanded !== expanded) {
      const target = collapsedPosition();
      setCollapsed(target);
      y.value = withSpring(expanded ? insets.top : target, spring);
    }
  }, [height, insets.top, expanded]);
  const onContentLayout = (_w, contentHeight) => {
    if (contentHeight <= 0 || !item) return;
    summary.current = { id: item.id, height: contentHeight };
    if (opening.current.measured()) startOpening();
  };
  const onShow = () => { if (opening.current.shown()) startOpening(); };
  const gesture = Gesture.Pan().activeOffsetY([-8, 8]).failOffsetX([-30, 30]).onBegin(() => { cancelAnimation(y); start.value = y.value; }).onUpdate(e => {
    if (!closing.value) y.value = Math.max(insets.top, Math.min(height, start.value + e.translationY));
  }).onEnd(e => {
    const destination = sheetDestination(e.translationY, e.velocityY, expanded);
    if (destination === "close") { runOnJS(close)(); return; }
    if (destination === "collapse") { y.value = withSpring(collapsed, spring); runOnJS(onCollapse)(); return; }
    if (destination === "expand") { y.value = withSpring(insets.top, spring); runOnJS(onExpand)(); return; }
    y.value = withSpring(expanded ? insets.top : collapsed, spring);
  }).onFinalize((_e, success) => { if (!success && !closing.value) y.value = withSpring(expanded ? insets.top : collapsed, spring); });
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }], borderTopLeftRadius: Math.min(28, Math.max(0, y.value - insets.top)), borderTopRightRadius: Math.min(28, Math.max(0, y.value - insets.top)) }));
  const backdrop = useAnimatedStyle(() => ({ opacity: Math.max(0, Math.min(0.52, (height - y.value) / height * 0.65)) }));
  return <Modal visible={visible} transparent animationType="none" statusBarTranslucent onDismiss={onDismiss} onShow={onShow} onRequestClose={close}>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ImageViewerScope ref={viewer}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "black" }, backdrop]} />
        <Pressable accessibilityRole="button" accessibilityLabel="Close reminder details" onPress={close} style={StyleSheet.absoluteFill} />
        <Animated.View accessibilityViewIsModal style={[{ position: "absolute", top: 0, left: 0, right: 0, height: height - insets.top, overflow: "hidden", backgroundColor: palette.bg }, sheetStyle]}>
          <GestureDetector gesture={gesture}>
            <View accessible accessibilityRole="adjustable" accessibilityLabel="Reminder sheet. Swipe up to expand, swipe down to collapse or close" accessibilityActions={[{ name: "increment", label: "Expand details" }, { name: "decrement", label: expanded ? "Collapse details" : "Close" }]} onAccessibilityAction={e => e.nativeEvent.actionName === "increment" ? onExpand() : expanded ? onCollapse() : close()} style={{ height: 28, alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: palette.muted, opacity: 0.45 }} />
            </View>
          </GestureDetector>
          <PremiumScrollView onContentSizeChange={onContentLayout} style={{ maxHeight: expanded ? height - insets.top - 28 : height - collapsed - 28 }} contentContainerStyle={{ paddingBottom: Math.max(16, insets.bottom) }}>{children}</PremiumScrollView>
        </Animated.View>
      </ImageViewerScope>
    </GestureHandlerRootView>
  </Modal>;
});
