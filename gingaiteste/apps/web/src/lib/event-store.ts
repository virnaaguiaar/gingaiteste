"use client";

import {
  generateEventCode,
  rankParticipants,
  type DanceEvent,
  type DanceStyle,
  type EventVisibility,
  type ParticipantScore,
} from "@gingai/core";
import { getSupabaseBrowserClient } from "./supabase/client";
import type { Database } from "./supabase/types";

/**
 * Contrato do armazenamento de eventos e placares.
 * Implementação Supabase: eventos e placares no Postgres, ranking ao vivo via Realtime,
 * sincronizando entre dispositivos diferentes. As telas usam só esta interface.
 */
export interface EventStore {
  createEvent(input: {
    name: string;
    style?: DanceStyle;
    visibility?: EventVisibility;
  }): Promise<DanceEvent>;
  getEvent(code: string): Promise<DanceEvent | null>;
  /** Festas públicas, da mais nova para a mais antiga (para a listagem da home). */
  listPublicEvents(limit?: number): Promise<DanceEvent[]>;
  /** Festas do usuário logado (dono), da mais nova para a mais antiga. */
  listMyEvents(): Promise<DanceEvent[]>;
  /** Edita nome/estilo/visibilidade de uma festa (só o dono ou admin, via RLS). */
  updateEvent(
    code: string,
    patch: { name?: string; style?: DanceStyle | null; visibility?: EventVisibility },
  ): Promise<DanceEvent>;
  /** Remove uma festa e seus placares (só o dono ou admin, via RLS). */
  deleteEvent(code: string): Promise<void>;
  publishScore(code: string, score: ParticipantScore): Promise<void>;
  removeScores(code: string, ids: readonly string[]): Promise<void>;
  /** Chama `onChange` logo de início e a cada mudança. Devolve a função para cancelar. */
  subscribeScores(code: string, onChange: (ranked: ParticipantScore[]) => void): () => void;
}

type ScoreRow = Database["public"]["Tables"]["participant_scores"]["Row"];
type EventRow = Database["public"]["Tables"]["events"]["Row"];

const rowToScore = (r: ScoreRow): ParticipantScore => ({
  id: r.participant_id,
  nickname: r.nickname,
  points: Number(r.points),
  danceSeconds: Number(r.dance_seconds),
  topStyle: r.top_style,
  currentStyle: r.current_style,
  updatedAt: new Date(r.updated_at).getTime(),
  avatarUrl: r.avatar_url ?? undefined,
  simulated: r.simulated || undefined,
});

const rowToEvent = (r: EventRow): DanceEvent => ({
  code: r.code,
  name: r.name,
  style: r.style ?? undefined,
  visibility: r.visibility,
  ownerId: r.owner_id ?? undefined,
  createdAt: new Date(r.created_at).getTime(),
});

class SupabaseEventStore implements EventStore {
  private readonly supabase = getSupabaseBrowserClient();

  async createEvent(input: {
    name: string;
    style?: DanceStyle;
    visibility?: EventVisibility;
  }): Promise<DanceEvent> {
    const { data: auth } = await this.supabase.auth.getUser();
    const ownerId = auth.user?.id ?? null;

    // Tenta até achar um código livre (colisão é raríssima).
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateEventCode();
      const { data, error } = await this.supabase
        .from("events")
        .insert({
          code,
          name: input.name,
          style: input.style ?? null,
          visibility: input.visibility ?? "public",
          owner_id: ownerId,
        })
        .select()
        .single();
      if (!error && data) return rowToEvent(data);
      // 23505 = unique_violation (código repetido): tenta outro.
      if (error && error.code !== "23505") throw error;
    }
    throw new Error("Não foi possível gerar um código de festa único.");
  }

  async getEvent(code: string): Promise<DanceEvent | null> {
    const { data, error } = await this.supabase
      .from("events")
      .select()
      .eq("code", code)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToEvent(data) : null;
  }

  async listPublicEvents(limit = 50): Promise<DanceEvent[]> {
    const { data, error } = await this.supabase
      .from("events")
      .select()
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(rowToEvent);
  }

  async listMyEvents(): Promise<DanceEvent[]> {
    const { data: auth } = await this.supabase.auth.getUser();
    if (!auth.user) return [];
    const { data, error } = await this.supabase
      .from("events")
      .select()
      .eq("owner_id", auth.user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(rowToEvent);
  }

  async updateEvent(
    code: string,
    patch: { name?: string; style?: DanceStyle | null; visibility?: EventVisibility },
  ): Promise<DanceEvent> {
    const update: Database["public"]["Tables"]["events"]["Update"] = {};
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.style !== undefined) update.style = patch.style;
    if (patch.visibility !== undefined) update.visibility = patch.visibility;

    const { data, error } = await this.supabase
      .from("events")
      .update(update)
      .eq("code", code)
      .select()
      .single();
    if (error) throw error;
    return rowToEvent(data);
  }

  async deleteEvent(code: string): Promise<void> {
    // participant_scores tem ON DELETE CASCADE, então os placares somem junto.
    const { error } = await this.supabase.from("events").delete().eq("code", code);
    if (error) throw error;
  }

  async publishScore(code: string, score: ParticipantScore): Promise<void> {
    const { data: auth } = await this.supabase.auth.getUser();
    const { error } = await this.supabase.from("participant_scores").upsert(
      {
        event_code: code,
        participant_id: score.id,
        nickname: score.nickname,
        points: score.points,
        dance_seconds: score.danceSeconds,
        top_style: score.topStyle,
        current_style: score.currentStyle ?? null,
        simulated: score.simulated ?? false,
        avatar_url: score.avatarUrl ?? null,
        user_id: score.simulated ? null : (auth.user?.id ?? null),
        updated_at: new Date(score.updatedAt).toISOString(),
      },
      { onConflict: "event_code,participant_id" },
    );
    if (error) throw error;
  }

  async removeScores(code: string, ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    const { error } = await this.supabase
      .from("participant_scores")
      .delete()
      .eq("event_code", code)
      .in("participant_id", ids as string[]);
    if (error) throw error;
  }

  subscribeScores(code: string, onChange: (ranked: ParticipantScore[]) => void): () => void {
    const emit = async () => {
      const { data } = await this.supabase
        .from("participant_scores")
        .select()
        .eq("event_code", code);
      onChange(rankParticipants((data ?? []).map(rowToScore)));
    };

    const channel = this.supabase
      .channel(`scores:${code}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participant_scores", filter: `event_code=eq.${code}` },
        () => void emit(),
      )
      .subscribe();

    void emit();

    return () => {
      void this.supabase.removeChannel(channel);
    };
  }
}

export const eventStore: EventStore = new SupabaseEventStore();
