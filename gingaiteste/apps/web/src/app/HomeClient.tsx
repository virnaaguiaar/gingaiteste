"use client";

import { labelInfo, formatDuration, formatPoints, isValidEventCode, normalizeEventCode } from "@gingai/core";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Stat } from "@/components/ui";
import { PublicEvents } from "@/components/PublicEvents";
import { historyStore } from "@/lib/stores";

export function HomeClient() {
  const router = useRouter();
  const history = historyStore.useValue();
  const [code, setCode] = useState("");
  const normalized = normalizeEventCode(code);

  const total = history.reduce((s, h) => s + h.points, 0);
  const seconds = history.reduce((s, h) => s + h.danceSeconds, 0);

  return (
    <>
      <Card>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (isValidEventCode(normalized)) router.push(`/e/${normalized}`);
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Código da festa"
            autoCapitalize="characters"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-2xl bg-surface-2 px-4 py-3 font-mono text-lg uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal placeholder:text-muted"
            aria-label="Código da festa"
          />
          <Button type="submit" className="py-3" disabled={!isValidEventCode(normalized)}>
            Entrar
          </Button>
        </form>
      </Card>

      <PublicEvents />

      {history.length > 0 && (
        <Card>
          <h2 className="font-bold">Seu histórico</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Stat label="pontos" value={formatPoints(total)} />
            <Stat label="dançado" value={formatDuration(seconds)} />
            <Stat label="sessões" value={history.length} />
          </div>
          <ul className="mt-4 divide-y divide-surface-2 text-sm">
            {history.slice(0, 5).map((h) => (
              <li key={h.startedAt + "-" + h.endedAt} className="flex justify-between py-2">
                <span className="text-muted">
                  {h.topStyle ? `${labelInfo(h.topStyle).name} · ` : ""}{formatDuration(h.danceSeconds)}
                </span>
                <span className="font-mono font-bold">{formatPoints(h.points)} pts</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
