import type { DanceStyle } from "./types";

/**
 * Padrões musicais do "Baile de robôs": a música de cada estilo, descrita como dados
 * (quais instrumentos tocam em cada passo). O navegador transforma isso em som com o Web
 * Audio (sintetizado, sem arquivos de áudio e sem direitos autorais). O andamento é o
 * mesmo `styleBpm` da coreografia, então robôs e música batem no mesmo compasso.
 *
 * Um "passo" é uma semicolcheia: 4 passos por batida, 16 por compasso, 4 compassos por ciclo.
 */
export const STEPS_PER_BEAT = 4;
export const STEPS_PER_BAR = 16;
export const MUSIC_BARS = 4;
export const MUSIC_STEPS = STEPS_PER_BAR * MUSIC_BARS;

export type Instrument =
  | "kick"
  | "surdo"
  | "snare"
  | "hat"
  | "shaker"
  | "rim"
  | "tri"
  | "bass"
  | "chord"
  | "lead";

export interface MusicHit {
  instrument: Instrument;
  /** Força, de 0 (exclusivo) a 1. */
  velocity: number;
  /** Notas MIDI (bass/lead: 1 nota; chord: acorde). */
  notes?: number[];
  /** Duração em passos (para instrumentos com nota). */
  steps?: number;
}

const hit = (
  instrument: Instrument,
  velocity: number,
  notes?: number[],
  steps?: number,
): MusicHit => ({ instrument, velocity, notes, steps });

type BarFn = (bar: number, s: number) => MusicHit[];

// ---------- Forró (baião): zabumba + triângulo + sanfona ----------
const FORRO_CHORDS = [
  [57, 60, 64], // Am
  [57, 62, 65], // Dm
  [56, 59, 62, 64], // E7
  [57, 60, 64], // Am
];
const FORRO_ROOTS = [45, 50, 52, 45];
const FORRO_LEAD: [number, number, number][][] = [
  [[0, 69, 2], [2, 72, 2], [4, 76, 3], [8, 74, 2], [10, 72, 2], [12, 69, 3]],
  [[0, 69, 2], [2, 74, 2], [4, 77, 3], [8, 76, 2], [10, 74, 2], [12, 69, 3]],
  [[0, 68, 2], [2, 71, 2], [4, 76, 3], [8, 74, 2], [10, 71, 2], [12, 68, 3]],
  [[0, 72, 3], [4, 71, 2], [6, 69, 2], [8, 64, 6]],
];
const forro: BarFn = (bar, s) => {
  const out: MusicHit[] = [];
  if (s === 0 || s === 6 || s === 8) out.push(hit("surdo", s === 0 ? 1 : 0.8));
  if (s % 2 === 0) out.push(hit("tri", s % 4 === 2 ? 0.7 : 0.35));
  if (s === 0 || s === 6 || s === 8) out.push(hit("chord", 0.6, FORRO_CHORDS[bar], 2));
  if (s === 0) out.push(hit("bass", 0.9, [FORRO_ROOTS[bar]!], 3));
  if (s === 8) out.push(hit("bass", 0.8, [FORRO_ROOTS[bar]! + 7], 3));
  for (const [step, note, dur] of FORRO_LEAD[bar]!) if (step === s) out.push(hit("lead", 0.5, [note], dur));
  return out;
};

// ---------- Samba: surdo, tamborim, pandeiro/ganzá, violão e baixo ----------
const SAMBA_CHORDS = [
  [57, 60, 62, 65], // Dm7
  [55, 59, 62, 65], // G7
  [55, 59, 60, 64], // Cmaj7
  [57, 60, 64, 67], // Am7
];
const SAMBA_ROOTS = [50, 43, 48, 45];
const samba: BarFn = (bar, s) => {
  const out: MusicHit[] = [];
  if (s === 0 || s === 8) out.push(hit("surdo", 0.4));
  if (s === 4 || s === 12) out.push(hit("surdo", 1));
  if ([0, 3, 6, 8, 10, 13].includes(s)) out.push(hit("rim", 0.6));
  out.push(hit("shaker", s % 2 === 0 ? 0.3 : 0.55));
  if ([3, 6, 11, 14].includes(s)) out.push(hit("chord", 0.5, SAMBA_CHORDS[bar], 1));
  const root = SAMBA_ROOTS[bar]!;
  if (s === 0 || s === 8) out.push(hit("bass", 0.8, [root], 3));
  if (s === 6 || s === 14) out.push(hit("bass", 0.7, [root + 7], 2));
  return out;
};

// ---------- Funk carioca: tamborzão (3-3-2), palma, hi-hat e 808 ----------
const FUNK_CHORDS = [
  [64, 67, 71], // Em
  [64, 67, 71],
  [60, 64, 67, 71], // Cmaj7
  [62, 66, 69], // D
];
const FUNK_ROOTS = [40, 40, 36, 38];
const funk: BarFn = (bar, s) => {
  const out: MusicHit[] = [];
  if ([0, 3, 6, 8, 11, 14].includes(s)) out.push(hit("kick", s % 8 === 0 ? 1 : 0.85));
  if (s === 4 || s === 12) out.push(hit("snare", 0.9));
  if (s === 10) out.push(hit("rim", 0.6));
  if (s % 2 === 0) out.push(hit("hat", s % 4 === 0 ? 0.5 : 0.3));
  const root = FUNK_ROOTS[bar]!;
  const bassSteps: [number, number, number][] = [[0, root, 3], [3, root, 1], [6, root + 3, 2], [8, root, 3], [11, root, 1], [14, root - 2, 2]];
  for (const [step, note, dur] of bassSteps) if (step === s) out.push(hit("bass", 0.9, [note], dur));
  if (s === 0 || s === 6 || s === 10) out.push(hit("chord", 0.5, FUNK_CHORDS[bar], 1));
  return out;
};

// ---------- Reggae (one drop): bumbo+aro no 3, skank no contratempo, baixo ----------
const REGGAE_CHORDS = [
  [57, 60, 64], // Am
  [57, 62, 65], // Dm
  [57, 60, 64], // Am
  [56, 59, 64], // E
];
const REGGAE_ROOTS = [45, 50, 45, 40];
const reggae: BarFn = (bar, s) => {
  const out: MusicHit[] = [];
  if (s === 8) {
    out.push(hit("kick", 1));
    out.push(hit("rim", 0.7));
  }
  if (s % 2 === 0) out.push(hit("hat", s % 4 === 2 ? 0.45 : 0.25));
  if (s % 4 === 2) out.push(hit("chord", 0.6, REGGAE_CHORDS[bar], 1));
  const r = REGGAE_ROOTS[bar]!;
  const bassSteps: [number, number, number][] = [[0, r, 3], [6, r, 2], [8, r + 7, 3], [12, r + 12, 2]];
  for (const [step, note, dur] of bassSteps) if (step === s) out.push(hit("bass", 0.9, [note], dur));
  return out;
};

// ---------- Estilo sem música própria: batida simples de pista ----------
const generic: BarFn = (_bar, s) => {
  const out: MusicHit[] = [];
  if (s % 4 === 0) out.push(hit("kick", s === 0 ? 1 : 0.85));
  if (s === 4 || s === 12) out.push(hit("snare", 0.6));
  if (s % 4 === 2) out.push(hit("hat", 0.4));
  const bass: [number, number][] = [[0, 45], [3, 45], [6, 48], [10, 52]];
  for (const [step, note] of bass) if (step === s) out.push(hit("bass", 0.8, [note], 2));
  if (s === 0 || s === 10) out.push(hit("chord", 0.4, [57, 60, 64], 3));
  return out;
};

const PATTERNS: Record<string, BarFn> = { forro, samba, funk, reggae };

/** Instrumentos que tocam no passo `step` (qualquer inteiro ≥ 0; o ciclo se repete). */
export function musicHits(style: DanceStyle, step: number): MusicHit[] {
  const i = ((Math.floor(step) % MUSIC_STEPS) + MUSIC_STEPS) % MUSIC_STEPS;
  const fn = PATTERNS[style] ?? generic;
  return fn(Math.floor(i / STEPS_PER_BAR), i % STEPS_PER_BAR);
}
