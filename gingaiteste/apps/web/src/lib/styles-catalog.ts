"use client";

import { getSupabaseBrowserClient } from "./supabase/client";
import type { Database } from "./supabase/types";

export type StyleRow = Database["public"]["Tables"]["dance_styles_catalog"]["Row"];

export interface DanceStyleOption {
  slug: string;
  name: string;
  emoji: string;
  isControl: boolean;
}

const rowToOption = (r: StyleRow): DanceStyleOption => ({
  slug: r.slug,
  name: r.name,
  emoji: r.emoji,
  isControl: r.is_control,
});

/** Lista o catálogo de estilos (ordenado), usado na coleta e no admin. */
export async function listStyles(): Promise<DanceStyleOption[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("dance_styles_catalog")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToOption);
}

/** Gera um slug a partir do nome: minúsculas, sem acento, só [a-z0-9-]. */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Admin: cadastra um novo estilo. RLS garante que só admin consegue. */
export async function createStyle(input: {
  name: string;
  emoji?: string;
}): Promise<DanceStyleOption> {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const slug = slugify(input.name);
  if (!slug) throw new Error("Nome inválido para o estilo.");

  const { data, error } = await supabase
    .from("dance_styles_catalog")
    .insert({
      slug,
      name: input.name.trim().slice(0, 40),
      emoji: input.emoji?.trim() || "🎶",
      is_control: false,
      created_by: user?.id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToOption(data);
}

/** Admin: remove um estilo do catálogo. */
export async function deleteStyle(slug: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("dance_styles_catalog").delete().eq("slug", slug);
  if (error) throw error;
}
