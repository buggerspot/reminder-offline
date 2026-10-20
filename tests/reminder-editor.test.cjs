const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { transformSync } = require("@babel/core");

// Exercise the editor's event handlers and layout with a small hook host;
// native keyboard presentation still requires a device smoke test.
const source = fs.readFileSync(require.resolve("../src/reminder-editor.jsx"), "utf8");
const code = transformSync(source.slice(source.indexOf("function ManualDateTimeField"), source.indexOf("export const ReminderEditor")), {
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
    Platform: { OS: "android" }, NativeModules: {},
  };
  for (const name of ["Pressable", "View", "Field", "Modal", "KeyboardAvoidingView", "SafeAreaView", "ScrollView", "Label", "Btn", "Text", "X", "Check", "Chip", "ZoomableImage", "Trash2"]) scope[name] = name;
  vm.createContext(scope);
  vm.runInContext(code, scope);
  return {
    scope, timers,
    render(name, props) { cursor = 0; refCursor = 0; effects.length = 0; return scope[name](props); },
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

test("manual entry focuses after presentation, retries, and cancels retries when keyboard opens", () => {
  const h = host();
  const props = { label: "TIME", value: "09:30" };
  nodes(h.render("ManualDateTimeField", props), "Pressable")[0].props.onPress();
  const tree = h.render("ManualDateTimeField", props);
  h.effects();
  const input = nodes(tree, "Field").find(node => node.props.inputProps.ref).props.inputProps.ref;
  let focused = false, focusCalls = 0;
  input.current = { isFocused: () => focused, blur: () => { focused = false; }, focus: () => { focused = true; focusCalls++; } };
  nodes(tree, "Modal")[0].props.onShow();
  assert.equal(focusCalls, 0);
  h.runNextTimer();
  h.runNextTimer();
  assert.equal(focusCalls, 2);
  h.showKeyboard();
  assert.equal(h.timers.size, 0);
});

test("closing manual entry cancels pending focus and reopening starts a fresh focus request", () => {
  const h = host();
  const props = { label: "DATE", value: "2026-12-24" };
  nodes(h.render("ManualDateTimeField", props), "Pressable")[0].props.onPress();
  let tree = h.render("ManualDateTimeField", props);
  nodes(tree, "Modal")[0].props.onShow();
  nodes(tree, "Btn")[0].props.onPress();
  assert.equal(h.timers.size, 0);
  tree = h.render("ManualDateTimeField", props);
  assert.equal(nodes(tree, "Field").length, 1);
  nodes(tree, "Pressable")[0].props.onPress();
  tree = h.render("ManualDateTimeField", props);
  nodes(tree, "Modal")[0].props.onShow();
  assert.equal(h.timers.size, 3);
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
