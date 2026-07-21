/* INBESTIGA Marketing Cloud v17.15.2 · Interaction Integrity bootstrap */
(function () {
  "use strict";
  if (window.__IB_INTERACTION_REGISTRY) return;

  const VERSION = "v17.15.2";
  const LISTENER_LIMIT = 24;
  const ERROR_LIMIT = 80;
  const CHANGE_LIMIT = 120;
  const STORAGE_KEY = "inbestiga:v17152:local-change-history";
  const RUNTIME_KEY = "inbestiga:v17152:runtime-errors";
  const listenerMap = new WeakMap();
  const runtimeErrors = [];
  const localChanges = [];
  let internalStorageWrite = false;

  const originalAddEventListener = EventTarget.prototype.addEventListener;
  const originalRemoveEventListener = EventTarget.prototype.removeEventListener;
  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;
  const originalClear = Storage.prototype.clear;

  function now() { return new Date().toISOString(); }
  function safeString(value, limit = 500) {
    return String(value ?? "")
      .replace(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/g, "[token oculto]")
      .replace(/(apikey|authorization|service_role|anon(?:ymous)?_?key|password|secret|token)\s*[:=]\s*[^\s,;]+/gi, "$1=[oculto]")
      .slice(0, limit);
  }
  function readArray(key) {
    try {
      const parsed = JSON.parse(originalSetItem ? localStorage.getItem(key) || "[]" : "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }
  function persistArray(key, value, limit) {
    try {
      internalStorageWrite = true;
      originalSetItem.call(localStorage, key, JSON.stringify(value.slice(-limit)));
    } catch { /* almacenamiento opcional */ }
    finally { internalStorageWrite = false; }
  }
  function pushRuntime(entry) {
    const item = { id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, at: now(), ...entry };
    runtimeErrors.push(item);
    while (runtimeErrors.length > ERROR_LIMIT) runtimeErrors.shift();
    persistArray(RUNTIME_KEY, runtimeErrors, ERROR_LIMIT);
    try { window.dispatchEvent(new CustomEvent("inbestiga:integrity-runtime-error", { detail: item })); } catch { /* opcional */ }
  }
  function listenerBucket(target) {
    let bucket = listenerMap.get(target);
    if (!bucket) { bucket = new Map(); listenerMap.set(target, bucket); }
    return bucket;
  }
  function describeListener(listener) {
    if (typeof listener === "function") return safeString(listener.name || "función anónima", 80);
    if (listener && typeof listener.handleEvent === "function") return safeString(listener.constructor?.name || "handleEvent", 80);
    return "listener";
  }

  EventTarget.prototype.addEventListener = function (type, listener, options) {
    try {
      if (listener) {
        const bucket = listenerBucket(this);
        const entries = bucket.get(type) || [];
        if (entries.length < LISTENER_LIMIT) entries.push({ listener, label: describeListener(listener), options, addedAt: now() });
        bucket.set(type, entries);
      }
    } catch { /* nunca bloquear el listener real */ }
    return originalAddEventListener.call(this, type, listener, options);
  };
  EventTarget.prototype.removeEventListener = function (type, listener, options) {
    try {
      const bucket = listenerMap.get(this);
      const entries = bucket?.get(type) || [];
      if (entries.length) bucket.set(type, entries.filter((item) => item.listener !== listener));
    } catch { /* nunca bloquear */ }
    return originalRemoveEventListener.call(this, type, listener, options);
  };

  function reversibleKey(key) {
    const text = String(key || "").toLowerCase();
    if (!text || /auth|session|token|secret|password|supabase|anon|credential|apikey|bridge.*code/.test(text)) return false;
    if (!/inbestiga|sakura|ibm/.test(text)) return false;
    return /pref|setting|theme|design|studio|layout|nav|home|mode|density|background|visual|appearance|quality|diagnostic|motion|contrast|workspace/.test(text);
  }
  function recordStorageChange(storage, operation, key, previousValue, nextValue) {
    if (internalStorageWrite || storage !== localStorage || !reversibleKey(key)) return;
    const previous = previousValue == null ? null : String(previousValue);
    const next = nextValue == null ? null : String(nextValue);
    if ((previous?.length || 0) > 180000 || (next?.length || 0) > 180000 || previous === next) return;
    const item = {
      id: `chg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      at: now(), operation, key: safeString(key, 180), previous, next,
      reversible: true, undone: false
    };
    localChanges.push(item);
    while (localChanges.length > CHANGE_LIMIT) localChanges.shift();
    persistArray(STORAGE_KEY, localChanges, CHANGE_LIMIT);
    try { window.dispatchEvent(new CustomEvent("inbestiga:integrity-local-change", { detail: { ...item, previous: undefined, next: undefined } })); } catch { /* opcional */ }
  }
  Storage.prototype.setItem = function (key, value) {
    const previous = this === localStorage ? this.getItem(key) : null;
    const result = originalSetItem.call(this, key, value);
    try { recordStorageChange(this, "set", key, previous, value); } catch { /* no bloquear */ }
    return result;
  };
  Storage.prototype.removeItem = function (key) {
    const previous = this === localStorage ? this.getItem(key) : null;
    const result = originalRemoveItem.call(this, key);
    try { recordStorageChange(this, "remove", key, previous, null); } catch { /* no bloquear */ }
    return result;
  };
  Storage.prototype.clear = function () {
    const result = originalClear.call(this);
    try { pushRuntime({ type: "storage", severity: "info", message: "Se limpió un almacenamiento del navegador.", source: "Storage.clear" }); } catch { /* opcional */ }
    return result;
  };

  runtimeErrors.push(...readArray(RUNTIME_KEY).slice(-ERROR_LIMIT));
  localChanges.push(...readArray(STORAGE_KEY).slice(-CHANGE_LIMIT));

  window.addEventListener("error", (event) => {
    const resource = event.target && event.target !== window ? (event.target.src || event.target.href || "") : "";
    pushRuntime({
      type: resource ? "resource" : "error", severity: resource ? "warn" : "fail",
      message: safeString(resource ? `No se pudo cargar el recurso: ${resource}` : (event.message || event.error?.message || "Error del navegador")),
      source: safeString(resource || event.filename || "runtime", 260), line: Number(event.lineno) || 0, column: Number(event.colno) || 0
    });
  }, true);
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    pushRuntime({ type: "promise", severity: "fail", message: safeString(reason?.message || reason || "Promesa rechazada"), source: safeString(reason?.stack || "promise", 320) });
  }, true);
  document.addEventListener("securitypolicyviolation", (event) => {
    pushRuntime({ type: "csp", severity: "warn", message: safeString(`${event.violatedDirective}: ${event.blockedURI}`), source: "Content-Security-Policy" });
  }, true);

  window.__IB_INTERACTION_REGISTRY = Object.freeze({
    version: VERSION,
    listeners(target, type) {
      const bucket = listenerMap.get(target);
      if (!bucket) return type ? [] : {};
      if (type) return [...(bucket.get(type) || [])].map(({ label, addedAt }) => ({ label, addedAt }));
      return Object.fromEntries([...bucket.entries()].map(([name, values]) => [name, values.map(({ label, addedAt }) => ({ label, addedAt }))]));
    },
    has(target, types = []) {
      const bucket = listenerMap.get(target);
      return !!bucket && types.some((type) => (bucket.get(type) || []).length > 0);
    },
    runtimeErrors: () => runtimeErrors.map((item) => ({ ...item })),
    localChanges: () => localChanges.map((item) => ({ ...item })),
    undo(id) {
      const item = localChanges.find((entry) => entry.id === id);
      if (!item || item.undone || !item.reversible) return { ok: false, reason: "Cambio no disponible" };
      try {
        internalStorageWrite = true;
        if (item.previous == null) originalRemoveItem.call(localStorage, item.key);
        else originalSetItem.call(localStorage, item.key, item.previous);
        item.undone = true; item.undoneAt = now();
        persistArray(STORAGE_KEY, localChanges, CHANGE_LIMIT);
        return { ok: true, key: item.key };
      } catch (error) { return { ok: false, reason: safeString(error?.message || error) }; }
      finally { internalStorageWrite = false; }
    },
    clearRuntimeErrors() { runtimeErrors.length = 0; persistArray(RUNTIME_KEY, [], ERROR_LIMIT); },
    clearLocalChanges() { localChanges.length = 0; persistArray(STORAGE_KEY, [], CHANGE_LIMIT); },
    originals: Object.freeze({ setItem: originalSetItem, removeItem: originalRemoveItem }),
    safeString
  });
})();
