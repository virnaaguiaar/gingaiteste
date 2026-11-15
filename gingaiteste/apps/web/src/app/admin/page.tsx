import { formatDuration, formatPoints } from "@gingai/core";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/Avatar";
import { Card, Header, Page, Stat } from "@/components/ui";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { StyleManager } from "./StyleManager";

export default function AdminPage() {
  return (
    <Page wide>
      <Header right={<span className="text-sm text-muted">Admin</span>} />
      <h1 className="text-3xl font-black">Painel do administrador</h1>
      <Suspense fallback={<p className="text-muted">Carregando painel…</p>}>
        <AdminContent />
      </Suspense>
    </Page>
  );
}

async function AdminContent() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/entrar?next=/admin");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") {
    return (
      <Card>
        <h2 className="text-2xl font-black">Acesso restrito</h2>
        <p className="mt-2 text-muted">Esta área é só para administradores do GingAI.</p>
      </Card>
    );
  }

  // Admin: RLS libera a leitura de tudo.
  const [{ data: profiles }, { data: events }, { data: sessions }, { data: recordings }, { data: styles }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, nickname, avatar_url, role, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("events")
        .select("code, name, style, visibility, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("sessions").select("points, dance_seconds"),
      supabase.from("collection_recordings").select("label, duration_s, windows"),
      supabase
        .from("dance_styles_catalog")
        .select("slug, name, emoji, sort_order")
        .order("sort_order", { ascending: true }),
    ]);

  const totalPoints = (sessions ?? []).reduce((s, r) => s + Number(r.points), 0);
  const totalSeconds = (sessions ?? []).reduce((s, r) => s + Number(r.dance_seconds), 0);

  // Resumo da coleta: janelas por rótulo (base para treinar um modelo central).
  const windowsByLabel = new Map<string, number>();
  for (const r of recordings ?? []) {
    const n = Array.isArray(r.windows) ? r.windows.length : 0;
    windowsByLabel.set(r.label, (windowsByLabel.get(r.label) ?? 0) + n);
  }
  const totalWindows = [...windowsByLabel.values()].reduce((s, n) => s + n, 0);

  // Linhas da coleta: cada estilo do catálogo + rótulos coletados fora dele (legados).
  const catalog = styles ?? [];
  const catalogSlugs = new Set(catalog.map((s) => s.slug));
  const extraLabels = [...windowsByLabel.keys()].filter((l) => !catalogSlugs.has(l));
  const collectionRows = [
    ...catalog.map((s) => ({
      label: s.slug,
      name: s.name,
      emoji: s.emoji,
      windows: windowsByLabel.get(s.slug) ?? 0,
    })),
    ...extraLabels.map((l) => ({ label: l, name: l, emoji: "🎶", windows: windowsByLabel.get(l) ?? 0 })),
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label="usuários" value={profiles?.length ?? 0} />
        <Stat label="festas" value={events?.length ?? 0} />
        <Stat label="pontos totais" value={formatPoints(totalPoints)} />
        <Stat label="ginga total" value={formatDuration(totalSeconds)} />
        <Stat label="janelas coleta" value={totalWindows} />
      </div>

      <Card>
        <h2 className="font-bold">Usuários</h2>
        <ul className="mt-3 divide-y divide-surface-2 text-sm">
          {(profiles ?? []).map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2">
              <Avatar src={p.avatar_url} name={p.nickname || "?"} className="size-7" textClassName="text-xs" />
              <span className="flex-1 truncate">{p.nickname || "(sem apelido)"}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  p.role === "admin" ? "bg-brand/20 text-brand-2" : "bg-surface-2 text-muted"
                }`}
              >
                {p.role}
              </span>
            </li>
          ))}
          {(profiles ?? []).length === 0 && (
            <li className="py-2 text-muted">Nenhum usuário ainda.</li>
          )}
        </ul>
      </Card>

      <Card>
        <h2 className="font-bold">Festas</h2>
        <ul className="mt-3 divide-y divide-surface-2 text-sm">
          {(events ?? []).map((e) => (
            <li key={e.code} className="flex items-center justify-between gap-2 py-2">
              <span className="truncate">
                {e.visibility === "private" ? "(privada) " : ""}
                {e.name}
              </span>
              <span className="font-mono text-muted">{e.code}</span>
            </li>
          ))}
          {(events ?? []).length === 0 && <li className="py-2 text-muted">Nenhuma festa ainda.</li>}
        </ul>
      </Card>

      <StyleManager />

      <Card>
        <h2 className="font-bold">Coleta (dados de treino)</h2>
        <table className="mt-3 w-full text-sm">
          <tbody>
            {collectionRows.map((row) => (
              <tr key={row.label} className="border-b border-surface-2 last:border-0">
                <td className="py-2">
                  {row.emoji} {row.name}
                </td>
                <td className="py-2 text-right font-mono text-muted">{row.windows} jan.</td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalWindows === 0 && (
          <p className="mt-3 text-xs text-muted">
            Nenhuma gravação ainda. Os usuários coletam em /coleta (dados sincronizam quando logados).
          </p>
        )}
      </Card>
    </>
  );
}
