"use client";

import { labelInfo, type DanceEvent } from "@gingai/core";
import Link from "next/link";
import { useEffect, useState } from "react";
import { eventStore } from "@/lib/event-store";
import { Card } from "./ui";

/** "agora", "há 5 min", "há 2 h", "há 3 d" (tempo relativo curto em pt-BR. */
function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "agora";
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} d`;
}

/** Lista as festas públicas (mais novas primeiro). Não renderiza nada se não houver. */
export function PublicEvents() {
  const [events, setEvents] = useState<DanceEvent[] | null>(null);

  useEffect(() => {
    let alive = true;
    void eventStore
      .listPublicEvents(30)
      .then((list) => alive && setEvents(list))
      .catch(() => alive && setEvents([]));
    return () => {
      alive = false;
    };
  }, []);

  // Carregando ou sem festas públicas: não ocupa espaço.
  if (!events || events.length === 0) return null;

  return (
    <Card>
      <h2 className="font-bold">Festas públicas acontecendo</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {events.map((e) => (
          <li key={e.code}>
            <Link
              href={`/e/${e.code}`}
              className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3 transition active:scale-[0.99]"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 font-mono text-sm font-bold uppercase text-brand">{(e.style ? labelInfo(e.style).name : e.name).slice(0, 2)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{e.name}</span>
                <span className="block text-xs text-muted">
                  {e.style ? `${labelInfo(e.style).name} · ` : ""}
                  {timeAgo(e.createdAt)}
                </span>
              </span>
              <span className="font-mono text-sm tracking-widest text-muted">{e.code}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
