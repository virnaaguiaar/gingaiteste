"use client";

import { useSyncExternalStore } from "react";

type Listener = () => void;

/**
 * Estado persistido no localStorage, sincronizado entre componentes e entre abas.
 * `fallback` precisa ser uma referência estável (constante de módulo).
 */
export function createLocalStore<T>(key: string, fallback: T) {
  const listeners = new Set<Listener>();
  let cache: { raw: string | null; value: T } | null = null;

  const get = (): T => {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(key);
    if (cache && cache.raw === raw) return cache.value;
    let value = fallback;
    try {
      if (raw) value = JSON.parse(raw) as T;
    } catch {
      // JSON corrompido: volta ao padrão.
    }
    cache = { raw, value };
    return value;
  };

  const set = (next: T | ((prev: T) => T)) => {
    const value = typeof next === "function" ? (next as (prev: T) => T)(get()) : next;
    try {
      if (value === null || value === undefined) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn(`[GingAI] Não foi possível salvar "${key}" (armazenamento cheio?)`, err);
    }
    listeners.forEach((l) => l());
  };

  const subscribe = (listener: Listener) => {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  };

  // Função nomeada dentro do closure: o React Compiler 1.0 içava a arrow inline
  // `() => fallback` para fora do closure ("fallback is not defined" no navegador).
  const getServerSnapshot = (): T => fallback;
  const useValue = (): T => useSyncExternalStore(subscribe, get, getServerSnapshot);

  return { get, set, subscribe, useValue };
}
