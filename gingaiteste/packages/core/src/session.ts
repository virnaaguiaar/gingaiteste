import { CentroidClassifier, HEURISTIC_MODEL, type DanceClassifier } from "./classifier";
import { extractFeatures } from "./features";
import {
  DEFAULT_SCORING,
  checkPlausibility,
  comboMultiplier,
  isDancing,
  scoreWindow,
  type ScoringConfig,
} from "./scoring";
import { type DanceStyle, type MotionSample, type WindowFeatures } from "./types";

export interface SessionOptions {
  /** Tamanho da janela de análise, em segundos. */
  windowS?: number;
  /** De quanto em quanto tempo uma janela é avaliada, em segundos. */
  hopS?: number;
  /** Um intervalo maior que isso sem leituras (tela apagou, app pausou) não conta pontos. */
  maxGapMs?: number;
  /** Quantas janelas recentes votam no estilo exibido (suaviza trocas bruscas). */
  styleVotes?: number;
  classifier?: DanceClassifier;
  scoring?: ScoringConfig;
}

export interface WindowResult {
  endT: number;
  features: WindowFeatures;
  plausible: boolean;
  reason?: string;
  dancing: boolean;
  /** Estilo suavizado (voto das últimas janelas), ou null se não está dançando. */
  style: DanceStyle | null;
  confidence: number;
  points: number;
  comboMultiplier: number;
}

export interface SessionSnapshot {
  points: number;
  elapsedSeconds: number;
  danceSeconds: number;
  comboMultiplier: number;
  maxComboMultiplier: number;
  style: DanceStyle | null;
  confidence: number;
  cadenceBpm: number;
  intensity: number;
  styleSeconds: Record<DanceStyle, number>;
  rejectedWindows: number;
  lastRejectReason?: string;
  /** A janela mais recente foi recusada pelo antifraude. */
  rejectedNow: boolean;
}

export interface SessionSummary extends SessionSnapshot {
  startedAt: number;
  endedAt: number;
  topStyle: DanceStyle | null;
}


/**
 * Sessão de dança: recebe leituras do sensor uma a uma e devolve resultados por janela.
 * Não depende de plataforma, então roda igual no navegador, no React Native e nos testes.
 */
export class DanceSession {
  private readonly windowMs: number;
  private readonly hopMs: number;
  private readonly maxGapMs: number;
  private readonly styleVotes: number;
  private readonly classifier: DanceClassifier;
  private readonly scoring: ScoringConfig;

  private buffer: MotionSample[] = [];
  private startT: number | null = null;
  private lastT: number | null = null;
  private lastAwardT: number | null = null;
  private recent: { style: DanceStyle; confidence: number }[] = [];
  private consecutive = 0;
  private last: WindowResult | null = null;

  private points = 0;
  private danceSeconds = 0;
  private maxCombo = 1;
  private rejected = 0;
  private lastRejectReason: string | undefined;
  private readonly styleSeconds: Record<DanceStyle, number> = {};

  constructor(options: SessionOptions = {}) {
    this.windowMs = (options.windowS ?? 4) * 1000;
    this.hopMs = (options.hopS ?? 2) * 1000;
    this.maxGapMs = options.maxGapMs ?? 1000;
    this.styleVotes = options.styleVotes ?? 5;
    this.classifier = options.classifier ?? new CentroidClassifier(HEURISTIC_MODEL);
    this.scoring = options.scoring ?? DEFAULT_SCORING;
  }

  push(sample: MotionSample): WindowResult | null {
    if (this.startT === null) this.startT = sample.t;
    if (this.lastT !== null && sample.t - this.lastT > this.maxGapMs) {
      // Lacuna: recomeça a janela e não paga o tempo parado.
      this.buffer = [];
      this.lastAwardT = null;
      this.consecutive = 0;
    }
    if (this.lastT !== null && sample.t <= this.lastT) return null; // fora de ordem/duplicada
    this.lastT = sample.t;
    this.buffer.push(sample);

    const cutoff = sample.t - this.windowMs;
    while (this.buffer.length > 0 && this.buffer[0]!.t < cutoff) this.buffer.shift();

    const span = sample.t - this.buffer[0]!.t;
    if (this.lastAwardT === null) {
      if (span < this.windowMs * 0.95) return null;
    } else if (sample.t - this.lastAwardT < this.hopMs) {
      return null;
    }
    return this.evaluate(sample.t);
  }

  private evaluate(t: number): WindowResult | null {
    const features = extractFeatures(this.buffer);
    if (!features) return null;
    // Só paga o tempo realmente coberto por leituras desde o último pagamento.
    const since = this.lastAwardT ?? this.buffer[0]!.t;
    const seconds = Math.min(this.windowMs, t - since) / 1000;
    this.lastAwardT = t;

    const plaus = checkPlausibility(features);
    let result: WindowResult;
    if (!plaus.ok) {
      this.rejected++;
      this.lastRejectReason = plaus.reason;
      this.consecutive = 0;
      result = {
        endT: t,
        features,
        plausible: false,
        reason: plaus.reason,
        dancing: false,
        style: null,
        confidence: 0,
        points: 0,
        comboMultiplier: 1,
      };
    } else if (!isDancing(features, this.scoring)) {
      this.consecutive = 0;
      result = {
        endT: t,
        features,
        plausible: true,
        dancing: false,
        style: null,
        confidence: 0,
        points: 0,
        comboMultiplier: 1,
      };
    } else {
      const combo = comboMultiplier(this.consecutive, this.scoring);
      this.consecutive++;
      const points = scoreWindow(features, seconds, combo, this.scoring);
      const { style, confidence } = this.vote(this.classifier.classify(features));

      this.points += points;
      this.danceSeconds += seconds;
      this.styleSeconds[style] = (this.styleSeconds[style] ?? 0) + seconds;
      this.maxCombo = Math.max(this.maxCombo, combo);
      result = {
        endT: t,
        features,
        plausible: true,
        dancing: true,
        style,
        confidence,
        points,
        comboMultiplier: combo,
      };
    }
    this.last = result;
    return result;
  }

  private vote(c: { label: DanceStyle; confidence: number }) {
    this.recent.push({ style: c.label, confidence: c.confidence });
    if (this.recent.length > this.styleVotes) this.recent.shift();
    const weight: Record<DanceStyle, number> = {};
    for (const r of this.recent) weight[r.style] = (weight[r.style] ?? 0) + r.confidence;
    const total = this.recent.reduce((s, r) => s + r.confidence, 0);
    let style: DanceStyle = c.label;
    for (const [s, w] of Object.entries(weight)) if (w > weight[style]!) style = s;
    return { style, confidence: total > 0 ? weight[style]! / total : 0 };
  }

  snapshot(): SessionSnapshot {
    const f = this.last?.features;
    return {
      points: this.points,
      elapsedSeconds:
        this.startT !== null && this.lastT !== null ? (this.lastT - this.startT) / 1000 : 0,
      danceSeconds: this.danceSeconds,
      comboMultiplier: this.last?.comboMultiplier ?? 1,
      maxComboMultiplier: this.maxCombo,
      style: this.last?.style ?? null,
      confidence: this.last?.confidence ?? 0,
      cadenceBpm: f && this.last?.dancing ? Math.round(f.cadenceHz * 60) : 0,
      intensity: f?.intensity ?? 0,
      styleSeconds: { ...this.styleSeconds },
      rejectedWindows: this.rejected,
      lastRejectReason: this.lastRejectReason,
      rejectedNow: this.last?.plausible === false,
    };
  }

  summary(): SessionSummary {
    const snap = this.snapshot();
    return {
      ...snap,
      startedAt: this.startT ?? 0,
      endedAt: this.lastT ?? 0,
      topStyle: topStyleOf(snap.styleSeconds),
    };
  }
}

/** Estilo com mais tempo dançado, ou null se nenhum. */
export function topStyleOf(styleSeconds: Record<DanceStyle, number>): DanceStyle | null {
  let top: DanceStyle | null = null;
  for (const [s, secs] of Object.entries(styleSeconds)) {
    if (secs > 0 && (!top || secs > styleSeconds[top]!)) top = s;
  }
  return top;
}
