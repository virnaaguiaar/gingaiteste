"use client";

import type { DanceEvent, ParticipantScore } from "@gingai/core";
import { useEffect, useState } from "react";
import { eventStore } from "./event-store";

/** `undefined` = carregando, `null` = não existe neste aparelho. */
export function useEvent(code: string) {
  const [event, setEvent] = useState<DanceEvent | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void eventStore.getEvent(code).then((e) => alive && setEvent(e));
    return () => {
      alive = false;
    };
  }, [code]);
  return event;
}

export function useRanking(code: string) {
  const [ranking, setRanking] = useState<ParticipantScore[]>([]);
  useEffect(() => eventStore.subscribeScores(code, setRanking), [code]);
  return ranking;
}
