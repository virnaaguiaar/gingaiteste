import type { WindowFeatures } from "./types";

export interface ScoringConfig {
  /** Intensidade mínima (m/s²) para considerar que a pessoa está dançando. */
  minIntensity: number;
  /** Periodicidade mínima: abaixo disso é movimento solto (andar até o bar não conta muito). */
  minPeriodicity: number;
  /** Pontos base por segundo dançado. */
  pointsPerSecond: number;
  /** Intensidade que dá o bônus máximo (x2). */
  intensityForMaxBonus: number;
  /** Janelas seguidas dançando para subir um nível de combo. */
  windowsPerComboLevel: number;
  /** Multiplicador de combo máximo. */
  maxComboMultiplier: number;
}

export const DEFAULT_SCORING: ScoringConfig = {
  minIntensity: 1.2,
  minPeriodicity: 0.25,
  pointsPerSecond: 10,
  intensityForMaxBonus: 6,
  windowsPerComboLevel: 5,
  maxComboMultiplier: 2,
};

export interface PlausibilityResult {
  ok: boolean;
  reason?: string;
}

/**
 * Antifraude básico: recusa janelas que não parecem uma pessoa dançando com o celular no bolso.
 * Não é à prova de tudo; o servidor (fase 2) repete estas regras antes de aceitar pontos.
 */
export function checkPlausibility(f: WindowFeatures): PlausibilityResult {
  if (f.sampleRateHz < 15) return { ok: false, reason: "Sensor lento demais neste aparelho" };
  if (f.intensity > 25) return { ok: false, reason: "Movimento brusco demais (sacudindo o celular?)" };
  if (f.rotationRms > 600) return { ok: false, reason: "Celular girando demais (está na mão?)" };
  if (f.gravity < 6 || f.gravity > 14) return { ok: false, reason: "Leitura de gravidade estranha" };
  return { ok: true };
}

export function isDancing(f: WindowFeatures, config: ScoringConfig = DEFAULT_SCORING): boolean {
  return f.intensity >= config.minIntensity && f.periodicity >= config.minPeriodicity;
}

export function comboMultiplier(
  consecutiveWindows: number,
  config: ScoringConfig = DEFAULT_SCORING,
): number {
  const level = Math.floor(consecutiveWindows / config.windowsPerComboLevel);
  return Math.min(config.maxComboMultiplier, 1 + 0.25 * level);
}

/**
 * Pontos de um trecho de `seconds` segundos:
 * base × bônus de intensidade (1 a 2) × bônus de constância (1 a 1,5) × combo (1 a 2).
 */
export function scoreWindow(
  f: WindowFeatures,
  seconds: number,
  combo: number,
  config: ScoringConfig = DEFAULT_SCORING,
): number {
  if (!isDancing(f, config)) return 0;
  const span = Math.max(1e-6, config.intensityForMaxBonus - config.minIntensity);
  const intensityBonus = 1 + Math.min(1, (f.intensity - config.minIntensity) / span);
  const constancyBonus = 1 + 0.5 * Math.min(1, f.periodicity);
  return Math.round(config.pointsPerSecond * seconds * intensityBonus * constancyBonus * combo);
}
