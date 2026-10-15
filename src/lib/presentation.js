function observable(initial) {
  let value = initial;
  const listeners = new Set();
  return {
    getSnapshot: () => value,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    publish(next) { if (Object.is(next, value)) return; value = next; listeners.forEach(listener => listener()); },
  };
}

// Navigation commands precede React updates. Only the pager and tab bar subscribe.
export function createTabNavigation(names) {
  const state = observable(names[0]);
  let command;
  let pending = null;
  return {
    ...state,
    bind(next) { command = next; return () => { if (command === next) command = null; }; },
    navigate(name) {
      const index = names.indexOf(name);
      if (index < 0 || name === state.getSnapshot()) return;
      pending = index;
      command?.(index);
      state.publish(name);
    },
    beginSwipe() { pending = null; },
    selected(index) {
      if (!names[index] || (pending !== null && pending !== index)) return;
      pending = null;
      state.publish(names[index]);
    },
  };
}

// One presentation can be opening/open/closing at a time; no timeout debounce.
export function createReminderPresentation() {
  const state = observable(null);
  let phase = "closed";
  return {
    ...state,
    open(item) {
      if (!item || phase !== "closed") return false;
      phase = "opening";
      state.publish(item);
      return true;
    },
    set(value) {
      const next = typeof value === "function" ? value(state.getSnapshot()) : value;
      if (next === null) { phase = "closed"; state.publish(null); }
      else if (phase === "closed") this.open(next);
      else if (phase !== "closing") state.publish(next);
    },
    shown() { if (phase === "opening") phase = "open"; },
    beginClose() {
      if (phase === "closed" || phase === "closing") return false;
      phase = "closing";
      return true;
    },
    finishClose() { phase = "closed"; state.publish(null); },
  };
}

// Native visibility and content layout may arrive in either order. Neither may
// restart an animation that has already begun for this presentation.
export function createSheetOpening() {
  let visible = false, measured = false, started = false;
  const ready = () => {
    if (!visible || !measured || started) return false;
    started = true;
    return true;
  };
  return {
    reset() { visible = false; measured = false; started = false; },
    shown() { visible = true; return ready(); },
    measured() { measured = true; return ready(); },
  };
}
