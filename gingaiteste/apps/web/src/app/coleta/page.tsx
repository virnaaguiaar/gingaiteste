"use client";

import {
  formatDuration,
  trainCentroidModel,
  CONTROL_LABELS,
  type LabeledFeatures,
  type WindowResult,
} from "@gingai/core";
import { useEffect, useRef, useState } from "react";
import { DanceScreen } from "@/components/DanceScreen";
import { Button, Card, Header, Page } from "@/components/ui";
import {
  clearRecordings,
  clearTrainedModel,
  saveRecording,
  saveTrainedModel,
  syncCollectionFromCloud,
} from "@/lib/collection-store";
import { listStyles, type DanceStyleOption } from "@/lib/styles-catalog";
import { downloadJson, modelStore, newId, recordingsStore, type Recording } from "@/lib/stores";

const isControlLabel = (slug: string) => (CONTROL_LABELS as readonly string[]).includes(slug);

export default function ColetaPage() {
  const recordings = recordingsStore.useValue();
  const model = modelStore.useValue();
  const [styles, setStyles] = useState<DanceStyleOption[]>([]);
  const [label, setLabel] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const current = useRef<{ label: string; windows: Recording["windows"] } | null>(null);

  // Catálogo de estilos (gerenciado pelo admin) + sincronização da coleta.
  useEffect(() => {
    void listStyles().then((list) => {
      setStyles(list);
      setLabel((cur) => cur || list[0]?.slug || "");
    });
    void syncCollectionFromCloud();
  }, []);

  const infoBySlug = (slug: string): { name: string; emoji: string } => {
    const s = styles.find((x) => x.slug === slug);
    return s ? { name: s.name, emoji: s.emoji } : { name: slug, emoji: "🎶" };
  };

  const effectiveInfo = infoBySlug(label);

  const onWindow = (r: WindowResult) => {
    current.current ??= { label, windows: [] };
    if (r.plausible) current.current.windows.push({ features: r.features, dancing: r.dancing });
  };

  const onFinish = () => {
    const rec = current.current;
    current.current = null;
    if (!rec || rec.windows.length === 0) return;
    const durationS = rec.windows.reduce((s, w) => s + w.features.durationS, 0) / 2; // janelas com 50% de sobreposição
    const recording: Recording = {
      id: newId(),
      label: rec.label,
      createdAt: Date.now(),
      durationS,
      windows: rec.windows,
    };
    const name = infoBySlug(rec.label).name;
    void saveRecording(recording).then(({ synced, error }) => {
      if (error) {
        setMessage(`Gravação de ${name} salva no aparelho, mas falhou ao enviar ao servidor: ${error}`);
      } else if (synced) {
        setMessage(`Gravação de ${name} salva e enviada ao servidor (${recording.windows.length} janelas).`);
      } else {
        setMessage(`Gravação de ${name} salva neste aparelho (${recording.windows.length} janelas). Entre para enviar ao servidor.`);
      }
    });
  };

  // Linhas da tabela: um por estilo do catálogo, com o que foi coletado neste aparelho.
  const counts = styles.map((s) => ({
    ...s,
    windows: recordings.filter((r) => r.label === s.slug).reduce((sum, r) => sum + r.windows.length, 0),
    seconds: recordings.filter((r) => r.label === s.slug).reduce((sum, r) => sum + r.durationS, 0),
  }));

  const train = () => {
    const examples: LabeledFeatures[] = recordings.flatMap((r) => {
      if (isControlLabel(r.label)) return [];
      return r.windows.filter((w) => w.dancing).map((w) => ({ label: r.label, features: w.features }));
    });
    try {
      const trained = trainCentroidModel(examples);
      void saveTrainedModel(trained);
      setMessage(
        `Modelo treinado com ${Object.entries(trained.counts ?? {})
          .map(([s, n]) => `${n} janelas de ${infoBySlug(s).name}`)
          .join(", ")}. Já está em uso neste aparelho; os estilos que você não gravou usam a média de todos.`,
      );
    } catch (err) {
      setMessage((err as Error).message);
    }
  };

  return (
    <Page>
      <Header right={<span className="text-sm text-muted">Modo coleta</span>} />
      <p className="text-sm text-muted">
        Grave sessões rotuladas para treinar o reconhecimento de estilos. Escolha o ritmo, coloque o
        celular no bolso da frente e dance pelo menos 2 minutos daquele estilo.
      </p>

      <div className="flex flex-wrap gap-2">
        {styles.map((s) => (
          <button
            key={s.slug}
            onClick={() => setLabel(s.slug)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${label === s.slug ? "bg-ginga text-white" : "bg-surface-2"}`}
          >
            {s.name}
          </button>
        ))}
      </div>

      <DanceScreen
        startLabel={`Gravar ${effectiveInfo.name}`}
        onWindow={onWindow}
        onFinish={onFinish}
        canStart={!!label}
        disabledHint={!label ? "Carregando os estilos disponíveis…" : undefined}
      />

      {message && <p className="rounded-2xl bg-accent/15 p-4 text-sm text-accent">{message}</p>}

      <Card>
        <h2 className="font-bold">Dados coletados neste aparelho</h2>
        <table className="mt-3 w-full text-sm">
          <tbody>
            {counts.map((c) => (
              <tr key={c.slug} className="border-b border-surface-2 last:border-0">
                <td className="py-2">
                  {c.name}
                </td>
                <td className="py-2 text-right font-mono">{formatDuration(c.seconds)}</td>
                <td className="py-2 text-right font-mono text-muted">{c.windows} jan.</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted">
          Modelo em uso:{" "}
          <b className="text-foreground">
            {model ? `treinado em ${new Date(model.trainedAt ?? 0).toLocaleString("pt-BR")}` : "heurístico (padrão)"}
          </b>
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" className="py-3 text-base" onClick={train}>
            Treinar
          </Button>
          <Button
            variant="secondary"
            className="py-3 text-base"
            disabled={recordings.length === 0}
            onClick={() =>
              downloadJson(`gingai-coleta-${new Date().toISOString().slice(0, 10)}.json`, {
                format: "gingai-coleta",
                version: 1,
                exportedAt: new Date().toISOString(),
                userAgent: navigator.userAgent,
                recordings,
              })
            }
          >
            ⬇️ Exportar JSON
          </Button>
          {model && (
            <Button variant="ghost" className="py-2 text-sm" onClick={() => void clearTrainedModel()}>
              Voltar ao modelo padrão
            </Button>
          )}
          {recordings.length > 0 && (
            <Button
              variant="ghost"
              className="py-2 text-sm"
              onClick={() => {
                if (confirm("Apagar todas as gravações deste aparelho?")) void clearRecordings();
              }}
            >
              Apagar gravações
            </Button>
          )}
        </div>
      </Card>
    </Page>
  );
}
