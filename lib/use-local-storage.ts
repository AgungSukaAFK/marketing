"use client";

import { useSyncExternalStore } from "react";

// Nilai localStorage sebagai external store: dibaca setelah hydrate (server &
// render hydrate memakai `undefined`), dan ikut berubah saat ditulis lewat
// writeLocalStorage atau dari tab lain (event "storage").
const EVENT = "local-storage-change";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENT, callback);
  };
}

function read(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** `undefined` = belum dibaca (server/hydrate), `null` = tidak tersimpan. */
export function useLocalStorage(key: string): string | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => read(key),
    () => undefined,
  );
}

export function writeLocalStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage tidak tersedia (mis. private mode) - cukup berlaku di sesi ini.
  }
  window.dispatchEvent(new Event(EVENT));
}

const noopSubscribe = () => () => {};

/** true setelah komponen berjalan di klien (pengganti pola useEffect + setMounted). */
export function useMounted() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
