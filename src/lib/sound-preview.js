// Native completion owns playback state. Tokens reject stale preparation,
// completion, and error events after rapid sound changes or stop/close.
export function createSoundPreview(adapter) {
  const listeners = new Set();
  const idle = { soundKey: null, session: null, status: "stopped", error: null };
  let state = idle;
  let serial = 0;
  let wantsPause = false;
  const publish = next => { if (Object.is(state, next)) return; state = next; listeners.forEach(listener => listener()); };
  const fail = (session, error) => {
    if (state.session === session) publish({ ...idle, status: "error", error: error.message || String(error) });
  };
  return {
    getSnapshot: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    receive(event) {
      if (event.session !== state.session) return;
      if (event.state === "ended" || event.state === "stopped") publish(idle);
      else if (event.state === "error") fail(event.session, new Error(event.message || "Cannot play this sound."));
      else if (["loading", "playing", "paused"].includes(event.state)) publish({ ...state, status: wantsPause ? "paused" : event.state });
    },
    async toggle(sound) {
      const key = sound.id || "default";
      if (state.soundKey === key && state.session) {
        const session = state.session;
        const pause = state.status !== "paused";
        wantsPause = pause;
        publish({ ...state, status: pause ? "paused" : "playing" });
        try { await (pause ? adapter.pause(session) : adapter.resume(session)); }
        catch (e) { fail(session, e); }
        return;
      }
      const session = `preview-${++serial}`;
      wantsPause = false;
      publish({ soundKey: key, session, status: "loading", error: null });
      try {
        await adapter.start(sound, session, () => state.session === session);
        // A pause may arrive while an imported file is being checked, before
        // the native player exists. Apply it once preparation has been queued.
        if (state.session === session && wantsPause) await adapter.pause(session);
      }
      catch (e) { fail(session, e); }
    },
    stop() { wantsPause = false; publish(idle); adapter.stop(); },
  };
}
