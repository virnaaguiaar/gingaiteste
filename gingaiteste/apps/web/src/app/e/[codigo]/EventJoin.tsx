"use client";

import { isValidEventCode, normalizeEventCode, topStyleOf, type SessionSnapshot } from "@gingai/core";
import { useRef } from "react";
import { GoogleSignInButton } from "@/components/AuthButton";
import { DanceScreen } from "@/components/DanceScreen";
import { Card } from "@/components/ui";
import { eventStore } from "@/lib/event-store";
import { useAuth } from "@/lib/use-auth";
import { useEvent, useRanking } from "@/lib/use-event";

const PUBLISH_EVERY_MS = 2000;

export function EventJoin({ code: rawCode }: { code: string }) {
  const code = normalizeEventCode(rawCode);
  const event = useEvent(code);
  const ranking = useRanking(code);
  const auth = useAuth();
  // Só entra na festa quem está logado com o Google: a identidade vem da conta.
  const profile = auth.user
    ? {
        id: auth.user.id,
        nickname: auth.profile?.nickname || auth.user.email?.split("@")[0] || "Dançarino",
        avatarUrl: auth.profile?.avatar_url ?? undefined,
      }
    : null;
  const lastPublish = useRef(0);
  // Pontos de sessões anteriores nesta festa: "Dançar de novo" soma, não zera o placar.
  const base = useRef<{ points: number; danceSeconds: number } | null>(null);

  if (!isValidEventCode(code)) {
    return <p className="text-brand">Código de festa inválido.</p>;
  }

  const publish = (snap: SessionSnapshot, final = false) => {
    if (!profile) return;
    if (!base.current) {
      const prev = ranking.find((r) => r.id === profile.id);
      base.current = { points: prev?.points ?? 0, danceSeconds: prev?.danceSeconds ?? 0 };
    }
    const now = Date.now();
    if (!final && now - lastPublish.current < PUBLISH_EVERY_MS) return;
    lastPublish.current = now;
    void eventStore.publishScore(code, {
      id: profile.id,
      nickname: profile.nickname,
      points: base.current.points + snap.points,
      danceSeconds: base.current.danceSeconds + snap.danceSeconds,
      topStyle: topStyleOf(snap.styleSeconds),
      // Ao encerrar, a pessoa deixa de "dançar agora" (os robôs param).
      currentStyle: final ? null : snap.style,
      updatedAt: now,
      avatarUrl: profile.avatarUrl,
    });
    if (final) base.current = null;
  };

  const position = profile ? ranking.findIndex((r) => r.id === profile.id) : -1;

  return (
    <>
      <div className="text-center">
        <p className="text-sm uppercase tracking-widest text-muted">Festa · {code}</p>
        <h1 className="mt-1 text-3xl font-black">{event?.name ?? "Festa GingAI"}</h1>
      </div>

      {event === null && (
        <p className="rounded-2xl bg-brand-2/15 p-4 text-sm text-brand-2">
          Não encontramos uma festa com esse código. Confira o código no telão e tente de novo.
        </p>
      )}

      {auth.user === undefined ? (
        <p className="text-center text-muted">Carregando…</p>
      ) : !profile ? (
        <Card className="flex flex-col gap-3 text-center">
          <h2 className="text-lg font-bold">Entre para participar da festa</h2>
          <p className="text-sm text-muted">
            Seu nome e sua foto do Google aparecem no telão, e seus pontos ficam salvos na sua conta.
          </p>
          {/* Depois do login, o callback devolve para esta mesma página da festa. */}
          <GoogleSignInButton />
        </Card>
      ) : (
        <DanceScreen
          startLabel={`Dançar como ${profile.nickname}`}
          onTick={(snap) => publish(snap)}
          onFinish={(summary) => publish(summary, true)}
        >
          {position >= 0 && (
            <Card className="flex items-center justify-between">
              <span className="text-muted">Sua posição</span>
              <span className="font-mono text-3xl font-black">
                {position + 1}º <span className="text-base text-muted">de {ranking.length}</span>
              </span>
            </Card>
          )}
        </DanceScreen>
      )}
    </>
  );
}
