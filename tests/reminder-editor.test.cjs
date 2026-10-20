const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { transformSync } = require("@babel/core");

// Exercise the editor's event handlers and layout with a small hook host;
// native picker presentation still requires a device smoke test.
const source = fs.readFileSync(require.resolve("../src/reminder-editor.jsx"), "utf8");
const code = transformSync(source.slice(source.indexOf("function VisualPickerField"), source.indexOf("export const ReminderEditor")), {
  configFile: false, babelrc: false,
  plugins: ["@babel/plugin-transform-react-jsx"],
}).code;

function host() {
  const state = [], refs = [], effects = [], timers = new Map(), listeners = new Map();
  let cursor = 0, refCursor = 0, timerId = 0, keyboardVisible = false;
  const scope = {
    React: { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }), Fragment: "Fragment" },
    useContext: () => ({}), PaletteContext: {},
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
    },
    useRef(initial) { return refs[refCursor++] ||= { current: initial }; },
    useEffect: effect => { effects.push(effect); },
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: id => timers.delete(id),
    Keyboard: {
      isVisible: () => keyboardVisible,
      dismiss: () => { keyboardVisible = false; },
      addListener: (event, callback) => { listeners.set(event, callback); return { remove: () => listeners.delete(event) }; },
    },
    validDate: value => /^\d{4}-\d{2}-\d{2}$/.test(value),
    REPEAT_OPTIONS: [{ value: "daily", label: "Daily" }],
    Platform: { OS: "android" }, NativeModules: {},
  };
  for (const name of ["CalendarDays", "ChevronRight", "Clock", "Repeat", "ReminderValuePicker", "Pressable", "View", "Field", "Modal", "KeyboardAvoidingView", "SafeAreaView", "ScrollView", "Label", "Btn", "Text", "X", "Check", "Chip", "ZoomableImage", "Trash2"]) scope[name] = name;
  vm.createContext(scope);
  vm.runInContext(code, scope);
  return {
    scope, timers,
    render(name, props) { cursor = 0; refCursor = 0; effects.length = 0; return scope[name]({ todayISO: () => "2026-10-20", timeNow: () => "09:30", ...props }); },
    effects() { return effects.map(effect => effect()).filter(Boolean); },
    runNextTimer() { const [id, callback] = timers.entries().next().value; timers.delete(id); callback(); },
    showKeyboard() { keyboardVisible = true; listeners.get("keyboardDidShow")?.(); },
  };
}
function nodes(tree, type) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, type));
  return [...(tree.type === type ? [tree] : []), ...nodes(tree.props?.children, type)];
}

for (const kind of ["date", "time"]) test(`${kind} field opens the existing native picker and preserves cancellation`, async () => {
  const h = host();
  h.scope.validDate = value => value === "2099-12-24";
  let initial, selected;
  const value = kind === "date" ? "2099-12-24" : "09:30";
  h.scope.NativeModules.ReminderNative = {
    [kind === "date" ? "chooseDate" : "chooseTime"]: async next => { initial = next; return value; },
  };
  const props = { label: kind, kind, value, onChangeText: next => { selected = next; } };
  let tree = h.render("VisualPickerField", props);
  assert.equal(nodes(tree, "Field").length, 0);
  await nodes(tree, "Pressable")[0].props.onPress();
  assert.equal(initial, value);
  assert.equal(selected, value);
  selected = undefined;
  h.scope.NativeModules.ReminderNative[kind === "date" ? "chooseDate" : "chooseTime"] = async () => null;
  tree = h.render("VisualPickerField", props);
  await nodes(tree, "Pressable")[0].props.onPress();
  assert.equal(selected, undefined);
});

test("repeat opens visual options and optional end date can be cleared", () => {
  const h = host();
  const props = { label: "Repeat", kind: "repeat", value: "daily" };
  nodes(h.render("VisualPickerField", props), "Pressable")[0].props.onPress();
  const tree = h.render("VisualPickerField", props);
  assert.equal(nodes(tree, "ReminderValuePicker")[0].props.visualOnly, true);
  let selected;
  const end = h.render("VisualPickerField", { label: "Until date", kind: "date", optional: true, value: "2099-12-24", onChangeText: next => { selected = next; } });
  nodes(end, "Pressable").find(node => node.props.accessibilityLabel === "Clear repeat end date").props.onPress();
  assert.equal(selected, "");
});

for (const editing of [null, { id: "existing" }]) test(`save stays outside scrolling content and reserves its measured height (${editing ? "edit" : "create"})`, () => {
  const h = host();
  const props = { initial: { editing, form: { repeat: "monthly", title: "Test", monthDay: 20 } } };
  let tree = h.render("ReminderDraft", props);
  const scroll = nodes(tree, "ScrollView")[0];
  assert.equal(nodes(scroll, "Btn").some(node => node.props.title?.startsWith("Save")), false);
  const footer = nodes(tree, "View").find(node => node.props.style?.position === "absolute");
  assert.equal(nodes(footer, "Btn")[0].props.title, editing ? "Save changes" : "Save reminder");
  footer.props.onLayout({ nativeEvent: { layout: { height: 120 } } });
  tree = h.render("ReminderDraft", props);
  assert.equal(nodes(tree, "ScrollView")[0].props.contentContainerStyle.paddingBottom, 140);
});

for (const editing of [null, { id: "existing" }]) test(`sticky save preserves reminder data and edit identity (${editing ? "edit" : "create"})`, async () => {
  const h = host();
  h.scope.validDate = () => true;
  const form = { title: "Test reminder", date: "2099-12-24", time: "09:30", repeat: "none", description: "Keep this note" };
  let saved, closed = false;
  const tree = h.render("ReminderDraft", {
    initial: { editing, form }, todayISO: () => "2026-10-20",
    Alert: { alert: () => assert.fail("Valid reminder should not show a validation alert") },
    onSave: async (value, identity) => { saved = { value, identity }; },
    onClose: () => { closed = true; },
  });
  const save = nodes(tree, "Btn").find(node => node.props.title?.startsWith("Save"));
  await save.props.onPress();
  assert.equal(saved.value, form);
  assert.equal(saved.identity, editing);
  assert.equal(closed, true);
});

for (const editing of [null, { id: "existing" }]) test(`form wires date, time and end date to visual editors (${editing ? "edit" : "create"})`, () => {
  const h = host();
  const form = { title: "Test", date: "2099-12-24", time: "09:30", repeat: "yearly", repeatUntil: "2099-12-31" };
  h.scope.validDate = () => true;
  const tree = h.render("ReminderDraft", { initial: { editing, form }, todayISO: () => "2026-10-20", timeNow: () => "10:00" });
  const fields = nodes(tree, h.scope.VisualPickerField);
  assert.deepEqual(fields.map(node => node.props.kind), ["date", "time", "repeat", "date"]);
  for (const field of fields) {
    const next = field.props.kind === "repeat" ? "daily" : field.props.kind === "time" ? "10:45" : "2099-12-30";
    field.props.onChangeText(next);
    const updated = h.render("ReminderDraft", { initial: { editing, form }, todayISO: () => "2026-10-20", timeNow: () => "10:00" });
    const matching = nodes(updated, h.scope.VisualPickerField).find(node => node.props.label === field.props.label);
    assert.equal(matching.props.value, next);
  }
});
