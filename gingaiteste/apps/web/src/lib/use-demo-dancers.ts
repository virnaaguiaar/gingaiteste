"use client";

import {
  DANCE_STYLES,
  DanceSession,
  SYNTHETIC_PROFILES,
  createSyntheticSource,
  topStyleOf,
  type MotionSample,
} from "@gingai/core";
import { useEffect } from "react";
import { eventStore } from "./event-store";

const NAMES = [
  "Rainha do Xote",
  "Zé do Passinho",
  "Bia Swing",
  "Mestre Gingado",
  "Lu Rebolado",
  "Tico Sanfona",
  "Duda Batidão",
  "Nina Pé-de-Valsa",
];

export const DEMO_ID_PREFIX = "demo-";

interface Bot {
  id: string;
  nickname: string;
  session: DanceSession;
  source: (t: number) => MotionSample;
  t: number;
  /** Até quando o bot mantém o movimento atual (troca entre dançar e descansar). */
  switchAt: number;
}

function pickLabel(rand: number): keyof typeof SYNTHETIC_PROFILES {
  // ~80% do tempo dançando, 20% descansando.
  return rand < 0.2 ? "parado" : DANCE_STYLES[Math.floor(rand * 10) % DANCE_STYLES.length]!;
}

/**
 * Dançarinos simulados para demonstrar o telão sem ninguém dançando.
 * Cada bot roda o MESMO pipeline real (DanceSession) alimentado por movimento sintético.
 */
export function useDemoDancers(code: string, enabled: boolean, count = 6) {
  useEffect(() => {
    if (!enabled) return;
    const step = 1000 / 50;
    const now = performance.now();
    const bots: Bot[] = NAMES.slice(0, count).map((nickname, i) => ({
      id: `${DEMO_ID_PREFIX}${i}`,
      nickname,
      session: new DanceSession(),
      source: createSyntheticSource(SYNTHETIC_PROFILES[pickLabel(Math.random())], i * 7919 + 1),
      t: now,
      switchAt: now + 10_000 + Math.random() * 30_000,
    }));

    const id = setInterval(() => {
      const until = performance.now();
      for (const bot of bots) {
        if (until > bot.switchAt) {
          bot.source = createSyntheticSource(
            SYNTHETIC_PROFILES[pickLabel(Math.random())],
            Math.floor(Math.random() * 1e9),
          );
          bot.switchAt = until + 10_000 + Math.random() * 30_000;
        }
        while (bot.t < until) {
          bot.session.push(bot.source(bot.t));
          bot.t += step;
        }
        const snap = bot.session.snapshot();
        void eventStore.publishScore(code, {
          id: bot.id,
          nickname: bot.nickname,
          points: snap.points,
          danceSeconds: snap.danceSeconds,
          topStyle: topStyleOf(snap.styleSeconds),
          currentStyle: snap.style,
          updatedAt: Date.now(),
          simulated: true,
        });
      }
    }, 1000);

    return () => {
      clearInterval(id);
      void eventStore.removeScores(
        code,
        bots.map((b) => b.id),
      );
    };
  }, [code, enabled, count]);
}
