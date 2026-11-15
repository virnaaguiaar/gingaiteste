"use client";

import type { CentroidModel, SessionSummary, WindowFeatures } from "@gingai/core";
import { createLocalStore } from "./local-store";

export interface Profile {
  id: string;
  nickname: string;
}

export interface Recording {
  id: string;
  /** Rótulo do movimento: um MotionLabel padrão ou um nome de estilo customizado. */
  label: string;
  createdAt: number;
  durationS: number;
  windows: { features: WindowFeatures; dancing: boolean }[];
}

const EMPTY_HISTORY: SessionSummary[] = [];
const EMPTY_RECORDINGS: Recording[] = [];

/** Sessões de dança solo deste aparelho (mais recentes primeiro). */
export const historyStore = createLocalStore<SessionSummary[]>("gingai:history", EMPTY_HISTORY);
export const profileStore = createLocalStore<Profile | null>("gingai:profile", null);
/** Modelo treinado no modo de coleta; null = modelo heurístico padrão. */
export const modelStore = createLocalStore<CentroidModel | null>("gingai:model", null);
/** Cópia local do modelo global (média de todos), para funcionar offline. */
export const globalModelStore = createLocalStore<CentroidModel | null>("gingai:global-model", null);
export const recordingsStore = createLocalStore<Recording[]>("gingai:recordings", EMPTY_RECORDINGS);

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
