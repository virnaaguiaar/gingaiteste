import { CONTROL_LABELS, type DanceStyle, type MotionLabel, type WindowFeatures } from "./types";

/** Características usadas na classificação (as demais servem para pontuação e validação). */
export const CLASSIFIER_FEATURES = [
  "intensity",
  "verticalRatio",
  "rotationRms",
  "cadenceHz",
  "periodicity",
] as const satisfies readonly (keyof WindowFeatures)[];

type FeatureVector = number[];

export function toVector(f: WindowFeatures): FeatureVector {
  return CLASSIFIER_FEATURES.map((k) => f[k]);
}

export interface Classification {
  label: DanceStyle;
  confidence: number;
  probabilities: Record<DanceStyle, number>;
}

/** Qualquer classificador plugável (o heurístico de hoje, um modelo treinado amanhã). */
export interface DanceClassifier {
  classify(features: WindowFeatures): Classification;
}

/**
 * Modelo de centróide mais próximo, serializável em JSON.
 * `centroids` e `scale` ficam nas unidades originais das características.
 */
export interface CentroidModel {
  version: 1;
  source: "heuristic" | "trained";
  features: readonly string[];
  scale: number[];
  centroids: Record<DanceStyle, number[]>;
  /** Quantos exemplos de cada estilo foram usados (só para modelos treinados). */
  counts?: Record<DanceStyle, number>;
  trainedAt?: string;
}

/**
 * Modelo inicial feito à mão, ANTES de existirem dados reais. É um ponto de partida (beta):
 * - forró: passos ~2 Hz, balanço lateral forte, intensidade moderada
 * - samba: passos rápidos (~2,8 Hz), mais quique vertical
 * - funk: ~2,2 Hz, alta intensidade, muito quique e rotação de quadril
 * Substitua por um modelo treinado com `trainCentroidModel` assim que houver coletas.
 */
export const HEURISTIC_MODEL: CentroidModel = {
  version: 1,
  source: "heuristic",
  features: CLASSIFIER_FEATURES,
  //        intensity  vRatio  rotation  cadence  periodicity
  scale: [1.5, 0.12, 40, 0.4, 0.25],
  centroids: {
    forro: [3.0, 0.45, 60, 1.9, 0.6],
    samba: [4.5, 0.55, 90, 2.8, 0.55],
    funk: [5.5, 0.65, 120, 2.2, 0.5],
  },
};

export class CentroidClassifier implements DanceClassifier {
  private readonly styles: DanceStyle[];

  constructor(private readonly model: CentroidModel) {
    if (model.features.join() !== CLASSIFIER_FEATURES.join()) {
      throw new Error("Modelo incompatível: lista de características diferente");
    }
    this.styles = Object.keys(model.centroids).filter((s) => model.centroids[s]);
    if (this.styles.length === 0) throw new Error("Modelo sem nenhum estilo");
  }

  classify(features: WindowFeatures): Classification {
    const x = toVector(features);
    const logits = this.styles.map((style) => {
      const c = this.model.centroids[style]!;
      let d2 = 0;
      for (let i = 0; i < x.length; i++) {
        const z = (x[i]! - c[i]!) / this.model.scale[i]!;
        d2 += z * z;
      }
      return -d2 / 2;
    });
    const max = Math.max(...logits);
    const exps = logits.map((l) => Math.exp(l - max));
    const total = exps.reduce((s, e) => s + e, 0);

    const probabilities: Record<DanceStyle, number> = {};
    let label = this.styles[0]!;
    this.styles.forEach((s, i) => {
      probabilities[s] = exps[i]! / total;
      if (probabilities[s]! > probabilities[label]!) label = s;
    });
    return { label, confidence: probabilities[label]!, probabilities };
  }
}

export interface LabeledFeatures {
  label: MotionLabel;
  features: WindowFeatures;
}

/**
 * Treina um modelo de centróides a partir de janelas rotuladas no modo de coleta.
 * Ignora rótulos de controle ("parado", "outro"). Exige ao menos `minStyles` estilos
 * com `minPerStyle` janelas cada. Basta 1 estilo: os demais vêm do modelo global
 * (ver `mergeModels`).
 */
export function trainCentroidModel(
  examples: readonly LabeledFeatures[],
  minPerStyle = 5,
  minStyles = 1,
): CentroidModel {
  const groups = new Map<DanceStyle, FeatureVector[]>();
  for (const ex of examples) {
    if ((CONTROL_LABELS as readonly string[]).includes(ex.label)) continue;
    const style = ex.label;
    groups.set(style, [...(groups.get(style) ?? []), toVector(ex.features)]);
  }
  const usable = [...groups].filter(([, xs]) => xs.length >= minPerStyle);
  if (usable.length < minStyles) {
    throw new Error(
      `Dados insuficientes: são necessários ao menos ${minStyles} estilo(s) com ${minPerStyle} janelas cada`,
    );
  }

  const dims = CLASSIFIER_FEATURES.length;
  const centroids: CentroidModel["centroids"] = {};
  const counts: CentroidModel["counts"] = {};
  for (const [style, xs] of usable) {
    centroids[style] = Array.from({ length: dims }, (_, i) =>
      xs.reduce((s, x) => s + x[i]!, 0) / xs.length,
    );
    counts[style] = xs.length;
  }

  // Desvio-padrão "agrupado" (dentro de cada estilo), com piso para não dividir por ~0.
  const floor = HEURISTIC_MODEL.scale.map((s) => s * 0.1);
  const scale = Array.from({ length: dims }, (_, i) => {
    let sq = 0;
    let n = 0;
    for (const [style, xs] of usable) {
      const c = centroids[style]![i]!;
      for (const x of xs) {
        sq += (x[i]! - c) ** 2;
        n++;
      }
    }
    return Math.max(floor[i]!, Math.sqrt(sq / Math.max(1, n - usable.length)));
  });

  return {
    version: 1,
    source: "trained",
    features: CLASSIFIER_FEATURES,
    scale,
    centroids,
    counts,
    trainedAt: new Date().toISOString(),
  };
}

/**
 * Combina modelos por estilo, do menos para o mais específico (ex.: heurístico, global,
 * pessoal). Para cada estilo vale o centróide do modelo mais específico que o tem:
 * quem gravou um ritmo usa o próprio; quem não gravou usa a média de todos (ou, na falta
 * dela, o heurístico). A escala é a maior entre os modelos treinados (mais conservadora).
 */
export function mergeModels(...layers: (CentroidModel | null | undefined)[]): CentroidModel {
  const present = layers.filter((m): m is CentroidModel => !!m);
  if (present.length === 0) throw new Error("mergeModels: nenhum modelo");

  const centroids: CentroidModel["centroids"] = {};
  const counts: NonNullable<CentroidModel["counts"]> = {};
  for (const m of present) {
    Object.assign(centroids, m.centroids);
    Object.assign(counts, m.counts);
  }

  const trained = present.filter((m) => m.source === "trained");
  const scaleSources = trained.length > 0 ? trained : [present[0]!];
  const scale = scaleSources[0]!.scale.map((_, i) => Math.max(...scaleSources.map((m) => m.scale[i]!)));

  return {
    version: 1,
    source: trained.length > 0 ? "trained" : present[0]!.source,
    features: present[0]!.features,
    scale,
    centroids,
    counts,
    trainedAt: trained.at(-1)?.trainedAt,
  };
}
