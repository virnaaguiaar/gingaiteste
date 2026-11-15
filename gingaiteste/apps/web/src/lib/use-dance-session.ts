"use client";

import {
  CentroidClassifier,
  DanceSession,
  HEURISTIC_MODEL,
  mergeModels,
  type CentroidModel,
  type SessionSnapshot,
  type SessionSummary,
  type WindowResult,
} from "@gingai/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { keepScreenOn, requestMotionPermission, startWebMotion } from "./motion";
import { syncGlobalModel } from "./collection-store";
import { globalModelStore, modelStore } from "./stores";

function buildClassifier(personal: CentroidModel | null, global: CentroidModel | null) {
  try {
    return new CentroidClassifier(mergeModels(HEURISTIC_MODEL, global, personal));
  } catch {
    // Modelo salvo incompatível (ex.: características mudaram): volta ao heurístico.
    return new CentroidClassifier(HEURISTIC_MODEL);
  }
}

export type SessionStatus = "idle" | "starting" | "running" | "ended" | "error";

export interface UseDanceSessionOptions {
  onWindow?: (result: WindowResult) => void;
  /** Chamado a cada atualização da tela (~4x por segundo). */
  onTick?: (snapshot: SessionSnapshot) => void;
}

/** Sem leituras em 2,5 s depois de começar = aparelho sem sensor (ou bloqueado). */
const NO_DATA_TIMEOUT_MS = 2500;

export function useDanceSession(options: UseDanceSessionOptions = {}) {
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<DanceSession | null>(null);
  const cleanupRef = useRef<(() => void)[]>([]);
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const teardown = useCallback(() => {
    cleanupRef.current.forEach((fn) => fn());
    cleanupRef.current = [];
  }, []);

  useEffect(() => teardown, [teardown]);

  const start = useCallback(
    async () => {
      teardown();
      setError(null);
      setSummary(null);
      setStatus("starting");

      // No iOS a permissão precisa ser pedida antes de qualquer outro await.
      const permission = await requestMotionPermission();
      if (permission !== "granted") {
        setStatus("error");
        setError(
          {
            denied: "Permissão dos sensores negada. No iPhone: Ajustes › Safari › Movimento e Orientação.",
            unsupported: "Este navegador não tem sensores de movimento. Abra pelo celular.",
            insecure: "Os sensores só funcionam em HTTPS. Abra o site pelo endereço https://.",
          }[permission],
        );
        return;
      }

      // Por estilo: o que a pessoa gravou > média de todos (modelo global) > heurístico.
      // Atualiza o modelo global, esperando no máximo 1,5 s (senão usa a cópia local).
      await Promise.race([syncGlobalModel(), new Promise((r) => setTimeout(r, 1500))]);
      const classifier = buildClassifier(modelStore.get(), globalModelStore.get());
      const session = new DanceSession({ classifier });
      sessionRef.current = session;
      let gotData = false;

      const onSample = (s: Parameters<DanceSession["push"]>[0]) => {
        gotData = true;
        const result = session.push(s);
        if (result) optionsRef.current.onWindow?.(result);
      };
      cleanupRef.current.push(startWebMotion(onSample), keepScreenOn());

      const tick = setInterval(() => {
        const snap = session.snapshot();
        setSnapshot(snap);
        optionsRef.current.onTick?.(snap);
      }, 250);
      cleanupRef.current.push(() => clearInterval(tick));

      const watchdog = setTimeout(() => {
        if (gotData) return;
        teardown();
        setStatus("error");
        setError("Nenhuma leitura do sensor chegou. Abra pelo celular, com acelerômetro.");
      }, NO_DATA_TIMEOUT_MS);
      cleanupRef.current.push(() => clearTimeout(watchdog));

      setSnapshot(session.snapshot());
      setStatus("running");
    },
    [teardown],
  );

  const stop = useCallback((): SessionSummary | null => {
    teardown();
    const session = sessionRef.current;
    sessionRef.current = null;
    if (!session) return null;
    const result = session.summary();
    setSummary(result);
    setSnapshot(result);
    setStatus("ended");
    return result;
  }, [teardown]);

  const reset = useCallback(() => {
    teardown();
    sessionRef.current = null;
    setStatus("idle");
    setSnapshot(null);
    setSummary(null);
    setError(null);
  }, [teardown]);

  return { status, snapshot, summary, error, start, stop, reset };
}
