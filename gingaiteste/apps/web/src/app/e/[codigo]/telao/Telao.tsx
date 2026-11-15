"use client";

import { labelInfo, formatDuration, formatPoints, normalizeEventCode } from "@gingai/core";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { QRCode } from "@/components/QRCode";
import { Logo } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/use-auth";
import { useDemoDancers } from "@/lib/use-demo-dancers";
import { useEvent, useRanking } from "@/lib/use-event";

const MEDALS = ["1º", "2º", "3º"];
const noopSubscribe = () => () => {};

export function Telao({ code: rawCode }: { code: string }) {
  const code = normalizeEventCode(rawCode);
  const event = useEvent(code);
  const ranking = useRanking(code);
  const [demo, setDemo] = useState(false);
  const { user } = useAuth();
  // Os dançarinos simulados gravam no banco: a RLS só aceita isso do dono da festa.
  const isOwner = !!user && !!event?.ownerId && event.ownerId === user.id;
  useDemoDancers(code, demo && isOwner);

  // A origem só existe no navegador; no servidor o QR fica vazio até hidratar.
  const origin = useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => "",
  );
  const joinUrl = origin ? `${origin}/e/${code}` : "";
  const totalSeconds = ranking.reduce((s, r) => s + r.danceSeconds, 0);

  return (
    <main className="flex min-h-screen flex-col gap-8 p-6 lg:flex-row lg:p-10">
      <aside className="flex flex-col items-center gap-5 lg:w-80 lg:shrink-0">
        <Logo className="text-4xl" />
        <div className="text-center">
          <h1 className="text-3xl font-black">{event?.name ?? "Festa GingAI"}</h1>
          {event?.style && (
            <p className="mt-1 text-muted">
              Noite de {labelInfo(event.style).name}
            </p>
          )}
        </div>
        {joinUrl && <QRCode value={joinUrl} className="aspect-square w-64" />}
        <div className="text-center">
          <p className="text-muted">Escaneie e dance!</p>
          <p className="mt-1 font-mono text-4xl font-black tracking-[0.3em]">{code}</p>
        </div>
        <div className="mt-auto flex flex-col items-center gap-2 text-sm text-muted">
          {isOwner && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={demo}
                onChange={(e) => setDemo(e.target.checked)}
                className="size-4 accent-brand"
              />
              Modo demonstração (dançarinos simulados)
            </label>
          )}
          <Link href={`/e/${code}`} target="_blank" className="underline-offset-4 hover:underline">
            Abrir a tela de participante em outra aba
          </Link>
        </div>
      </aside>

      <section className="flex flex-1 flex-col gap-4">
        <div className="flex items-end justify-between">
          <h2 className="text-4xl font-black">
            Ranking <span className="text-ginga">ao vivo</span>
          </h2>
          <p className="text-muted">
            {ranking.length} dançando · {formatDuration(totalSeconds)} de ginga
          </p>
        </div>

        {ranking.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-3xl bg-surface p-10 text-center text-2xl text-muted">
            Ninguém entrou ainda. Escaneie o QR Code para ser o primeiro!
          </div>
        ) : (
          <ol className="flex flex-col gap-3">
            {ranking.slice(0, 10).map((r, i) => (
              <li
                key={r.id}
                className={`flex items-center gap-4 rounded-3xl px-6 py-4 ${i === 0 ? "bg-ginga text-white" : "card-baile bg-surface"}`}
              >
                <span className="w-12 text-center font-mono text-3xl font-black">
                  {MEDALS[i] ?? `${i + 1}º`}
                </span>
                <Avatar
                  src={r.avatarUrl}
                  name={r.nickname}
                  className="size-11"
                  textClassName="text-lg"
                />
                <span className="flex-1 truncate text-2xl font-bold">
                  {r.nickname}
                  {r.simulated && <span className="ml-2 text-xs font-normal opacity-60">(demo)</span>}
                </span>
                {r.topStyle && <span className="rounded-full bg-brand/10 px-3 py-1 text-sm font-semibold text-brand">{labelInfo(r.topStyle).name}</span>}
                <span className="font-mono text-3xl font-black">{formatPoints(r.points)}</span>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-auto text-xs text-muted">
          Ranking ao vivo, sincronizado entre todos os celulares conectados à festa.
        </p>
      </section>
    </main>
  );
}
