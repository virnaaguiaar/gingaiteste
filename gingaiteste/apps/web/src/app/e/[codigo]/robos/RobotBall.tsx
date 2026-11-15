"use client";

import {
  CrowdTracker,
  MAX_ROBOTS,
  formatPoints,
  labelInfo,
  normalizeEventCode,
  styleBpm,
  type CrowdMood,
} from "@gingai/core";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Avatar } from "@/components/Avatar";
import { QRCode } from "@/components/QRCode";
import { RobotStage } from "@/components/RobotStage";
import { Logo } from "@/components/ui";
import { danceMusic } from "@/lib/dance-music";
import { desconectarRobos, enviarEstilo, robosConfigurados } from "@/lib/robots-link";
import { createLocalStore } from "@/lib/local-store";
import { useAuth } from "@/lib/use-auth";
import { useDemoDancers } from "@/lib/use-demo-dancers";
import { useEvent, useRanking } from "@/lib/use-event";

const MEDALS = ["1º", "2º", "3º"];
const noopSubscribe = () => () => {};
const NO_MOOD: CrowdMood = { style: null, dancers: 0, total: 0, counts: {} };

/** Quantidade de robôs em cena (1–10), lembrada neste aparelho. */
const robotCountStore = createLocalStore<number>("gingai:robot-count", 6);
/** Volume da música (0–1), lembrado neste aparelho. */
const volumeStore = createLocalStore<number>("gingai:robot-volume", 0.7);

export function RobotBall({ code: rawCode }: { code: string }) {
  const code = normalizeEventCode(rawCode);
  const event = useEvent(code);
  const ranking = useRanking(code);
  const robotCount = Math.min(MAX_ROBOTS, Math.max(1, robotCountStore.useValue()));
  const [demo, setDemo] = useState(false);
  const { user } = useAuth();
  const isOwner = !!user && !!event?.ownerId && event.ownerId === user.id;
  useDemoDancers(code, demo && isOwner);

  // O que a festa está dançando agora (maioria de quem dança neste momento).
  const [tracker] = useState(() => new CrowdTracker());
  const [mood, setMood] = useState<CrowdMood>(NO_MOOD);
  useEffect(() => {
    tracker.observe(ranking, Date.now());
    const tick = () => setMood(tracker.mood(Date.now()));
    const first = setTimeout(tick, 0);
    // Reavalia a cada segundo: quem para de publicar deixa de contar e os robôs param.
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [ranking, tracker]);

  const origin = useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => "",
  );
  const joinUrl = origin ? `${origin}/e/${code}` : "";

  // ?estilo=samba força uma coreografia (pré-visualização, sem precisar de dançarinos).
  const forced = useSearchParams().get("estilo")?.trim().toLowerCase() || null;
  const style = forced ?? mood.style;
  const info = style ? labelInfo(style) : null;

  // Música: o navegador só libera áudio após um clique, então começa desligada.
  const [soundOn, setSoundOn] = useState(false);
  const volume = volumeStore.useValue();
  const clockRef = useRef<(() => number) | null>(null);

  useEffect(() => {
    danceMusic.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    if (!soundOn || !style) {
      danceMusic.stop();
      return;
    }
    // Começa na próxima batida da coreografia, para robôs e música andarem juntos.
    let delay = 0;
    const clock = clockRef.current;
    if (clock) {
      const beatS = 60 / styleBpm(style);
      const pos = clock() / beatS;
      delay = (Math.ceil(pos) - pos) * beatS;
    }
    danceMusic.play(style, delay);
  }, [soundOn, style]);

  useEffect(() => () => danceMusic.stop(), []);

  // Carrinhos reais: só o dono da festa liga. O t0 fica 1,5 s no futuro para todos
  // começarem juntos, e o comando é repetido a cada 20 s com o mesmo t0, assim um
  // carrinho que reiniciou volta para a dança sem sair do compasso.
  const [robosReais, setRobosReais] = useState(false);
  useEffect(() => {
    if (!robosReais) return;
    const t0 = Date.now() + 1500;
    enviarEstilo(style, t0);
    const id = setInterval(() => enviarEstilo(style, t0), 20_000);
    return () => clearInterval(id);
  }, [style, robosReais]);
  useEffect(() => () => desconectarRobos(), []);
  const breakdown = Object.entries(mood.counts)
    .sort(([, a], [, b]) => b - a)
    .map(([style, n]) => `${labelInfo(style).name} ${n}`)
    .join(" · ");

  return (
    <main className="flex min-h-screen flex-col gap-6 p-6 lg:h-screen lg:flex-row lg:p-8">
      <section className="relative min-h-[60vh] flex-1 overflow-hidden rounded-3xl bg-stage text-white">
        <RobotStage
          count={robotCount}
          style={style}
          onClock={(getTime) => {
            clockRef.current = getTime;
          }}
        />

        <div className="pointer-events-none absolute left-5 top-5 flex flex-col gap-1">
          <p className="text-3xl font-black">
            Baile de <span className="text-ginga">robôs</span>
          </p>
          <p className="text-lg text-white/75">
            {info ? (
              <>
                Dançando <b className="text-white">{info.name}</b> ·{" "}
                {mood.dancers} de {mood.total} {mood.total === 1 ? "pessoa" : "pessoas"}
                {breakdown && mood.dancers > 1 ? ` (${breakdown})` : ""}
              </>
            ) : mood.total === 0 ? (
              "Aguardando pessoas entrarem na festa…"
            ) : (
              "Os robôs esperam a música: dancem para eles dançarem!"
            )}
          </p>
        </div>

        <div className="absolute bottom-4 right-5 flex items-center gap-3 rounded-2xl bg-black/40 px-4 py-2 text-sm backdrop-blur">
          {soundOn ? (
            <>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => volumeStore.set(Number(e.target.value))}
                className="w-28 accent-brand"
                aria-label="Volume da música"
              />
              <button type="button" onClick={() => setSoundOn(false)} className="font-bold underline-offset-4 hover:underline">
                Desligar
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                danceMusic.unlock();
                setSoundOn(true);
              }}
              className="font-bold"
            >
              Ativar música
            </button>
          )}
        </div>

        <label className="absolute bottom-4 left-5 flex items-center gap-3 rounded-2xl bg-black/40 px-4 py-2 text-sm backdrop-blur">
          <span>Robôs em cena: <b className="font-mono text-base">{robotCount}</b></span>
          <input
            type="range"
            min={1}
            max={MAX_ROBOTS}
            value={robotCount}
            onChange={(e) => robotCountStore.set(Number(e.target.value))}
            className="w-40 accent-brand"
            aria-label="Quantidade de robôs"
          />
        </label>
      </section>

      <aside className="flex flex-col items-center gap-5 lg:w-96 lg:shrink-0 lg:overflow-y-auto">
        <Logo className="text-4xl" />
        <div className="text-center">
          <h1 className="text-2xl font-black">{event?.name ?? "Festa GingAI"}</h1>
        </div>
        {joinUrl && <QRCode value={joinUrl} className="aspect-square w-56" />}
        <div className="text-center">
          <p className="text-muted">Escaneie e dance!</p>
          <p className="mt-1 font-mono text-3xl font-black tracking-[0.3em]">{code}</p>
        </div>

        <div className="w-full">
          <h2 className="mb-2 text-xl font-black">
            Ranking <span className="text-ginga">ao vivo</span>
          </h2>
          {ranking.length === 0 ? (
            <p className="card-baile rounded-2xl bg-surface p-4 text-center text-muted">
              Ninguém entrou ainda. Escaneie o QR Code!
            </p>
          ) : (
            <ol className="flex flex-col gap-2">
              {ranking.slice(0, 8).map((r, i) => (
                <li
                  key={r.id}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 ${i === 0 ? "bg-ginga text-white" : "card-baile bg-surface"}`}
                >
                  <span className="w-9 text-center font-mono text-xl font-black">{MEDALS[i] ?? `${i + 1}º`}</span>
                  <Avatar src={r.avatarUrl} name={r.nickname} className="size-9" textClassName="text-sm" />
                  <span className="flex-1 truncate text-lg font-bold">
                    {r.nickname}
                    {r.simulated && <span className="ml-2 text-xs font-normal opacity-60">(demo)</span>}
                  </span>
                  {r.currentStyle && <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/80">{labelInfo(r.currentStyle).name}</span>}
                  <span className="font-mono text-xl font-black">{formatPoints(r.points)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="mt-auto flex flex-col items-center gap-2 text-sm text-muted">
          {isOwner && robosConfigurados() && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={robosReais}
                onChange={(e) => {
                  setRobosReais(e.target.checked);
                  if (!e.target.checked) enviarEstilo(null, 0);
                }}
                className="size-4 accent-brand"
              />
              Comandar os robôs reais
            </label>
          )}
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
          <Link href={`/e/${code}/telao`} className="underline-offset-4 hover:underline">
            Abrir o telão
          </Link>
        </div>
      </aside>
    </main>
  );
}
