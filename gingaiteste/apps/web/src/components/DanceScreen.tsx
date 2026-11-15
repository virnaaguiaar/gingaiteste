"use client";

import {
  formatDuration,
  formatPoints,
  styleName,
  type SessionSnapshot,
  type SessionSummary,
  type WindowResult,
} from "@gingai/core";
import { useState, type ReactNode } from "react";
import { useDanceSession } from "@/lib/use-dance-session";
import { PocketMode } from "./PocketMode";
import { Button, Card, Stat } from "./ui";

export interface DanceScreenProps {
  onTick?: (snapshot: SessionSnapshot) => void;
  onWindow?: (result: WindowResult) => void;
  onFinish?: (summary: SessionSummary) => void;
  /** Conteúdo extra abaixo do placar (ex.: posição no ranking). */
  children?: ReactNode;
  startLabel?: string;
  /** Quando false, o botão de começar fica desabilitado (ex.: falta nomear o estilo). */
  canStart?: boolean;
  /** Dica exibida quando `canStart` é false. */
  disabledHint?: string;
}

export function DanceScreen({
  onTick,
  onWindow,
  onFinish,
  children,
  startLabel = "Começar a dançar",
  canStart = true,
  disabledHint,
}: DanceScreenProps) {
  const { status, snapshot, summary, error, start, stop, reset } = useDanceSession({ onTick, onWindow });
  const [pocket, setPocket] = useState(false);

  const finish = () => {
    setPocket(false);
    const result = stop();
    if (result) onFinish?.(result);
  };

  if (status === "idle" || status === "starting" || status === "error") {
    return (
      <div className="flex flex-col gap-4">
        <Card>
          <h2 className="text-lg font-bold">Como funciona</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>Toque em “{startLabel}” e permita o acesso aos sensores.</li>
            <li>Ative o <b className="text-foreground">modo bolso</b> e guarde o celular no bolso da frente.</li>
            <li>Dance! A tela fica acesa e escura, sem aceitar toques.</li>
          </ol>
        </Card>

        {error && (
          <p role="alert" className="rounded-2xl bg-brand/15 p-4 text-sm text-brand">
            {error}
          </p>
        )}

        {!canStart && disabledHint && (
          <p className="rounded-2xl bg-surface p-4 text-sm text-muted">{disabledHint}</p>
        )}

        <Button
          className="animate-beat py-6 text-xl"
          disabled={status === "starting" || !canStart}
          onClick={() => void start()}
        >
          {status === "starting" ? "Ligando sensores…" : startLabel}
        </Button>
      </div>
    );
  }

  const snap = snapshot!;

  if (status === "ended" && summary) {
    const top = summary.topStyle;
    return (
      <div className="flex flex-col gap-4">
        <Card className="text-center">
          <p className="text-sm uppercase tracking-widest text-muted">Fim da sessão</p>
          <p className="mt-2 font-mono text-6xl font-black text-ginga">{formatPoints(summary.points)}</p>
          <p className="text-muted">pontos</p>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <Stat label="dançando" value={formatDuration(summary.danceSeconds)} />
            <Stat label="combo máx." value={`x${summary.maxComboMultiplier.toFixed(2)}`} />
            <Stat label="estilo" value={top ? styleName(top) : "-"} />
          </div>
          {top && (
            <p className="mt-4 text-sm text-muted">
              Seu ritmo pareceu mais com <b className="text-foreground">{styleName(top)}</b>{" "}
              <span className="opacity-70">(reconhecimento em beta)</span>
            </p>
          )}
          {summary.rejectedWindows > 0 && (
            <p className="mt-2 text-xs text-muted">
              {summary.rejectedWindows} trecho(s) não pontuaram: {summary.lastRejectReason}
            </p>
          )}
        </Card>
        {children}
        <Button onClick={reset}>Dançar de novo</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {pocket && <PocketMode points={snap.points} onExit={() => setPocket(false)} />}

      <Card className="text-center">
        <p className="font-mono text-7xl font-black text-ginga">{formatPoints(snap.points)}</p>
        <p className="text-muted">pontos</p>
        <div className="mt-4 flex items-center justify-center gap-2 text-lg">
          {snap.style ? (
            <span className="rounded-full bg-surface-2 px-4 py-1 font-semibold">
              {styleName(snap.style)}{" "}
              <span className="text-sm text-muted">{Math.round(snap.confidence * 100)}%</span>
            </span>
          ) : (
            <span className="rounded-full bg-surface-2 px-4 py-1 text-muted">
              {snap.elapsedSeconds < 4 ? "Analisando…" : "Parado. Bora dançar!"}
            </span>
          )}
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <Stat label="tempo" value={formatDuration(snap.elapsedSeconds)} />
          <Stat label="BPM" value={snap.cadenceBpm || "-"} />
          <Stat label="combo" value={`x${snap.comboMultiplier.toFixed(2)}`} />
        </div>
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full bg-ginga transition-[width] duration-300"
              style={{ width: `${Math.min(100, (snap.intensity / 6) * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted">intensidade</p>
        </div>
        {snap.rejectedNow && (
          <p className="mt-3 text-xs text-brand-2">Aviso: {snap.lastRejectReason}</p>
        )}
      </Card>

      {children}

      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={() => setPocket(true)}>
          Modo bolso
        </Button>
        <Button variant="secondary" onClick={finish}>
          ⏹ Parar
        </Button>
      </div>
    </div>
  );
}
