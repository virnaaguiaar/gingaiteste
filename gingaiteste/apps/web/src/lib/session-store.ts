"use client";

import type { SessionSummary } from "@gingai/core";
import { getSupabaseBrowserClient } from "./supabase/client";
import { historyStore } from "./stores";

const MAX_HISTORY = 100;

/**
 * Salva uma sessão de dança solo. Sempre guarda no histórico local (funciona offline
 * e sem login); se o usuário estiver logado, também persiste em `sessions` no Supabase.
 */
export async function saveSession(summary: SessionSummary): Promise<void> {
  if (summary.points <= 0) return; // sessão vazia não polui o histórico

  historyStore.set((h) => [summary, ...h].slice(0, MAX_HISTORY));

  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from("sessions").insert({
    user_id: user.id,
    points: summary.points,
    dance_seconds: summary.danceSeconds,
    top_style: summary.topStyle,
    style_seconds: summary.styleSeconds,
    max_combo: summary.maxComboMultiplier,
    started_at: new Date(summary.startedAt).toISOString(),
    ended_at: new Date(summary.endedAt).toISOString(),
  });
  if (error) console.warn("[GingAI] Falha ao salvar sessão no Supabase:", error.message);
}
