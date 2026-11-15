import type { MotionSample, WindowFeatures } from "./types";

export interface FeatureOptions {
  /** Frequência para a reamostragem uniforme, em Hz. */
  resampleHz?: number;
  /** Faixa de cadência procurada, em Hz (≈ 42 a 240 batidas por minuto). */
  minCadenceHz?: number;
  maxCadenceHz?: number;
}

const DEFAULTS: Required<FeatureOptions> = {
  resampleHz: 50,
  minCadenceHz: 0.7,
  maxCadenceHz: 4,
};

type Vec3 = [number, number, number];

/** Reamostra as leituras (que chegam em intervalos irregulares) para uma grade uniforme. */
function resample(samples: readonly MotionSample[], hz: number): { acc: Vec3[]; rot: Vec3[] } {
  const first = samples[0]!;
  const last = samples[samples.length - 1]!;
  const step = 1000 / hz;
  const n = Math.floor((last.t - first.t) / step) + 1;
  const acc: Vec3[] = [];
  const rot: Vec3[] = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = first.t + i * step;
    while (j < samples.length - 2 && samples[j + 1]!.t < t) j++;
    const a = samples[j]!;
    const b = samples[Math.min(j + 1, samples.length - 1)]!;
    const span = b.t - a.t;
    const k = span > 0 ? Math.min(1, Math.max(0, (t - a.t) / span)) : 0;
    const lerp = (x: number, y: number) => x + (y - x) * k;
    acc.push([lerp(a.ax, b.ax), lerp(a.ay, b.ay), lerp(a.az, b.az)]);
    rot.push([lerp(a.rx, b.rx), lerp(a.ry, b.ry), lerp(a.rz, b.rz)]);
  }
  return { acc, rot };
}

const rms = (xs: readonly number[]) =>
  xs.length === 0 ? 0 : Math.sqrt(xs.reduce((s, x) => s + x * x, 0) / xs.length);

/**
 * Encontra a frequência dominante de um sinal pela autocorrelação normalizada.
 * Entre picos parecidos, prefere o de menor atraso (evita escolher múltiplos do período real).
 */
export function dominantFrequency(
  signal: readonly number[],
  hz: number,
  minHz: number,
  maxHz: number,
): { frequencyHz: number; strength: number } {
  const n = signal.length;
  const mean = signal.reduce((s, x) => s + x, 0) / n;
  const x = signal.map((v) => v - mean);
  const energy = x.reduce((s, v) => s + v * v, 0) / n;
  if (energy < 1e-6) return { frequencyHz: 0, strength: 0 };

  const minLag = Math.max(1, Math.floor(hz / maxHz));
  const maxLag = Math.min(n - 2, Math.ceil(hz / minHz));
  const r: number[] = [];
  for (let lag = 0; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = 0; i + lag < n; i++) s += x[i]! * x[i + lag]!;
    r.push(s / (n - lag) / energy);
  }

  const peaks: { lag: number; value: number }[] = [];
  for (let lag = minLag; lag < maxLag; lag++) {
    const v = r[lag]!;
    if (v > 0 && v >= r[lag - 1]! && v >= r[lag + 1]!) peaks.push({ lag, value: v });
  }
  if (peaks.length === 0) return { frequencyHz: 0, strength: 0 };

  const best = Math.max(...peaks.map((p) => p.value));
  const chosen = peaks.find((p) => p.value >= best * 0.9)!;

  // Interpolação parabólica para refinar o atraso entre amostras.
  const y0 = r[chosen.lag - 1]!;
  const y1 = r[chosen.lag]!;
  const y2 = r[chosen.lag + 1]!;
  const denom = y0 - 2 * y1 + y2;
  const offset = denom !== 0 ? (0.5 * (y0 - y2)) / denom : 0;
  const lag = chosen.lag + Math.max(-0.5, Math.min(0.5, offset));

  return { frequencyHz: hz / lag, strength: Math.min(1, chosen.value) };
}

/**
 * Extrai as características de uma janela de leituras.
 * Retorna `null` se não houver leituras suficientes (menos de ~1 s).
 */
export function extractFeatures(
  samples: readonly MotionSample[],
  options: FeatureOptions = {},
): WindowFeatures | null {
  const opt = { ...DEFAULTS, ...options };
  if (samples.length < 10) return null;
  const durationS = (samples[samples.length - 1]!.t - samples[0]!.t) / 1000;
  if (durationS < 1) return null;

  const { acc, rot } = resample(samples, opt.resampleHz);
  const n = acc.length;

  // Gravidade = média da aceleração na janela. Dá a direção "vertical" sem saber como o celular está no bolso.
  const g: Vec3 = [0, 0, 0];
  for (const a of acc) {
    g[0] += a[0] / n;
    g[1] += a[1] / n;
    g[2] += a[2] / n;
  }
  const gravity = Math.hypot(g[0], g[1], g[2]);
  const u: Vec3 = gravity > 1e-6 ? [g[0] / gravity, g[1] / gravity, g[2] / gravity] : [0, 0, 1];

  const vertical: number[] = [];
  const horizontal: number[] = [];
  const dynamic: number[] = [];
  for (const a of acc) {
    const d: Vec3 = [a[0] - g[0], a[1] - g[1], a[2] - g[2]];
    const v = d[0] * u[0] + d[1] * u[1] + d[2] * u[2];
    const h = Math.hypot(d[0] - v * u[0], d[1] - v * u[1], d[2] - v * u[2]);
    vertical.push(v);
    horizontal.push(h);
    dynamic.push(Math.hypot(d[0], d[1], d[2]));
  }

  const verticalRms = rms(vertical);
  const horizontalRms = rms(horizontal);
  const sum = verticalRms + horizontalRms;
  const { frequencyHz, strength } = dominantFrequency(
    vertical,
    opt.resampleHz,
    opt.minCadenceHz,
    opt.maxCadenceHz,
  );

  return {
    durationS,
    sampleRateHz: (samples.length - 1) / durationS,
    gravity,
    intensity: rms(dynamic),
    verticalRms,
    horizontalRms,
    verticalRatio: sum > 1e-6 ? verticalRms / sum : 0.5,
    rotationRms: rms(rot.map((r) => Math.hypot(r[0], r[1], r[2]))),
    cadenceHz: frequencyHz,
    periodicity: strength,
  };
}
