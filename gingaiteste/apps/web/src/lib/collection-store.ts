"use client";

import type { CentroidModel } from "@gingai/core";
import { getSupabaseBrowserClient } from "./supabase/client";
import { globalModelStore, modelStore, recordingsStore, type Recording } from "./stores";

const MAX_RECORDINGS = 200;

type RecordingRow = {
  id: string;
  client_id: string | null;
  label: string;
  duration_s: number;
  windows: unknown;
  created_at: string;
};

/** Rótulo canônico: slug em minúsculas (o servidor também normaliza). */
const normalizeLabel = (label: string) => label.trim().toLowerCase();

const rowToRecording = (r: RecordingRow): Recording => ({
  id: r.client_id ?? r.id,
  label: normalizeLabel(r.label),
  createdAt: new Date(r.created_at).getTime(),
  durationS: Number(r.duration_s),
  windows: (r.windows as Recording["windows"]) ?? [],
});

/**
 * Salva uma gravação de coleta. Sempre no localStorage (offline/sem login);
 * se logado, também persiste em `collection_recordings` (dedupe por client_id).
 * Retorna `{ synced }`: true se foi para o Supabase, false se só local.
 */
export async function saveRecording(rec: Recording): Promise<{ synced: boolean; error?: string }> {
  rec = { ...rec, label: normalizeLabel(rec.label) };
  recordingsStore.set((all) => [rec, ...all].slice(0, MAX_RECORDINGS));

  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { synced: false };

  const { error } = await supabase.from("collection_recordings").upsert(
    {
      user_id: user.id,
      client_id: rec.id,
      label: normalizeLabel(rec.label),
      duration_s: rec.durationS,
      windows: rec.windows as unknown as never,
    },
    { onConflict: "user_id,client_id" },
  );
  if (error) {
    console.warn("[GingAI] Falha ao salvar gravação no Supabase:", error.message);
    return { synced: false, error: error.message };
  }
  return { synced: true };
}

/**
 * Sincroniza o modo coleta com o Supabase (chamar ao abrir a página, se logado):
 * 1. Empurra gravações locais ainda não enviadas.
 * 2. Puxa todas as gravações do servidor e mescla no store local (por id).
 * 3. Se não houver modelo local, carrega o modelo ativo do servidor.
 */
export async function syncCollectionFromCloud(): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // 1. Envia as locais (upsert idempotente por client_id).
  const local = recordingsStore.get();
  if (local.length > 0) {
    const rows = local.map((rec) => ({
      user_id: user.id,
      client_id: rec.id,
      label: normalizeLabel(rec.label),
      duration_s: rec.durationS,
      windows: rec.windows as unknown as never,
    }));
    const { error } = await supabase
      .from("collection_recordings")
      .upsert(rows, { onConflict: "user_id,client_id" });
    if (error) console.warn("[GingAI] Falha ao enviar gravações locais:", error.message);
  }

  // 2. Puxa do servidor e mescla (servidor é a fonte da verdade quando logado).
  const { data, error } = await supabase
    .from("collection_recordings")
    .select("id, client_id, label, duration_s, windows, created_at")
    .order("created_at", { ascending: false })
    .limit(MAX_RECORDINGS);
  if (error) {
    console.warn("[GingAI] Falha ao carregar gravações:", error.message);
  } else if (data) {
    recordingsStore.set((data as RecordingRow[]).map(rowToRecording));
  }

  // 3. Modelo ativo do servidor, se ainda não houver um local.
  if (!modelStore.get()) {
    const { data: m } = await supabase
      .from("trained_models")
      .select("model")
      .eq("is_active", true)
      .maybeSingle();
    if (m?.model) modelStore.set(m.model as unknown as CentroidModel);
  }
}

/**
 * Baixa o modelo global (média de todas as pessoas, recalculado pelo servidor a cada nova
 * gravação) e guarda uma cópia local. Não exige login; falha em silêncio (usa a cópia local).
 */
export async function syncGlobalModel(): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("global_models").select("model").eq("id", 1).maybeSingle();
  if (error) {
    console.warn("[GingAI] Falha ao carregar o modelo global:", error.message);
    return;
  }
  globalModelStore.set((data?.model as unknown as CentroidModel | undefined) ?? null);
}

/**
 * Salva um modelo treinado. Sempre local; se logado, grava no Supabase como ativo
 * (desativando o anterior, pois há no máximo um ativo por usuário).
 */
export async function saveTrainedModel(model: CentroidModel): Promise<void> {
  modelStore.set(model);

  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Desativa o ativo atual antes de inserir o novo (índice único exige só 1 ativo).
  const { error: deErr } = await supabase
    .from("trained_models")
    .update({ is_active: false })
    .eq("user_id", user.id)
    .eq("is_active", true);
  if (deErr) {
    console.warn("[GingAI] Falha ao desativar modelo anterior:", deErr.message);
    return;
  }

  const { error } = await supabase
    .from("trained_models")
    .insert({ user_id: user.id, model: model as unknown as never, is_active: true });
  if (error) console.warn("[GingAI] Falha ao salvar modelo no Supabase:", error.message);
}

/** Volta ao modelo heurístico: limpa o local e desativa o ativo no servidor. */
export async function clearTrainedModel(): Promise<void> {
  modelStore.set(null);

  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("trained_models")
    .update({ is_active: false })
    .eq("user_id", user.id)
    .eq("is_active", true);
  if (error) console.warn("[GingAI] Falha ao desativar modelo:", error.message);
}

/** Apaga todas as gravações: local e, se logado, no servidor. */
export async function clearRecordings(): Promise<void> {
  recordingsStore.set([]);

  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from("collection_recordings").delete().eq("user_id", user.id);
  if (error) console.warn("[GingAI] Falha ao apagar gravações no Supabase:", error.message);
}
