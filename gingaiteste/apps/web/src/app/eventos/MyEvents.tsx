"use client";

import {
  DANCE_STYLES,
  labelInfo,
  type DanceEvent,
  type DanceStyle,
  type EventVisibility,
} from "@gingai/core";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Card, LinkButton } from "@/components/ui";
import { eventStore } from "@/lib/event-store";
import { useAuth } from "@/lib/use-auth";

export function MyEvents() {
  const { user } = useAuth();
  const [events, setEvents] = useState<DanceEvent[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const reload = () => {
    void eventStore
      .listMyEvents()
      .then(setEvents)
      .catch(() => setEvents([]));
  };

  useEffect(() => {
    if (!user) return; // deslogado ou ainda carregando: nada a buscar
    void eventStore
      .listMyEvents()
      .then(setEvents)
      .catch(() => setEvents([]));
  }, [user]);

  if (user === undefined) {
    return <p className="text-muted">Carregando…</p>;
  }

  if (!user) {
    return (
      <Card className="flex flex-col gap-3">
        <p className="text-muted">Entre para criar e gerenciar suas festas em qualquer aparelho.</p>
        <LinkButton href="/entrar?next=/eventos">Entrar</LinkButton>
      </Card>
    );
  }

  if (events === null) {
    return <p className="text-muted">Carregando…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <LinkButton href="/eventos/novo">Criar nova festa</LinkButton>

      {events.length === 0 ? (
        <Card>
          <p className="text-muted">
            Você ainda não criou nenhuma festa. Toque em “Criar nova festa” para começar.
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((e) =>
            editing === e.code ? (
              <EditEventCard
                key={e.code}
                event={e}
                onDone={() => {
                  setEditing(null);
                  reload();
                }}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <EventCard
                key={e.code}
                event={e}
                onEdit={() => setEditing(e.code)}
                onDeleted={reload}
              />
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function EventCard({
  event,
  onEdit,
  onDeleted,
}: {
  event: DanceEvent;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (!confirm(`Remover a festa “${event.name}”? Os placares serão apagados.`)) return;
    setBusy(true);
    try {
      await eventStore.deleteEvent(event.code);
      onDeleted();
    } catch {
      setBusy(false);
      alert("Não foi possível remover a festa. Tente de novo.");
    }
  };

  return (
    <li>
      <Card className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 font-mono text-sm font-bold uppercase text-brand">{(event.style ? labelInfo(event.style).name : event.name).slice(0, 2)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold">{event.name}</p>
            <p className="text-xs text-muted">
              {event.visibility === "private" ? "Privada" : "Pública"}
              {event.style ? ` · ${labelInfo(event.style).name}` : ""} · código{" "}
              <span className="font-mono">{event.code}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/e/${event.code}/telao`} variant="secondary" className="px-4 py-2 text-sm">
            Telão
          </LinkButton>
          <LinkButton href={`/e/${event.code}/robos`} variant="secondary" className="px-4 py-2 text-sm">
            Baile de robôs
          </LinkButton>
          <Link
            href={`/e/${event.code}`}
            className="rounded-2xl bg-surface-2 px-4 py-2 text-sm font-bold"
          >
            Entrar
          </Link>
          <Button variant="secondary" className="px-4 py-2 text-sm" onClick={onEdit}>
            Editar
          </Button>
          <Button
            variant="ghost"
            className="px-4 py-2 text-sm text-brand"
            disabled={busy}
            onClick={() => void remove()}
          >
            Remover
          </Button>
        </div>
      </Card>
    </li>
  );
}

function EditEventCard({
  event,
  onDone,
  onCancel,
}: {
  event: DanceEvent;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(event.name);
  const [style, setStyle] = useState<DanceStyle | undefined>(event.style);
  const [visibility, setVisibility] = useState<EventVisibility>(event.visibility ?? "public");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await eventStore.updateEvent(event.code, {
        name: trimmed.slice(0, 60),
        style: style ?? null,
        visibility,
      });
      onDone();
    } catch {
      setBusy(false);
      alert("Não foi possível salvar as alterações.");
    }
  };

  return (
    <li>
      <Card>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold">Nome da festa</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              required
              autoFocus
              className="rounded-2xl bg-surface-2 px-4 py-3 text-lg placeholder:text-muted"
            />
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">Ritmo (opcional)</legend>
            <div className="flex flex-wrap gap-2">
              {DANCE_STYLES.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setStyle(style === s ? undefined : s)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${style === s ? "bg-ginga text-white" : "bg-surface-2"}`}
                >
                  {labelInfo(s).name}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">Quem pode ver</legend>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setVisibility("public")}
                aria-pressed={visibility === "public"}
                className={`rounded-2xl px-4 py-3 text-left text-sm ${visibility === "public" ? "bg-ginga text-white" : "bg-surface-2"}`}
              >
                <span className="block font-bold">Pública</span>
                <span className={`block text-xs ${visibility === "public" ? "text-white/80" : "text-muted"}`}>
                  Aparece na página inicial
                </span>
              </button>
              <button
                type="button"
                onClick={() => setVisibility("private")}
                aria-pressed={visibility === "private"}
                className={`rounded-2xl px-4 py-3 text-left text-sm ${visibility === "private" ? "bg-ginga text-white" : "bg-surface-2"}`}
              >
                <span className="block font-bold">Privada</span>
                <span className={`block text-xs ${visibility === "private" ? "text-white/80" : "text-muted"}`}>
                  Só entra quem tem o código
                </span>
              </button>
            </div>
          </fieldset>

          <div className="flex gap-2">
            <Button type="submit" className="flex-1 py-3" disabled={busy || !name.trim()}>
              {busy ? "Salvando…" : "Salvar"}
            </Button>
            <Button type="button" variant="secondary" className="py-3" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </form>
      </Card>
    </li>
  );
}
